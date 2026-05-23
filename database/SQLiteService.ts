// database/SQLiteService.ts - Enhanced with Multi-Device Sync Support
// Fixed version with database reset on schema change
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import * as SQLite from "expo-sqlite";
import uuid from "react-native-uuid";

// ============================================================
// INTERFACES
// ============================================================

export interface KategoriProduk {
  id: string;
  nama: string;
  deskripsi?: string;
  dibuat: string;
  diperbarui: string;
}

export interface Produk {
  id: string;
  nama: string;
  harga: number;
  stok: number;
  kategoriId: string;
  gambarPath?: string;
  dibuat: string;
  diperbarui: string;
  // Sync columns
  server_id?: string;
  device_id?: string;
  version: number;
  sync_status: "pending" | "synced" | "conflict";
  deleted_at?: string;
}

export interface JenisKue {
  id: string;
  nama: string;
  hargaBase: number;
  dibuat: string;
}

export interface VariasiKue {
  id: string;
  nama: string;
  hargaTambahan: number;
  dibuat: string;
}

export interface UkuranKue {
  id: string;
  nama: string;
  multiplierHarga: number;
  dibuat: string;
}

export interface KotakKue {
  id: string;
  nama: string;
  hargaTambahan: number;
  dibuat: string;
}

export interface AksesorisKue {
  id: string;
  nama: string;
  harga: number;
  dibuat: string;
}

export interface KueReady {
  id: string;
  nama: string;
  jenisKue: string;
  variasiKue: string;
  ukuranKue: string;
  hargaJual: number;
  gambarPath?: string;
  status: string;
  catatan?: string;
  dibuat: string;
  diperbarui: string;
  // Sync columns
  server_id?: string;
  device_id?: string;
  version: number;
  sync_status: "pending" | "synced" | "conflict";
  deleted_at?: string;
}

export interface Pengaturan {
  id: string;
  key: string;
  value: string;
  dibuat: string;
  diperbarui: string;
}

export interface SyncQueueItem {
  id: string;
  table_name: string;
  record_id: string;
  operation: "INSERT" | "UPDATE" | "DELETE";
  data: string;
  priority: number;
  retry_count: number;
  created_at: string;
  processed_at?: string;
  error_message?: string;
}

export interface SyncLog {
  id: string;
  sync_type: "push" | "pull";
  status: "success" | "partial" | "failed";
  records_pushed: number;
  records_pulled: number;
  conflicts: number;
  error_message?: string;
  started_at: string;
  completed_at?: string;
}

export interface DeviceInfo {
  device_id: string;
  device_name: string;
  device_type: "kasir" | "dapur";
  api_key?: string;
  registered_at?: string;
  last_sync_at?: string;
}

// ============================================================
// SQLITE SERVICE CLASS
// ============================================================

class SQLiteService {
  private db: SQLite.SQLiteDatabase | null = null;
  private isSeeded: boolean = false;
  private deviceId: string | null = null;

  // Database version - INCREMENT THIS when schema changes!
  private static DB_VERSION = 5;

  // ============================================================
  // INITIALIZATION
  // ============================================================

  async initialize(): Promise<void> {
    try {
      // Check if database needs reset (version mismatch)
      await this.checkAndResetDatabaseIfNeeded();

      this.db = await SQLite.openDatabaseAsync("nurcakepos.db");
      await this.db.execAsync("PRAGMA foreign_keys = ON;");
      console.log("SQLite database berhasil dibuka");

      // Generate or load device ID
      await this.initializeDeviceId();

      // Create tables with sync support
      await this.createTables();

      // Run migrations for sync columns (safe to run multiple times)
      await this.runSyncMigrations();

      // Save current DB version
      await AsyncStorage.setItem(
        "nurcake_db_version",
        String(SQLiteService.DB_VERSION)
      );

      // Check if data already seeded
      await this.checkAndSeedData();
    } catch (error) {
      console.error("Error membuka SQLite database:", error);
      throw error;
    }
  }

  // ============================================================
  // DATABASE VERSION CHECK & RESET
  // ============================================================

  private async checkAndResetDatabaseIfNeeded(): Promise<void> {
    try {
      const storedVersion = await AsyncStorage.getItem("nurcake_db_version");
      const currentVersion = storedVersion ? parseInt(storedVersion) : 0;

      console.log(
        `DB Version check: stored=${currentVersion}, required=${SQLiteService.DB_VERSION}`
      );

      if (currentVersion < SQLiteService.DB_VERSION) {
        console.log("Database version mismatch - resetting database...");
        await this.resetDatabase();
      }
    } catch (error) {
      console.error("Error checking database version:", error);
      // If error occurs, try to reset
      await this.resetDatabase();
    }
  }

  async resetDatabase(): Promise<void> {
    try {
      // Close existing connection if open
      if (this.db) {
        await this.db.closeAsync();
        this.db = null;
      }

      // Delete database file
      const dbPath = `${FileSystem.documentDirectory}SQLite/nurcakepos.db`;
      const fileInfo = await FileSystem.getInfoAsync(dbPath);

      if (fileInfo.exists) {
        await FileSystem.deleteAsync(dbPath, { idempotent: true });
        console.log("Database file deleted");
      }

      // Also try to delete WAL and SHM files (SQLite journal files)
      try {
        await FileSystem.deleteAsync(`${dbPath}-wal`, { idempotent: true });
        await FileSystem.deleteAsync(`${dbPath}-shm`, { idempotent: true });
      } catch (e) {
        // Ignore errors for WAL/SHM files - they may not exist
      }

      // Clear version so it will be set fresh after table creation
      await AsyncStorage.removeItem("nurcake_db_version");

      console.log("Database reset complete");
    } catch (error) {
      console.error("Error resetting database:", error);
    }
  }

  private async initializeDeviceId(): Promise<void> {
    try {
      let deviceId = await AsyncStorage.getItem("nurcake_device_id");
      if (!deviceId) {
        deviceId = `DEVICE-${uuid
          .v4()
          .toString()
          .substring(0, 8)
          .toUpperCase()}`;
        await AsyncStorage.setItem("nurcake_device_id", deviceId);
      }
      this.deviceId = deviceId;
      console.log("Device ID:", this.deviceId);
    } catch (error) {
      console.error("Error initializing device ID:", error);
      // Fallback to a random ID if AsyncStorage fails
      this.deviceId = `DEVICE-${uuid
        .v4()
        .toString()
        .substring(0, 8)
        .toUpperCase()}`;
    }
  }

  getDeviceId(): string {
    return this.deviceId || "UNKNOWN";
  }

  // ============================================================
  // TABLE CREATION
  // ============================================================

  private async createTables(): Promise<void> {
    if (!this.db) return;

    await this.db.execAsync(`
      -- Master Data Tables (Read-only, synced from server)
      CREATE TABLE IF NOT EXISTS kategori_produk (
        id TEXT PRIMARY KEY,
        nama TEXT NOT NULL,
        deskripsi TEXT,
        dibuat TEXT NOT NULL,
        diperbarui TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS jenis_kue (
        id TEXT PRIMARY KEY,
        nama TEXT NOT NULL,
        hargaBase REAL NOT NULL,
        dibuat TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS variasi_kue (
        id TEXT PRIMARY KEY,
        nama TEXT NOT NULL,
        hargaTambahan REAL NOT NULL,
        dibuat TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS ukuran_kue (
        id TEXT PRIMARY KEY,
        nama TEXT NOT NULL,
        multiplierHarga REAL NOT NULL,
        dibuat TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS kotak_kue (
        id TEXT PRIMARY KEY,
        nama TEXT NOT NULL,
        hargaTambahan REAL NOT NULL,
        dibuat TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS aksesoris_kue (
        id TEXT PRIMARY KEY,
        nama TEXT NOT NULL,
        harga REAL NOT NULL,
        dibuat TEXT NOT NULL
      );

      -- Transactional Tables (Syncable) - WITH sync columns from start
      CREATE TABLE IF NOT EXISTS produk (
        id TEXT PRIMARY KEY,
        nama TEXT NOT NULL,
        harga REAL NOT NULL,
        stok INTEGER NOT NULL DEFAULT 0,
        kategoriId TEXT,
        gambarPath TEXT,
        dibuat TEXT NOT NULL,
        diperbarui TEXT NOT NULL,
        server_id TEXT,
        device_id TEXT,
        version INTEGER NOT NULL DEFAULT 1,
        sync_status TEXT NOT NULL DEFAULT 'pending',
        deleted_at TEXT,
        FOREIGN KEY (kategoriId) REFERENCES kategori_produk(id)
      );

      CREATE TABLE IF NOT EXISTS kue_ready (
        id TEXT PRIMARY KEY,
        nama TEXT NOT NULL,
        jenisKue TEXT NOT NULL,
        variasiKue TEXT,
        ukuranKue TEXT NOT NULL,
        hargaJual REAL NOT NULL,
        gambarPath TEXT,
        status TEXT NOT NULL DEFAULT 'tersedia',
        catatan TEXT,
        dibuat TEXT NOT NULL,
        diperbarui TEXT NOT NULL,
        server_id TEXT,
        device_id TEXT,
        version INTEGER NOT NULL DEFAULT 1,
        sync_status TEXT NOT NULL DEFAULT 'pending',
        deleted_at TEXT
      );

      CREATE TABLE IF NOT EXISTS transaksi (
        id TEXT PRIMARY KEY,
        nomorTransaksi TEXT NOT NULL UNIQUE,
        tanggal TEXT NOT NULL,
        totalHarga REAL NOT NULL,
        metodePembayaran TEXT NOT NULL,
        statusPembayaran TEXT NOT NULL DEFAULT 'lunas',
        catatan TEXT,
        dibuat TEXT NOT NULL,
        diperbarui TEXT NOT NULL,
        server_id TEXT,
        device_id TEXT,
        version INTEGER NOT NULL DEFAULT 1,
        sync_status TEXT NOT NULL DEFAULT 'pending',
        deleted_at TEXT
      );

      CREATE TABLE IF NOT EXISTS detail_transaksi (
        id TEXT PRIMARY KEY,
        transaksiId TEXT NOT NULL,
        tipeItem TEXT NOT NULL,
        itemId TEXT NOT NULL,
        namaItem TEXT NOT NULL,
        jumlah INTEGER NOT NULL,
        hargaSatuan REAL NOT NULL,
        subtotal REAL NOT NULL,
        catatan TEXT,
        dibuat TEXT NOT NULL,
        server_id TEXT,
        device_id TEXT,
        version INTEGER NOT NULL DEFAULT 1,
        sync_status TEXT NOT NULL DEFAULT 'pending',
        deleted_at TEXT,
        FOREIGN KEY (transaksiId) REFERENCES transaksi(id)
      );

      CREATE TABLE IF NOT EXISTS pesanan_kue (
        id TEXT PRIMARY KEY,
        nomorPesanan TEXT NOT NULL UNIQUE,
        namaPelanggan TEXT NOT NULL,
        noHp TEXT,
        jenisKue TEXT NOT NULL,
        variasiKue TEXT,
        ukuranKue TEXT NOT NULL,
        kotakKue TEXT,
        aksesorisKue TEXT,
        tulisanKue TEXT,
        warnaTema TEXT,
        tanggalPesan TEXT NOT NULL,
        tanggalAmbil TEXT NOT NULL,
        totalHarga REAL NOT NULL,
        dpBayar REAL NOT NULL DEFAULT 0,
        sisaPembayaran REAL NOT NULL,
        statusPesanan TEXT NOT NULL DEFAULT 'pending',
        metodePembayaran TEXT,
        catatan TEXT,
        gambarReferensi TEXT,
        dibuat TEXT NOT NULL,
        diperbarui TEXT NOT NULL,
        server_id TEXT,
        device_id TEXT,
        version INTEGER NOT NULL DEFAULT 1,
        sync_status TEXT NOT NULL DEFAULT 'pending',
        deleted_at TEXT
      );

      -- Sync Management Tables
      CREATE TABLE IF NOT EXISTS sync_queue (
        id TEXT PRIMARY KEY,
        table_name TEXT NOT NULL,
        record_id TEXT NOT NULL,
        operation TEXT NOT NULL,
        data TEXT NOT NULL,
        priority INTEGER NOT NULL DEFAULT 5,
        retry_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        processed_at TEXT,
        error_message TEXT
      );

      CREATE TABLE IF NOT EXISTS sync_log (
        id TEXT PRIMARY KEY,
        sync_type TEXT NOT NULL,
        status TEXT NOT NULL,
        records_pushed INTEGER NOT NULL DEFAULT 0,
        records_pulled INTEGER NOT NULL DEFAULT 0,
        conflicts INTEGER NOT NULL DEFAULT 0,
        error_message TEXT,
        started_at TEXT NOT NULL,
        completed_at TEXT
      );

      CREATE TABLE IF NOT EXISTS device_info (
        device_id TEXT PRIMARY KEY,
        device_name TEXT,
        device_type TEXT,
        api_key TEXT,
        registered_at TEXT,
        last_sync_at TEXT
      );

      CREATE TABLE IF NOT EXISTS pengaturan (
        id TEXT PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        value TEXT NOT NULL,
        dibuat TEXT NOT NULL,
        diperbarui TEXT NOT NULL
      );

      -- Create indexes for sync columns
      CREATE INDEX IF NOT EXISTS idx_produk_sync_status ON produk(sync_status);
      CREATE INDEX IF NOT EXISTS idx_produk_updated ON produk(diperbarui);
      CREATE INDEX IF NOT EXISTS idx_kue_ready_sync_status ON kue_ready(sync_status);
      CREATE INDEX IF NOT EXISTS idx_kue_ready_updated ON kue_ready(diperbarui);
      CREATE INDEX IF NOT EXISTS idx_transaksi_sync_status ON transaksi(sync_status);
      CREATE INDEX IF NOT EXISTS idx_transaksi_updated ON transaksi(diperbarui);
      CREATE INDEX IF NOT EXISTS idx_pesanan_sync_status ON pesanan_kue(sync_status);
      CREATE INDEX IF NOT EXISTS idx_pesanan_updated ON pesanan_kue(diperbarui);
      CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(processed_at);
    `);

    console.log("Tabel-tabel berhasil dibuat");
  }

  // ============================================================
  // SYNC MIGRATIONS (Safe to run multiple times)
  // ============================================================

  private async runSyncMigrations(): Promise<void> {
    if (!this.db) return;

    // Add sync columns to existing tables if they don't exist
    const tablesToMigrate = [
      "produk",
      "kue_ready",
      "transaksi",
      "detail_transaksi",
      "pesanan_kue",
    ];
    const syncColumns = [
      { name: "server_id", type: "TEXT" },
      { name: "device_id", type: "TEXT" },
      { name: "version", type: "INTEGER DEFAULT 1" },
      { name: "sync_status", type: "TEXT DEFAULT 'pending'" },
      { name: "deleted_at", type: "TEXT" },
    ];

    for (const table of tablesToMigrate) {
      for (const col of syncColumns) {
        try {
          // Check if column exists first using PRAGMA
          const tableInfo = await this.db.getAllAsync<{ name: string }>(
            `PRAGMA table_info(${table})`
          );

          const columnExists = tableInfo.some((info) => info.name === col.name);

          if (!columnExists) {
            await this.db.execAsync(
              `ALTER TABLE ${table} ADD COLUMN ${col.name} ${col.type};`
            );
            console.log(`Added column ${col.name} to ${table}`);
          }
        } catch (error: any) {
          // Column already exists or other error, just log and continue
          if (!error.message?.includes("duplicate column")) {
            console.warn(
              `Migration warning for ${table}.${col.name}:`,
              error.message
            );
          }
        }
      }
    }
  }

  // ============================================================
  // DEVICE INFO METHODS
  // ============================================================

  async getDeviceInfo(): Promise<DeviceInfo | null> {
    if (!this.db || !this.deviceId) return null;

    const result = await this.db.getFirstAsync<DeviceInfo>(
      "SELECT * FROM device_info WHERE device_id = ?",
      [this.deviceId]
    );
    return result || null;
  }

  async saveDeviceInfo(info: {
    deviceName?: string;
    deviceType?: string;
    apiKey?: string;
  }): Promise<void> {
    if (!this.db || !this.deviceId) return;

    const existing = await this.getDeviceInfo();
    const now = new Date().toISOString();

    if (existing) {
      await this.db.runAsync(
        `UPDATE device_info SET 
          device_name = COALESCE(?, device_name),
          device_type = COALESCE(?, device_type),
          api_key = COALESCE(?, api_key),
          last_sync_at = ?
        WHERE device_id = ?`,
        [info.deviceName, info.deviceType, info.apiKey, now, this.deviceId]
      );
    } else {
      await this.db.runAsync(
        `INSERT INTO device_info (device_id, device_name, device_type, api_key, registered_at, last_sync_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [this.deviceId, info.deviceName, info.deviceType, info.apiKey, now, now]
      );
    }
  }

  async getApiKey(): Promise<string | null> {
    const info = await this.getDeviceInfo();
    return info?.api_key || null;
  }

  async updateLastSyncTime(): Promise<void> {
    if (!this.db || !this.deviceId) return;

    const now = new Date().toISOString();
    await this.db.runAsync(
      "UPDATE device_info SET last_sync_at = ? WHERE device_id = ?",
      [now, this.deviceId]
    );
  }

  // ============================================================
  // SYNC QUEUE METHODS
  // ============================================================

  async addToSyncQueue(
    item: Omit<SyncQueueItem, "id" | "created_at" | "retry_count">
  ): Promise<void> {
    if (!this.db) return;

    const id = uuid.v4().toString();
    const now = new Date().toISOString();

    await this.db.runAsync(
      `INSERT INTO sync_queue (id, table_name, record_id, operation, data, priority, retry_count, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
      [
        id,
        item.table_name,
        item.record_id,
        item.operation,
        item.data,
        item.priority || 5,
        now,
      ]
    );
  }

  async getPendingSyncItems(limit: number = 50): Promise<SyncQueueItem[]> {
    if (!this.db) return [];

    const results = await this.db.getAllAsync<SyncQueueItem>(
      `SELECT * FROM sync_queue 
       WHERE processed_at IS NULL AND retry_count < 3
       ORDER BY priority DESC, created_at ASC
       LIMIT ?`,
      [limit]
    );
    return results;
  }

  async markSyncItemProcessed(id: string, error?: string): Promise<void> {
    if (!this.db) return;

    const now = new Date().toISOString();

    if (error) {
      await this.db.runAsync(
        "UPDATE sync_queue SET retry_count = retry_count + 1, error_message = ? WHERE id = ?",
        [error, id]
      );
    } else {
      await this.db.runAsync(
        "UPDATE sync_queue SET processed_at = ? WHERE id = ?",
        [now, id]
      );
    }
  }

  async getSyncQueueCount(): Promise<number> {
    if (!this.db) return 0;

    const result = await this.db.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) as count FROM sync_queue WHERE processed_at IS NULL"
    );
    return result?.count || 0;
  }

  async clearProcessedSyncItems(): Promise<void> {
    if (!this.db) return;

    await this.db.runAsync(
      "DELETE FROM sync_queue WHERE processed_at IS NOT NULL AND processed_at < datetime('now', '-24 hours')"
    );
  }

  async clearAllSyncQueue(): Promise<void> {
    if (!this.db) return;
    await this.db.runAsync("DELETE FROM sync_queue");
  }

  async retryFailedSyncItems(): Promise<void> {
    if (!this.db) return;

    await this.db.runAsync(
      "UPDATE sync_queue SET retry_count = 0, error_message = NULL WHERE processed_at IS NULL AND retry_count >= 3"
    );
  }

  // ============================================================
  // SYNC STATUS METHODS
  // ============================================================

  async getUnsyncedRecords(tableName: string): Promise<any[]> {
    if (!this.db) return [];

    const results = await this.db.getAllAsync(
      `SELECT * FROM ${tableName} WHERE sync_status = 'pending' AND deleted_at IS NULL`
    );
    return results;
  }

  async markRecordAsSynced(
    tableName: string,
    recordId: string,
    serverId: string
  ): Promise<void> {
    if (!this.db) return;

    await this.db.runAsync(
      `UPDATE ${tableName} SET sync_status = 'synced', server_id = ? WHERE id = ?`,
      [serverId, recordId]
    );
  }

  async markRecordAsConflict(
    tableName: string,
    recordId: string
  ): Promise<void> {
    if (!this.db) return;

    await this.db.runAsync(
      `UPDATE ${tableName} SET sync_status = 'conflict' WHERE id = ?`,
      [recordId]
    );
  }

  async incrementVersion(tableName: string, recordId: string): Promise<void> {
    if (!this.db) return;

    await this.db.runAsync(
      `UPDATE ${tableName} SET version = version + 1, sync_status = 'pending' WHERE id = ?`,
      [recordId]
    );
  }

  async getRecordByServerId(
    tableName: string,
    serverId: string
  ): Promise<any | null> {
    if (!this.db) return null;

    const result = await this.db.getFirstAsync(
      `SELECT * FROM ${tableName} WHERE server_id = ?`,
      [serverId]
    );
    return result;
  }

  // ============================================================
  // SYNC LOG METHODS
  // ============================================================

  async addSyncLog(log: Omit<SyncLog, "id">): Promise<string> {
    if (!this.db) return "";

    const id = uuid.v4().toString();
    await this.db.runAsync(
      `INSERT INTO sync_log (id, sync_type, status, records_pushed, records_pulled, conflicts, error_message, started_at, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        log.sync_type,
        log.status,
        log.records_pushed,
        log.records_pulled,
        log.conflicts,
        log.error_message,
        log.started_at,
        log.completed_at,
      ]
    );
    return id;
  }

  async getLastSyncLog(): Promise<SyncLog | null> {
    if (!this.db) return null;

    const result = await this.db.getFirstAsync<SyncLog>(
      "SELECT * FROM sync_log ORDER BY started_at DESC LIMIT 1"
    );
    return result || null;
  }

  async getSyncStats(): Promise<{
    totalPushed: number;
    totalPulled: number;
    totalConflicts: number;
    lastSync: string | null;
  }> {
    if (!this.db)
      return {
        totalPushed: 0,
        totalPulled: 0,
        totalConflicts: 0,
        lastSync: null,
      };

    const stats = await this.db.getFirstAsync<{
      totalPushed: number;
      totalPulled: number;
      totalConflicts: number;
    }>(
      `SELECT 
        COALESCE(SUM(records_pushed), 0) as totalPushed,
        COALESCE(SUM(records_pulled), 0) as totalPulled,
        COALESCE(SUM(conflicts), 0) as totalConflicts
       FROM sync_log WHERE status = 'success'`
    );

    const lastSync = await this.db.getFirstAsync<{ completed_at: string }>(
      "SELECT completed_at FROM sync_log WHERE status = 'success' ORDER BY completed_at DESC LIMIT 1"
    );

    return {
      totalPushed: stats?.totalPushed || 0,
      totalPulled: stats?.totalPulled || 0,
      totalConflicts: stats?.totalConflicts || 0,
      lastSync: lastSync?.completed_at || null,
    };
  }

  // ============================================================
  // MASTER DATA METHODS (Read-only, synced from server)
  // ============================================================

  async upsertMasterData(tableName: string, data: any[]): Promise<void> {
    if (!this.db) return;

    for (const item of data) {
      const columns = Object.keys(item);
      const values = Object.values(item);
      const placeholders = columns.map(() => "?").join(", ");
      const updateClauses = columns
        .map((col) => `${col} = excluded.${col}`)
        .join(", ");

      await this.db.runAsync(
        `INSERT INTO ${tableName} (${columns.join(
          ", "
        )}) VALUES (${placeholders})
         ON CONFLICT(id) DO UPDATE SET ${updateClauses}`,
        values
      );
    }
  }

  // ============================================================
  // SEED DATA
  // ============================================================

  private async checkAndSeedData(): Promise<void> {
    if (!this.db) return;

    // Check if data already exists
    const existing = await this.db.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) as count FROM kategori_produk"
    );

    if ((existing?.count || 0) > 0) {
      this.isSeeded = true;
      return;
    }

    // Seed master data
    const now = new Date().toISOString();

    // Kategori Produk
    await this.db.runAsync(
      `INSERT INTO kategori_produk (id, nama, deskripsi, dibuat, diperbarui) VALUES 
        ('KP001', 'Kue Basah', 'Berbagai jenis kue basah', ?, ?),
        ('KP002', 'Kue Kering', 'Berbagai jenis kue kering', ?, ?),
        ('KP003', 'Roti', 'Berbagai jenis roti', ?, ?),
        ('KP004', 'Minuman', 'Berbagai jenis minuman', ?, ?),
        ('KP005', 'Lainnya', 'Produk lainnya', ?, ?)`,
      [now, now, now, now, now, now, now, now, now, now]
    );

    // Jenis Kue
    await this.db.runAsync(
      `INSERT INTO jenis_kue (id, nama, hargaBase, dibuat) VALUES 
        ('JK001', 'Sponge Cake', 80000, ?),
        ('JK002', 'Butter Cake', 90000, ?),
        ('JK003', 'Red Velvet', 120000, ?),
        ('JK004', 'Cheese Cake', 150000, ?),
        ('JK005', 'Black Forest', 110000, ?)`,
      [now, now, now, now, now]
    );

    // Variasi Kue
    await this.db.runAsync(
      `INSERT INTO variasi_kue (id, nama, hargaTambahan, dibuat) VALUES 
        ('VK001', 'Original', 0, ?),
        ('VK002', 'Coklat Chip', 15000, ?),
        ('VK003', 'Keju', 20000, ?),
        ('VK004', 'Buah-buahan', 25000, ?),
        ('VK005', 'Kombinasi', 30000, ?)`,
      [now, now, now, now, now]
    );

    // Ukuran Kue
    await this.db.runAsync(
      `INSERT INTO ukuran_kue (id, nama, multiplierHarga, dibuat) VALUES 
        ('UK001', 'Mini (10cm)', 0.5, ?),
        ('UK002', 'Small (15cm)', 1.0, ?),
        ('UK003', 'Medium (18cm)', 1.5, ?),
        ('UK004', 'Large (22cm)', 2.0, ?),
        ('UK005', 'XL (26cm)', 2.5, ?)`,
      [now, now, now, now, now]
    );

    // Kotak Kue
    await this.db.runAsync(
      `INSERT INTO kotak_kue (id, nama, hargaTambahan, dibuat) VALUES 
        ('KK001', 'Kotak Biasa', 5000, ?),
        ('KK002', 'Kotak Premium', 10000, ?),
        ('KK003', 'Kotak Eksklusif', 15000, ?),
        ('KK004', 'Tanpa Kotak', 0, ?)`,
      [now, now, now, now]
    );

    // Aksesoris Kue
    await this.db.runAsync(
      `INSERT INTO aksesoris_kue (id, nama, harga, dibuat) VALUES 
        ('AK001', 'Lilin Angka', 5000, ?),
        ('AK002', 'Topper Kustom', 10000, ?),
        ('AK003', 'Edible Flowers', 15000, ?),
        ('AK004', 'Ribbon', 3000, ?),
        ('AK005', 'Kartu Ucapan', 5000, ?)`,
      [now, now, now, now, now]
    );

    this.isSeeded = true;
    console.log("Data master berhasil di-seed");
  }

  // ============================================================
  // PRODUK CRUD with Sync Support
  // ============================================================

  async getAllProduk(): Promise<Produk[]> {
    if (!this.db) return [];
    const results = await this.db.getAllAsync<Produk>(
      "SELECT * FROM produk WHERE deleted_at IS NULL ORDER BY nama"
    );
    return results;
  }

  async createProduk(
    produk: Omit<
      Produk,
      "id" | "dibuat" | "diperbarui" | "version" | "sync_status"
    >
  ): Promise<Produk> {
    if (!this.db) throw new Error("Database not initialized");

    const id = uuid.v4().toString();
    const now = new Date().toISOString();

    await this.db.runAsync(
      `INSERT INTO produk (id, nama, harga, stok, kategoriId, gambarPath, dibuat, diperbarui, device_id, version, sync_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'pending')`,
      [
        id,
        produk.nama,
        produk.harga,
        produk.stok,
        produk.kategoriId,
        produk.gambarPath,
        now,
        now,
        this.deviceId,
      ]
    );

    // Add to sync queue
    const newProduk: Produk = {
      id,
      ...produk,
      dibuat: now,
      diperbarui: now,
      device_id: this.deviceId || undefined,
      version: 1,
      sync_status: "pending",
    };

    await this.addToSyncQueue({
      table_name: "produk",
      record_id: id,
      operation: "INSERT",
      data: JSON.stringify(newProduk),
      priority: 5,
    });

    return newProduk;
  }

  async updateProduk(id: string, updates: Partial<Produk>): Promise<void> {
    if (!this.db) return;

    const now = new Date().toISOString();
    const fields: string[] = [];
    const values: any[] = [];

    Object.entries(updates).forEach(([key, value]) => {
      if (
        key !== "id" &&
        key !== "dibuat" &&
        key !== "version" &&
        key !== "sync_status"
      ) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    });

    fields.push(
      "diperbarui = ?",
      "version = version + 1",
      "sync_status = 'pending'"
    );
    values.push(now, id);

    await this.db.runAsync(
      `UPDATE produk SET ${fields.join(", ")} WHERE id = ?`,
      values
    );

    // Add to sync queue
    const updated = await this.db.getFirstAsync<Produk>(
      "SELECT * FROM produk WHERE id = ?",
      [id]
    );
    if (updated) {
      await this.addToSyncQueue({
        table_name: "produk",
        record_id: id,
        operation: "UPDATE",
        data: JSON.stringify(updated),
        priority: 5,
      });
    }
  }

  async deleteProduk(id: string): Promise<void> {
    if (!this.db) return;

    const now = new Date().toISOString();

    // Soft delete
    await this.db.runAsync(
      "UPDATE produk SET deleted_at = ?, sync_status = 'pending', version = version + 1 WHERE id = ?",
      [now, id]
    );

    await this.addToSyncQueue({
      table_name: "produk",
      record_id: id,
      operation: "DELETE",
      data: JSON.stringify({ id, deleted_at: now }),
      priority: 5,
    });
  }

  // ============================================================
  // KUE READY CRUD with Sync Support
  // ============================================================

  async getAllKueReady(): Promise<KueReady[]> {
    if (!this.db) return [];
    const results = await this.db.getAllAsync<KueReady>(
      "SELECT * FROM kue_ready WHERE deleted_at IS NULL ORDER BY dibuat DESC"
    );
    return results;
  }

  async createKueReady(
    kue: Omit<
      KueReady,
      "id" | "dibuat" | "diperbarui" | "version" | "sync_status"
    >
  ): Promise<KueReady> {
    if (!this.db) throw new Error("Database not initialized");

    const id = uuid.v4().toString();
    const now = new Date().toISOString();

    await this.db.runAsync(
      `INSERT INTO kue_ready (id, nama, jenisKue, variasiKue, ukuranKue, hargaJual, gambarPath, status, catatan, dibuat, diperbarui, device_id, version, sync_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'pending')`,
      [
        id,
        kue.nama,
        kue.jenisKue,
        kue.variasiKue,
        kue.ukuranKue,
        kue.hargaJual,
        kue.gambarPath,
        kue.status || "tersedia",
        kue.catatan,
        now,
        now,
        this.deviceId,
      ]
    );

    const newKue: KueReady = {
      id,
      ...kue,
      status: kue.status || "tersedia",
      dibuat: now,
      diperbarui: now,
      device_id: this.deviceId || undefined,
      version: 1,
      sync_status: "pending",
    };

    await this.addToSyncQueue({
      table_name: "kue_ready",
      record_id: id,
      operation: "INSERT",
      data: JSON.stringify(newKue),
      priority: 5,
    });

    return newKue;
  }

  async updateKueReady(id: string, updates: Partial<KueReady>): Promise<void> {
    if (!this.db) return;

    const now = new Date().toISOString();
    const fields: string[] = [];
    const values: any[] = [];

    Object.entries(updates).forEach(([key, value]) => {
      if (
        key !== "id" &&
        key !== "dibuat" &&
        key !== "version" &&
        key !== "sync_status"
      ) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    });

    fields.push(
      "diperbarui = ?",
      "version = version + 1",
      "sync_status = 'pending'"
    );
    values.push(now, id);

    await this.db.runAsync(
      `UPDATE kue_ready SET ${fields.join(", ")} WHERE id = ?`,
      values
    );

    const updated = await this.db.getFirstAsync<KueReady>(
      "SELECT * FROM kue_ready WHERE id = ?",
      [id]
    );
    if (updated) {
      await this.addToSyncQueue({
        table_name: "kue_ready",
        record_id: id,
        operation: "UPDATE",
        data: JSON.stringify(updated),
        priority: 5,
      });
    }
  }

  async deleteKueReady(id: string): Promise<void> {
    if (!this.db) return;

    const now = new Date().toISOString();

    await this.db.runAsync(
      "UPDATE kue_ready SET deleted_at = ?, sync_status = 'pending', version = version + 1 WHERE id = ?",
      [now, id]
    );

    await this.addToSyncQueue({
      table_name: "kue_ready",
      record_id: id,
      operation: "DELETE",
      data: JSON.stringify({ id, deleted_at: now }),
      priority: 5,
    });
  }

  // ============================================================
  // MASTER DATA GETTERS
  // ============================================================

  async getAllKategoriProduk(): Promise<KategoriProduk[]> {
    if (!this.db) return [];
    return this.db.getAllAsync<KategoriProduk>(
      "SELECT * FROM kategori_produk ORDER BY nama"
    );
  }

  async createKategori(
    kategori: Omit<KategoriProduk, "id" | "dibuat" | "diperbarui">
  ): Promise<KategoriProduk> {
    if (!this.db) throw new Error("Database not initialized");

    const id = uuid.v4().toString();
    const now = new Date().toISOString();

    await this.db.runAsync(
      `INSERT INTO kategori_produk (id, nama, deskripsi, dibuat, diperbarui)
       VALUES (?, ?, ?, ?, ?)`,
      [id, kategori.nama, kategori.deskripsi || null, now, now]
    );

    return {
      id,
      nama: kategori.nama,
      deskripsi: kategori.deskripsi,
      dibuat: now,
      diperbarui: now,
    };
  }

  async updateKategori(
    id: string,
    updates: Partial<KategoriProduk>
  ): Promise<void> {
    if (!this.db) return;

    const now = new Date().toISOString();
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.nama !== undefined) {
      fields.push("nama = ?");
      values.push(updates.nama);
    }
    if (updates.deskripsi !== undefined) {
      fields.push("deskripsi = ?");
      values.push(updates.deskripsi);
    }

    fields.push("diperbarui = ?");
    values.push(now, id);

    await this.db.runAsync(
      `UPDATE kategori_produk SET ${fields.join(", ")} WHERE id = ?`,
      values
    );
  }

  async deleteKategori(id: string): Promise<void> {
    if (!this.db) return;
    await this.db.runAsync("DELETE FROM kategori_produk WHERE id = ?", [id]);
  }

  async getAllJenisKue(): Promise<JenisKue[]> {
    if (!this.db) return [];
    return this.db.getAllAsync<JenisKue>(
      "SELECT * FROM jenis_kue ORDER BY nama"
    );
  }

  async getAllVariasiKue(): Promise<VariasiKue[]> {
    if (!this.db) return [];
    return this.db.getAllAsync<VariasiKue>(
      "SELECT * FROM variasi_kue ORDER BY nama"
    );
  }

  async getAllUkuranKue(): Promise<UkuranKue[]> {
    if (!this.db) return [];
    return this.db.getAllAsync<UkuranKue>(
      "SELECT * FROM ukuran_kue ORDER BY multiplierHarga"
    );
  }

  async getAllKotakKue(): Promise<KotakKue[]> {
    if (!this.db) return [];
    return this.db.getAllAsync<KotakKue>(
      "SELECT * FROM kotak_kue ORDER BY hargaTambahan"
    );
  }

  async getAllAksesorisKue(): Promise<AksesorisKue[]> {
    if (!this.db) return [];
    return this.db.getAllAsync<AksesorisKue>(
      "SELECT * FROM aksesoris_kue ORDER BY nama"
    );
  }

  // ============================================================
  // PENGATURAN (Settings)
  // ============================================================

  async getSetting(key: string): Promise<string | null> {
    if (!this.db) return null;
    const result = await this.db.getFirstAsync<Pengaturan>(
      "SELECT * FROM pengaturan WHERE key = ?",
      [key]
    );
    return result?.value || null;
  }

  async setSetting(key: string, value: string): Promise<void> {
    if (!this.db) return;

    const now = new Date().toISOString();
    const existing = await this.getSetting(key);

    if (existing !== null) {
      await this.db.runAsync(
        "UPDATE pengaturan SET value = ?, diperbarui = ? WHERE key = ?",
        [value, now, key]
      );
    } else {
      await this.db.runAsync(
        "INSERT INTO pengaturan (id, key, value, dibuat, diperbarui) VALUES (?, ?, ?, ?, ?)",
        [uuid.v4().toString(), key, value, now, now]
      );
    }
  }

  // ============================================================
  // GENERIC QUERY METHODS (for sync operations)
  // ============================================================

  async query<T>(sql: string, params: any[] = []): Promise<T[]> {
    if (!this.db) return [];
    return this.db.getAllAsync<T>(sql, params);
  }

  async run(sql: string, params: any[] = []): Promise<void> {
    if (!this.db) return;
    await this.db.runAsync(sql, params);
  }

  async getFirst<T>(sql: string, params: any[] = []): Promise<T | null> {
    if (!this.db) return null;
    return this.db.getFirstAsync<T>(sql, params) || null;
  }

  // ============================================================
  // UTILITY METHODS
  // ============================================================

  /**
   * Generate a unique ID
   */
  generateId(): string {
    return uuid.v4().toString();
  }

  /**
   * Get current timestamp in ISO format
   */
  getCurrentTimestamp(): string {
    return new Date().toISOString();
  }

  /**
   * Delete a file (for cleaning up images etc)
   */
  async deleteFile(filePath: string): Promise<void> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(filePath, { idempotent: true });
      }
    } catch (error) {
      console.warn("Failed to delete file:", filePath, error);
    }
  }

  // ============================================================
  // BACKWARD COMPATIBILITY METHODS
  // ============================================================

  /**
   * Get raw database instance (for backward compatibility)
   */
  getDatabase(): SQLite.SQLiteDatabase | null {
    return this.db;
  }

  /**
   * Alias for query() - backward compatibility
   */
  async getAll<T>(sql: string, params: any[] = []): Promise<T[]> {
    return this.query<T>(sql, params);
  }

  /**
   * Alias for getFirst() - backward compatibility
   */
  async getOne<T>(sql: string, params: any[] = []): Promise<T | null> {
    return this.getFirst<T>(sql, params);
  }

  /**
   * Execute SQL and return result with changes count
   */
  async executeQuery(
    sql: string,
    params: any[] = []
  ): Promise<{ changes: number; insertId?: number }> {
    if (!this.db) return { changes: 0 };
    const result = await this.db.runAsync(sql, params);
    return {
      changes: result.changes,
      insertId: result.lastInsertRowId,
    };
  }

  /**
   * Generate unique ID
   */
  generateId(): string {
    return uuid.v4().toString();
  }

  /**
   * Get current timestamp in ISO format
   */
  getCurrentTimestamp(): string {
    return new Date().toISOString();
  }

  /**
   * Delete file (placeholder - implement with expo-file-system if needed)
   */
  async deleteFile(filePath: string): Promise<void> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(filePath, { idempotent: true });
      }
    } catch (error) {
      console.warn("Failed to delete file:", filePath, error);
    }
  }

  /**
   * Execute raw SQL (for transactions, etc)
   */
  async execAsync(sql: string): Promise<void> {
    if (!this.db) return;
    await this.db.execAsync(sql);
  }

  // ============================================================
  // DATABASE LIFECYCLE
  // ============================================================

  async close(): Promise<void> {
    if (this.db) {
      await this.db.closeAsync();
      this.db = null;
      console.log("Database ditutup");
    }
  }
}

// Export singleton instance
export const sqliteService = new SQLiteService();
