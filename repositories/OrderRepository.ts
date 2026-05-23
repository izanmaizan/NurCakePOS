/**
 * OrderRepository.ts
 * Repository untuk mengelola pesanan kue (pesanan_kue) dengan dukungan sync
 *
 * Path: src/repositories/OrderRepository.ts
 */

import { SYNC_CONFIG } from "../config/sync.config";
import { SQLiteService } from "../database/SQLiteService";
import { SyncOperation, SyncStatus } from "../types/sync";
import { generateUUID, getCurrentTimestamp } from "../utils/helpers";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface AksesorisItem {
  id: number;
  nama: string;
  harga: number;
  jumlah: number;
}

export interface Order {
  id?: number;
  client_id: string;
  device_id: string;
  nomor_pesanan: string;
  nama_pemesan: string;
  no_hp: string;
  tanggal_pesan: string;
  tanggal_ambil: string;
  waktu_ambil: string;

  // Cake details
  jenis_kue_id: number;
  jenis_kue_nama?: string;
  variasi_kue_id: number;
  variasi_kue_nama?: string;
  ukuran_kue_id: number;
  ukuran_kue_nama?: string;
  kotak_kue_id: number;
  kotak_kue_nama?: string;

  // Customization
  tulisan_kue: string | null;
  catatan: string | null;
  aksesoris: AksesorisItem[] | string | null;

  // Pricing
  harga_dasar: number;
  harga_variasi: number;
  multiplier_ukuran: number;
  harga_kotak: number;
  harga_aksesoris: number;
  total_harga: number;

  // Payment
  dp: number;
  sisa_bayar: number;
  status_pembayaran: "belum_bayar" | "dp" | "lunas";

  // Order status
  status_pesanan: "pending" | "diproses" | "siap" | "diambil" | "dibatalkan";

  // Sync fields
  version: number;
  sync_status: SyncStatus;
  last_synced_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateOrderInput {
  nama_pemesan: string;
  no_hp: string;
  tanggal_ambil: string;
  waktu_ambil: string;
  jenis_kue_id: number;
  variasi_kue_id: number;
  ukuran_kue_id: number;
  kotak_kue_id: number;
  tulisan_kue?: string | null;
  catatan?: string | null;
  aksesoris?: AksesorisItem[] | null;
  dp?: number;
}

export interface UpdateOrderInput {
  nama_pemesan?: string;
  no_hp?: string;
  tanggal_ambil?: string;
  waktu_ambil?: string;
  jenis_kue_id?: number;
  variasi_kue_id?: number;
  ukuran_kue_id?: number;
  kotak_kue_id?: number;
  tulisan_kue?: string | null;
  catatan?: string | null;
  aksesoris?: AksesorisItem[] | null;
  dp?: number;
  status_pembayaran?: "belum_bayar" | "dp" | "lunas";
  status_pesanan?: "pending" | "diproses" | "siap" | "diambil" | "dibatalkan";
}

export interface OrderFilter {
  status_pesanan?: string | string[];
  status_pembayaran?: string | string[];
  tanggal_ambil_start?: string;
  tanggal_ambil_end?: string;
  tanggal_pesan_start?: string;
  tanggal_pesan_end?: string;
  search?: string;
  includeDeleted?: boolean;
}

// ============================================================================
// ORDER REPOSITORY CLASS
// ============================================================================

export class OrderRepository {
  private db: SQLiteService;
  private deviceId: string;

  constructor(db: SQLiteService, deviceId: string) {
    this.db = db;
    this.deviceId = deviceId;
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  /**
   * Generate nomor pesanan dengan format: ORD-YYYYMMDD-XXXX
   */
  private async generateOrderNumber(): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
    const prefix = `ORD-${dateStr}-`;

    // Get last order number for today
    const result = await this.db.executeSql(
      `SELECT nomor_pesanan FROM pesanan_kue 
       WHERE nomor_pesanan LIKE ? 
       ORDER BY nomor_pesanan DESC LIMIT 1`,
      [`${prefix}%`]
    );

    let sequence = 1;
    if (result.rows.length > 0) {
      const lastNumber = result.rows.item(0).nomor_pesanan;
      const lastSeq = parseInt(lastNumber.split("-").pop() || "0", 10);
      sequence = lastSeq + 1;
    }

    return `${prefix}${sequence.toString().padStart(4, "0")}`;
  }

  /**
   * Calculate pricing based on selected options
   */
  private async calculatePricing(
    input: CreateOrderInput | UpdateOrderInput
  ): Promise<{
    harga_dasar: number;
    harga_variasi: number;
    multiplier_ukuran: number;
    harga_kotak: number;
    harga_aksesoris: number;
    total_harga: number;
  }> {
    let harga_dasar = 0;
    let harga_variasi = 0;
    let multiplier_ukuran = 1;
    let harga_kotak = 0;
    let harga_aksesoris = 0;

    // Get jenis kue price
    if (input.jenis_kue_id) {
      const jenis = await this.db.executeSql(
        "SELECT harga_dasar FROM jenis_kue WHERE id = ?",
        [input.jenis_kue_id]
      );
      if (jenis.rows.length > 0) {
        harga_dasar = jenis.rows.item(0).harga_dasar || 0;
      }
    }

    // Get variasi price
    if (input.variasi_kue_id) {
      const variasi = await this.db.executeSql(
        "SELECT harga_tambahan FROM variasi_kue WHERE id = ?",
        [input.variasi_kue_id]
      );
      if (variasi.rows.length > 0) {
        harga_variasi = variasi.rows.item(0).harga_tambahan || 0;
      }
    }

    // Get ukuran multiplier
    if (input.ukuran_kue_id) {
      const ukuran = await this.db.executeSql(
        "SELECT multiplier FROM ukuran_kue WHERE id = ?",
        [input.ukuran_kue_id]
      );
      if (ukuran.rows.length > 0) {
        multiplier_ukuran = ukuran.rows.item(0).multiplier || 1;
      }
    }

    // Get kotak price
    if (input.kotak_kue_id) {
      const kotak = await this.db.executeSql(
        "SELECT harga FROM kotak_kue WHERE id = ?",
        [input.kotak_kue_id]
      );
      if (kotak.rows.length > 0) {
        harga_kotak = kotak.rows.item(0).harga || 0;
      }
    }

    // Calculate aksesoris total
    if (input.aksesoris && Array.isArray(input.aksesoris)) {
      harga_aksesoris = input.aksesoris.reduce((sum, item) => {
        return sum + item.harga * item.jumlah;
      }, 0);
    }

    // Calculate total
    const total_harga = Math.round(
      (harga_dasar + harga_variasi) * multiplier_ukuran +
        harga_kotak +
        harga_aksesoris
    );

    return {
      harga_dasar,
      harga_variasi,
      multiplier_ukuran,
      harga_kotak,
      harga_aksesoris,
      total_harga,
    };
  }

  /**
   * Parse aksesoris from string or array
   */
  private parseAksesoris(
    aksesoris: string | AksesorisItem[] | null
  ): AksesorisItem[] {
    if (!aksesoris) return [];
    if (Array.isArray(aksesoris)) return aksesoris;
    try {
      return JSON.parse(aksesoris);
    } catch {
      return [];
    }
  }

  /**
   * Map database row to Order object
   */
  private mapRowToOrder(row: any): Order {
    return {
      id: row.id,
      client_id: row.client_id,
      device_id: row.device_id,
      nomor_pesanan: row.nomor_pesanan,
      nama_pemesan: row.nama_pemesan,
      no_hp: row.no_hp,
      tanggal_pesan: row.tanggal_pesan,
      tanggal_ambil: row.tanggal_ambil,
      waktu_ambil: row.waktu_ambil,
      jenis_kue_id: row.jenis_kue_id,
      jenis_kue_nama: row.jenis_kue_nama,
      variasi_kue_id: row.variasi_kue_id,
      variasi_kue_nama: row.variasi_kue_nama,
      ukuran_kue_id: row.ukuran_kue_id,
      ukuran_kue_nama: row.ukuran_kue_nama,
      kotak_kue_id: row.kotak_kue_id,
      kotak_kue_nama: row.kotak_kue_nama,
      tulisan_kue: row.tulisan_kue,
      catatan: row.catatan,
      aksesoris: this.parseAksesoris(row.aksesoris),
      harga_dasar: row.harga_dasar,
      harga_variasi: row.harga_variasi,
      multiplier_ukuran: row.multiplier_ukuran,
      harga_kotak: row.harga_kotak,
      harga_aksesoris: row.harga_aksesoris,
      total_harga: row.total_harga,
      dp: row.dp,
      sisa_bayar: row.sisa_bayar,
      status_pembayaran: row.status_pembayaran,
      status_pesanan: row.status_pesanan,
      version: row.version,
      sync_status: row.sync_status,
      last_synced_at: row.last_synced_at,
      deleted_at: row.deleted_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  // ==========================================================================
  // CRUD OPERATIONS
  // ==========================================================================

  /**
   * Create new order
   */
  async createOrder(input: CreateOrderInput): Promise<Order> {
    const client_id = generateUUID();
    const nomor_pesanan = await this.generateOrderNumber();
    const timestamp = getCurrentTimestamp();
    const pricing = await this.calculatePricing(input);

    const dp = input.dp || 0;
    const sisa_bayar = pricing.total_harga - dp;
    const status_pembayaran =
      dp === 0 ? "belum_bayar" : dp >= pricing.total_harga ? "lunas" : "dp";

    const aksesorisJson = input.aksesoris
      ? JSON.stringify(input.aksesoris)
      : null;

    const sql = `
      INSERT INTO pesanan_kue (
        client_id, device_id, nomor_pesanan, nama_pemesan, no_hp,
        tanggal_pesan, tanggal_ambil, waktu_ambil,
        jenis_kue_id, variasi_kue_id, ukuran_kue_id, kotak_kue_id,
        tulisan_kue, catatan, aksesoris,
        harga_dasar, harga_variasi, multiplier_ukuran, harga_kotak, harga_aksesoris, total_harga,
        dp, sisa_bayar, status_pembayaran, status_pesanan,
        version, sync_status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      client_id,
      this.deviceId,
      nomor_pesanan,
      input.nama_pemesan,
      input.no_hp,
      timestamp.split("T")[0], // tanggal_pesan (date only)
      input.tanggal_ambil,
      input.waktu_ambil,
      input.jenis_kue_id,
      input.variasi_kue_id,
      input.ukuran_kue_id,
      input.kotak_kue_id,
      input.tulisan_kue || null,
      input.catatan || null,
      aksesorisJson,
      pricing.harga_dasar,
      pricing.harga_variasi,
      pricing.multiplier_ukuran,
      pricing.harga_kotak,
      pricing.harga_aksesoris,
      pricing.total_harga,
      dp,
      sisa_bayar,
      status_pembayaran,
      "pending", // status_pesanan
      1, // version
      SyncStatus.PENDING_SYNC,
      timestamp,
      timestamp,
    ];

    const result = await this.db.executeSql(sql, params);
    const orderId = result.insertId;

    // Add to sync queue
    await this.db.addToSyncQueue({
      table_name: "pesanan_kue",
      record_id: client_id,
      operation: SyncOperation.INSERT,
      data: {
        client_id,
        device_id: this.deviceId,
        nomor_pesanan,
        nama_pemesan: input.nama_pemesan,
        no_hp: input.no_hp,
        tanggal_pesan: timestamp.split("T")[0],
        tanggal_ambil: input.tanggal_ambil,
        waktu_ambil: input.waktu_ambil,
        jenis_kue_id: input.jenis_kue_id,
        variasi_kue_id: input.variasi_kue_id,
        ukuran_kue_id: input.ukuran_kue_id,
        kotak_kue_id: input.kotak_kue_id,
        tulisan_kue: input.tulisan_kue || null,
        catatan: input.catatan || null,
        aksesoris: input.aksesoris || null,
        harga_dasar: pricing.harga_dasar,
        harga_variasi: pricing.harga_variasi,
        multiplier_ukuran: pricing.multiplier_ukuran,
        harga_kotak: pricing.harga_kotak,
        harga_aksesoris: pricing.harga_aksesoris,
        total_harga: pricing.total_harga,
        dp,
        sisa_bayar,
        status_pembayaran,
        status_pesanan: "pending",
        version: 1,
        created_at: timestamp,
        updated_at: timestamp,
      },
      priority: SYNC_CONFIG.SYNC_PRIORITY.HIGH,
    });

    return this.getOrderById(orderId) as Promise<Order>;
  }

  /**
   * Update existing order
   */
  async updateOrder(
    id: number,
    input: UpdateOrderInput
  ): Promise<Order | null> {
    // Get existing order
    const existing = await this.getOrderById(id);
    if (!existing) return null;

    // Check if order is in terminal state
    if (
      existing.status_pesanan === "diambil" ||
      existing.status_pesanan === "dibatalkan"
    ) {
      throw new Error(
        `Pesanan sudah ${existing.status_pesanan}, tidak dapat diubah`
      );
    }

    const timestamp = getCurrentTimestamp();
    const newVersion = existing.version + 1;

    // Recalculate pricing if any pricing-related field changed
    let pricing = {
      harga_dasar: existing.harga_dasar,
      harga_variasi: existing.harga_variasi,
      multiplier_ukuran: existing.multiplier_ukuran,
      harga_kotak: existing.harga_kotak,
      harga_aksesoris: existing.harga_aksesoris,
      total_harga: existing.total_harga,
    };

    const pricingChanged =
      input.jenis_kue_id !== undefined ||
      input.variasi_kue_id !== undefined ||
      input.ukuran_kue_id !== undefined ||
      input.kotak_kue_id !== undefined ||
      input.aksesoris !== undefined;

    if (pricingChanged) {
      pricing = await this.calculatePricing({
        jenis_kue_id: input.jenis_kue_id ?? existing.jenis_kue_id,
        variasi_kue_id: input.variasi_kue_id ?? existing.variasi_kue_id,
        ukuran_kue_id: input.ukuran_kue_id ?? existing.ukuran_kue_id,
        kotak_kue_id: input.kotak_kue_id ?? existing.kotak_kue_id,
        aksesoris: input.aksesoris ?? (existing.aksesoris as AksesorisItem[]),
      } as CreateOrderInput);
    }

    // Calculate payment status
    const dp = input.dp ?? existing.dp;
    const sisa_bayar = pricing.total_harga - dp;
    let status_pembayaran =
      input.status_pembayaran ?? existing.status_pembayaran;

    // Auto-update payment status based on dp
    if (input.dp !== undefined) {
      if (dp === 0) {
        status_pembayaran = "belum_bayar";
      } else if (dp >= pricing.total_harga) {
        status_pembayaran = "lunas";
      } else {
        status_pembayaran = "dp";
      }
    }

    const aksesorisJson =
      input.aksesoris !== undefined
        ? JSON.stringify(input.aksesoris)
        : typeof existing.aksesoris === "string"
        ? existing.aksesoris
        : JSON.stringify(existing.aksesoris);

    const sql = `
      UPDATE pesanan_kue SET
        nama_pemesan = ?,
        no_hp = ?,
        tanggal_ambil = ?,
        waktu_ambil = ?,
        jenis_kue_id = ?,
        variasi_kue_id = ?,
        ukuran_kue_id = ?,
        kotak_kue_id = ?,
        tulisan_kue = ?,
        catatan = ?,
        aksesoris = ?,
        harga_dasar = ?,
        harga_variasi = ?,
        multiplier_ukuran = ?,
        harga_kotak = ?,
        harga_aksesoris = ?,
        total_harga = ?,
        dp = ?,
        sisa_bayar = ?,
        status_pembayaran = ?,
        status_pesanan = ?,
        version = ?,
        sync_status = ?,
        updated_at = ?
      WHERE id = ?
    `;

    const params = [
      input.nama_pemesan ?? existing.nama_pemesan,
      input.no_hp ?? existing.no_hp,
      input.tanggal_ambil ?? existing.tanggal_ambil,
      input.waktu_ambil ?? existing.waktu_ambil,
      input.jenis_kue_id ?? existing.jenis_kue_id,
      input.variasi_kue_id ?? existing.variasi_kue_id,
      input.ukuran_kue_id ?? existing.ukuran_kue_id,
      input.kotak_kue_id ?? existing.kotak_kue_id,
      input.tulisan_kue !== undefined
        ? input.tulisan_kue
        : existing.tulisan_kue,
      input.catatan !== undefined ? input.catatan : existing.catatan,
      aksesorisJson,
      pricing.harga_dasar,
      pricing.harga_variasi,
      pricing.multiplier_ukuran,
      pricing.harga_kotak,
      pricing.harga_aksesoris,
      pricing.total_harga,
      dp,
      sisa_bayar,
      status_pembayaran,
      input.status_pesanan ?? existing.status_pesanan,
      newVersion,
      SyncStatus.PENDING_SYNC,
      timestamp,
      id,
    ];

    await this.db.executeSql(sql, params);

    // Add to sync queue
    await this.db.addToSyncQueue({
      table_name: "pesanan_kue",
      record_id: existing.client_id,
      operation: SyncOperation.UPDATE,
      data: {
        client_id: existing.client_id,
        nama_pemesan: input.nama_pemesan ?? existing.nama_pemesan,
        no_hp: input.no_hp ?? existing.no_hp,
        tanggal_ambil: input.tanggal_ambil ?? existing.tanggal_ambil,
        waktu_ambil: input.waktu_ambil ?? existing.waktu_ambil,
        jenis_kue_id: input.jenis_kue_id ?? existing.jenis_kue_id,
        variasi_kue_id: input.variasi_kue_id ?? existing.variasi_kue_id,
        ukuran_kue_id: input.ukuran_kue_id ?? existing.ukuran_kue_id,
        kotak_kue_id: input.kotak_kue_id ?? existing.kotak_kue_id,
        tulisan_kue:
          input.tulisan_kue !== undefined
            ? input.tulisan_kue
            : existing.tulisan_kue,
        catatan: input.catatan !== undefined ? input.catatan : existing.catatan,
        aksesoris: input.aksesoris ?? existing.aksesoris,
        harga_dasar: pricing.harga_dasar,
        harga_variasi: pricing.harga_variasi,
        multiplier_ukuran: pricing.multiplier_ukuran,
        harga_kotak: pricing.harga_kotak,
        harga_aksesoris: pricing.harga_aksesoris,
        total_harga: pricing.total_harga,
        dp,
        sisa_bayar,
        status_pembayaran,
        status_pesanan: input.status_pesanan ?? existing.status_pesanan,
        version: newVersion,
        updated_at: timestamp,
      },
      priority: SYNC_CONFIG.SYNC_PRIORITY.HIGH,
    });

    return this.getOrderById(id);
  }

  /**
   * Update order status only
   */
  async updateOrderStatus(
    id: number,
    status: "pending" | "diproses" | "siap" | "diambil" | "dibatalkan"
  ): Promise<Order | null> {
    const existing = await this.getOrderById(id);
    if (!existing) return null;

    // Check if order is in terminal state
    if (
      existing.status_pesanan === "diambil" ||
      existing.status_pesanan === "dibatalkan"
    ) {
      throw new Error(
        `Pesanan sudah ${existing.status_pesanan}, tidak dapat diubah`
      );
    }

    const timestamp = getCurrentTimestamp();
    const newVersion = existing.version + 1;

    await this.db.executeSql(
      `UPDATE pesanan_kue SET 
        status_pesanan = ?, 
        version = ?, 
        sync_status = ?, 
        updated_at = ? 
       WHERE id = ?`,
      [status, newVersion, SyncStatus.PENDING_SYNC, timestamp, id]
    );

    // Add to sync queue
    await this.db.addToSyncQueue({
      table_name: "pesanan_kue",
      record_id: existing.client_id,
      operation: SyncOperation.UPDATE,
      data: {
        client_id: existing.client_id,
        status_pesanan: status,
        version: newVersion,
        updated_at: timestamp,
      },
      priority: SYNC_CONFIG.SYNC_PRIORITY.CRITICAL,
    });

    return this.getOrderById(id);
  }

  /**
   * Update payment (add DP or mark as paid)
   */
  async updatePayment(id: number, dp: number): Promise<Order | null> {
    const existing = await this.getOrderById(id);
    if (!existing) return null;

    const sisa_bayar = existing.total_harga - dp;
    let status_pembayaran: "belum_bayar" | "dp" | "lunas" = "belum_bayar";

    if (dp === 0) {
      status_pembayaran = "belum_bayar";
    } else if (dp >= existing.total_harga) {
      status_pembayaran = "lunas";
    } else {
      status_pembayaran = "dp";
    }

    const timestamp = getCurrentTimestamp();
    const newVersion = existing.version + 1;

    await this.db.executeSql(
      `UPDATE pesanan_kue SET 
        dp = ?, 
        sisa_bayar = ?, 
        status_pembayaran = ?, 
        version = ?, 
        sync_status = ?, 
        updated_at = ? 
       WHERE id = ?`,
      [
        dp,
        sisa_bayar,
        status_pembayaran,
        newVersion,
        SyncStatus.PENDING_SYNC,
        timestamp,
        id,
      ]
    );

    // Add to sync queue
    await this.db.addToSyncQueue({
      table_name: "pesanan_kue",
      record_id: existing.client_id,
      operation: SyncOperation.UPDATE,
      data: {
        client_id: existing.client_id,
        dp,
        sisa_bayar,
        status_pembayaran,
        version: newVersion,
        updated_at: timestamp,
      },
      priority: SYNC_CONFIG.SYNC_PRIORITY.HIGH,
    });

    return this.getOrderById(id);
  }

  /**
   * Soft delete order
   */
  async deleteOrder(id: number): Promise<boolean> {
    const existing = await this.getOrderById(id);
    if (!existing) return false;

    // Check if order is in terminal state
    if (existing.status_pesanan === "diambil") {
      throw new Error("Pesanan yang sudah diambil tidak dapat dihapus");
    }

    const timestamp = getCurrentTimestamp();
    const newVersion = existing.version + 1;

    await this.db.executeSql(
      `UPDATE pesanan_kue SET 
        deleted_at = ?, 
        version = ?, 
        sync_status = ?, 
        updated_at = ? 
       WHERE id = ?`,
      [timestamp, newVersion, SyncStatus.PENDING_SYNC, timestamp, id]
    );

    // Add to sync queue
    await this.db.addToSyncQueue({
      table_name: "pesanan_kue",
      record_id: existing.client_id,
      operation: SyncOperation.DELETE,
      data: {
        client_id: existing.client_id,
        deleted_at: timestamp,
        version: newVersion,
        updated_at: timestamp,
      },
      priority: SYNC_CONFIG.SYNC_PRIORITY.HIGH,
    });

    return true;
  }

  // ==========================================================================
  // QUERY METHODS
  // ==========================================================================

  /**
   * Get order by ID
   */
  async getOrderById(id: number): Promise<Order | null> {
    const sql = `
      SELECT 
        p.*,
        j.nama as jenis_kue_nama,
        v.nama as variasi_kue_nama,
        u.nama as ukuran_kue_nama,
        k.nama as kotak_kue_nama
      FROM pesanan_kue p
      LEFT JOIN jenis_kue j ON p.jenis_kue_id = j.id
      LEFT JOIN variasi_kue v ON p.variasi_kue_id = v.id
      LEFT JOIN ukuran_kue u ON p.ukuran_kue_id = u.id
      LEFT JOIN kotak_kue k ON p.kotak_kue_id = k.id
      WHERE p.id = ? AND p.deleted_at IS NULL
    `;

    const result = await this.db.executeSql(sql, [id]);
    if (result.rows.length === 0) return null;

    return this.mapRowToOrder(result.rows.item(0));
  }

  /**
   * Get order by client_id
   */
  async getOrderByClientId(clientId: string): Promise<Order | null> {
    const sql = `
      SELECT 
        p.*,
        j.nama as jenis_kue_nama,
        v.nama as variasi_kue_nama,
        u.nama as ukuran_kue_nama,
        k.nama as kotak_kue_nama
      FROM pesanan_kue p
      LEFT JOIN jenis_kue j ON p.jenis_kue_id = j.id
      LEFT JOIN variasi_kue v ON p.variasi_kue_id = v.id
      LEFT JOIN ukuran_kue u ON p.ukuran_kue_id = u.id
      LEFT JOIN kotak_kue k ON p.kotak_kue_id = k.id
      WHERE p.client_id = ? AND p.deleted_at IS NULL
    `;

    const result = await this.db.executeSql(sql, [clientId]);
    if (result.rows.length === 0) return null;

    return this.mapRowToOrder(result.rows.item(0));
  }

  /**
   * Get order by nomor pesanan
   */
  async getOrderByNumber(nomorPesanan: string): Promise<Order | null> {
    const sql = `
      SELECT 
        p.*,
        j.nama as jenis_kue_nama,
        v.nama as variasi_kue_nama,
        u.nama as ukuran_kue_nama,
        k.nama as kotak_kue_nama
      FROM pesanan_kue p
      LEFT JOIN jenis_kue j ON p.jenis_kue_id = j.id
      LEFT JOIN variasi_kue v ON p.variasi_kue_id = v.id
      LEFT JOIN ukuran_kue u ON p.ukuran_kue_id = u.id
      LEFT JOIN kotak_kue k ON p.kotak_kue_id = k.id
      WHERE p.nomor_pesanan = ? AND p.deleted_at IS NULL
    `;

    const result = await this.db.executeSql(sql, [nomorPesanan]);
    if (result.rows.length === 0) return null;

    return this.mapRowToOrder(result.rows.item(0));
  }

  /**
   * Get all orders with optional filters
   */
  async getOrders(filter?: OrderFilter): Promise<Order[]> {
    let sql = `
      SELECT 
        p.*,
        j.nama as jenis_kue_nama,
        v.nama as variasi_kue_nama,
        u.nama as ukuran_kue_nama,
        k.nama as kotak_kue_nama
      FROM pesanan_kue p
      LEFT JOIN jenis_kue j ON p.jenis_kue_id = j.id
      LEFT JOIN variasi_kue v ON p.variasi_kue_id = v.id
      LEFT JOIN ukuran_kue u ON p.ukuran_kue_id = u.id
      LEFT JOIN kotak_kue k ON p.kotak_kue_id = k.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (!filter?.includeDeleted) {
      sql += " AND p.deleted_at IS NULL";
    }

    if (filter?.status_pesanan) {
      if (Array.isArray(filter.status_pesanan)) {
        sql += ` AND p.status_pesanan IN (${filter.status_pesanan
          .map(() => "?")
          .join(",")})`;
        params.push(...filter.status_pesanan);
      } else {
        sql += " AND p.status_pesanan = ?";
        params.push(filter.status_pesanan);
      }
    }

    if (filter?.status_pembayaran) {
      if (Array.isArray(filter.status_pembayaran)) {
        sql += ` AND p.status_pembayaran IN (${filter.status_pembayaran
          .map(() => "?")
          .join(",")})`;
        params.push(...filter.status_pembayaran);
      } else {
        sql += " AND p.status_pembayaran = ?";
        params.push(filter.status_pembayaran);
      }
    }

    if (filter?.tanggal_ambil_start) {
      sql += " AND p.tanggal_ambil >= ?";
      params.push(filter.tanggal_ambil_start);
    }

    if (filter?.tanggal_ambil_end) {
      sql += " AND p.tanggal_ambil <= ?";
      params.push(filter.tanggal_ambil_end);
    }

    if (filter?.tanggal_pesan_start) {
      sql += " AND p.tanggal_pesan >= ?";
      params.push(filter.tanggal_pesan_start);
    }

    if (filter?.tanggal_pesan_end) {
      sql += " AND p.tanggal_pesan <= ?";
      params.push(filter.tanggal_pesan_end);
    }

    if (filter?.search) {
      sql +=
        " AND (p.nama_pemesan LIKE ? OR p.no_hp LIKE ? OR p.nomor_pesanan LIKE ?)";
      const searchTerm = `%${filter.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    sql += " ORDER BY p.tanggal_ambil ASC, p.waktu_ambil ASC";

    const result = await this.db.executeSql(sql, params);
    const orders: Order[] = [];

    for (let i = 0; i < result.rows.length; i++) {
      orders.push(this.mapRowToOrder(result.rows.item(i)));
    }

    return orders;
  }

  /**
   * Get orders for today
   */
  async getTodayOrders(): Promise<Order[]> {
    const today = new Date().toISOString().split("T")[0];
    return this.getOrders({
      tanggal_ambil_start: today,
      tanggal_ambil_end: today,
      status_pesanan: ["pending", "diproses", "siap"],
    });
  }

  /**
   * Get orders ready for pickup
   */
  async getReadyOrders(): Promise<Order[]> {
    return this.getOrders({ status_pesanan: "siap" });
  }

  /**
   * Get orders with unpaid balance
   */
  async getUnpaidOrders(): Promise<Order[]> {
    return this.getOrders({ status_pembayaran: ["belum_bayar", "dp"] });
  }

  // ==========================================================================
  // SYNC METHODS
  // ==========================================================================

  /**
   * Get unsynced orders for pushing to server
   */
  async getUnsyncedOrders(limit: number = 50): Promise<Order[]> {
    const sql = `
      SELECT 
        p.*,
        j.nama as jenis_kue_nama,
        v.nama as variasi_kue_nama,
        u.nama as ukuran_kue_nama,
        k.nama as kotak_kue_nama
      FROM pesanan_kue p
      LEFT JOIN jenis_kue j ON p.jenis_kue_id = j.id
      LEFT JOIN variasi_kue v ON p.variasi_kue_id = v.id
      LEFT JOIN ukuran_kue u ON p.ukuran_kue_id = u.id
      LEFT JOIN kotak_kue k ON p.kotak_kue_id = k.id
      WHERE p.sync_status = ?
      ORDER BY p.updated_at ASC
      LIMIT ?
    `;

    const result = await this.db.executeSql(sql, [
      SyncStatus.PENDING_SYNC,
      limit,
    ]);
    const orders: Order[] = [];

    for (let i = 0; i < result.rows.length; i++) {
      orders.push(this.mapRowToOrder(result.rows.item(i)));
    }

    return orders;
  }

  /**
   * Apply update from server (upsert)
   */
  async upsertFromServer(serverData: any): Promise<void> {
    const existingResult = await this.db.executeSql(
      "SELECT id, version FROM pesanan_kue WHERE client_id = ?",
      [serverData.client_id]
    );

    const timestamp = getCurrentTimestamp();
    const aksesorisJson = serverData.aksesoris
      ? typeof serverData.aksesoris === "string"
        ? serverData.aksesoris
        : JSON.stringify(serverData.aksesoris)
      : null;

    if (existingResult.rows.length > 0) {
      const existing = existingResult.rows.item(0);

      // Only update if server version is newer
      if (serverData.version > existing.version) {
        await this.db.executeSql(
          `UPDATE pesanan_kue SET
            device_id = ?,
            nomor_pesanan = ?,
            nama_pemesan = ?,
            no_hp = ?,
            tanggal_pesan = ?,
            tanggal_ambil = ?,
            waktu_ambil = ?,
            jenis_kue_id = ?,
            variasi_kue_id = ?,
            ukuran_kue_id = ?,
            kotak_kue_id = ?,
            tulisan_kue = ?,
            catatan = ?,
            aksesoris = ?,
            harga_dasar = ?,
            harga_variasi = ?,
            multiplier_ukuran = ?,
            harga_kotak = ?,
            harga_aksesoris = ?,
            total_harga = ?,
            dp = ?,
            sisa_bayar = ?,
            status_pembayaran = ?,
            status_pesanan = ?,
            version = ?,
            sync_status = ?,
            last_synced_at = ?,
            deleted_at = ?,
            updated_at = ?
          WHERE client_id = ?`,
          [
            serverData.device_id,
            serverData.nomor_pesanan,
            serverData.nama_pemesan,
            serverData.no_hp,
            serverData.tanggal_pesan,
            serverData.tanggal_ambil,
            serverData.waktu_ambil,
            serverData.jenis_kue_id,
            serverData.variasi_kue_id,
            serverData.ukuran_kue_id,
            serverData.kotak_kue_id,
            serverData.tulisan_kue,
            serverData.catatan,
            aksesorisJson,
            serverData.harga_dasar,
            serverData.harga_variasi,
            serverData.multiplier_ukuran,
            serverData.harga_kotak,
            serverData.harga_aksesoris,
            serverData.total_harga,
            serverData.dp,
            serverData.sisa_bayar,
            serverData.status_pembayaran,
            serverData.status_pesanan,
            serverData.version,
            SyncStatus.SYNCED,
            timestamp,
            serverData.deleted_at,
            serverData.updated_at || timestamp,
            serverData.client_id,
          ]
        );
      }
    } else {
      // Insert new record from server
      await this.db.executeSql(
        `INSERT INTO pesanan_kue (
          client_id, device_id, nomor_pesanan, nama_pemesan, no_hp,
          tanggal_pesan, tanggal_ambil, waktu_ambil,
          jenis_kue_id, variasi_kue_id, ukuran_kue_id, kotak_kue_id,
          tulisan_kue, catatan, aksesoris,
          harga_dasar, harga_variasi, multiplier_ukuran, harga_kotak, harga_aksesoris, total_harga,
          dp, sisa_bayar, status_pembayaran, status_pesanan,
          version, sync_status, last_synced_at, deleted_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          serverData.client_id,
          serverData.device_id,
          serverData.nomor_pesanan,
          serverData.nama_pemesan,
          serverData.no_hp,
          serverData.tanggal_pesan,
          serverData.tanggal_ambil,
          serverData.waktu_ambil,
          serverData.jenis_kue_id,
          serverData.variasi_kue_id,
          serverData.ukuran_kue_id,
          serverData.kotak_kue_id,
          serverData.tulisan_kue,
          serverData.catatan,
          aksesorisJson,
          serverData.harga_dasar,
          serverData.harga_variasi,
          serverData.multiplier_ukuran,
          serverData.harga_kotak,
          serverData.harga_aksesoris,
          serverData.total_harga,
          serverData.dp,
          serverData.sisa_bayar,
          serverData.status_pembayaran,
          serverData.status_pesanan,
          serverData.version,
          SyncStatus.SYNCED,
          timestamp,
          serverData.deleted_at,
          serverData.created_at || timestamp,
          serverData.updated_at || timestamp,
        ]
      );
    }
  }

  /**
   * Mark order as synced
   */
  async markAsSynced(clientId: string, serverVersion?: number): Promise<void> {
    const timestamp = getCurrentTimestamp();

    if (serverVersion !== undefined) {
      await this.db.executeSql(
        `UPDATE pesanan_kue SET 
          sync_status = ?, 
          last_synced_at = ?, 
          version = ? 
         WHERE client_id = ?`,
        [SyncStatus.SYNCED, timestamp, serverVersion, clientId]
      );
    } else {
      await this.db.executeSql(
        `UPDATE pesanan_kue SET 
          sync_status = ?, 
          last_synced_at = ? 
         WHERE client_id = ?`,
        [SyncStatus.SYNCED, timestamp, clientId]
      );
    }
  }

  /**
   * Mark order as having conflict
   */
  async markAsConflict(clientId: string): Promise<void> {
    await this.db.executeSql(
      "UPDATE pesanan_kue SET sync_status = ? WHERE client_id = ?",
      [SyncStatus.CONFLICT, clientId]
    );
  }

  /**
   * Get orders with sync conflicts
   */
  async getConflictedOrders(): Promise<Order[]> {
    const sql = `
      SELECT 
        p.*,
        j.nama as jenis_kue_nama,
        v.nama as variasi_kue_nama,
        u.nama as ukuran_kue_nama,
        k.nama as kotak_kue_nama
      FROM pesanan_kue p
      LEFT JOIN jenis_kue j ON p.jenis_kue_id = j.id
      LEFT JOIN variasi_kue v ON p.variasi_kue_id = v.id
      LEFT JOIN ukuran_kue u ON p.ukuran_kue_id = u.id
      LEFT JOIN kotak_kue k ON p.kotak_kue_id = k.id
      WHERE p.sync_status = ?
      ORDER BY p.updated_at DESC
    `;

    const result = await this.db.executeSql(sql, [SyncStatus.CONFLICT]);
    const orders: Order[] = [];

    for (let i = 0; i < result.rows.length; i++) {
      orders.push(this.mapRowToOrder(result.rows.item(i)));
    }

    return orders;
  }

  // ==========================================================================
  // STATISTICS METHODS
  // ==========================================================================

  /**
   * Get order statistics
   */
  async getStatistics(
    startDate?: string,
    endDate?: string
  ): Promise<{
    totalOrders: number;
    totalRevenue: number;
    totalDP: number;
    totalSisaBayar: number;
    byStatus: Record<string, number>;
    byPaymentStatus: Record<string, number>;
  }> {
    let whereClause = "WHERE deleted_at IS NULL";
    const params: any[] = [];

    if (startDate) {
      whereClause += " AND tanggal_ambil >= ?";
      params.push(startDate);
    }
    if (endDate) {
      whereClause += " AND tanggal_ambil <= ?";
      params.push(endDate);
    }

    // Total stats
    const totals = await this.db.executeSql(
      `SELECT 
        COUNT(*) as total_orders,
        COALESCE(SUM(total_harga), 0) as total_revenue,
        COALESCE(SUM(dp), 0) as total_dp,
        COALESCE(SUM(sisa_bayar), 0) as total_sisa_bayar
       FROM pesanan_kue ${whereClause}`,
      params
    );

    // By status
    const byStatusResult = await this.db.executeSql(
      `SELECT status_pesanan, COUNT(*) as count 
       FROM pesanan_kue ${whereClause} 
       GROUP BY status_pesanan`,
      params
    );

    const byStatus: Record<string, number> = {};
    for (let i = 0; i < byStatusResult.rows.length; i++) {
      const row = byStatusResult.rows.item(i);
      byStatus[row.status_pesanan] = row.count;
    }

    // By payment status
    const byPaymentResult = await this.db.executeSql(
      `SELECT status_pembayaran, COUNT(*) as count 
       FROM pesanan_kue ${whereClause} 
       GROUP BY status_pembayaran`,
      params
    );

    const byPaymentStatus: Record<string, number> = {};
    for (let i = 0; i < byPaymentResult.rows.length; i++) {
      const row = byPaymentResult.rows.item(i);
      byPaymentStatus[row.status_pembayaran] = row.count;
    }

    const row = totals.rows.item(0);
    return {
      totalOrders: row.total_orders,
      totalRevenue: row.total_revenue,
      totalDP: row.total_dp,
      totalSisaBayar: row.total_sisa_bayar,
      byStatus,
      byPaymentStatus,
    };
  }

  /**
   * Get pending orders count
   */
  async getPendingCount(): Promise<number> {
    const result = await this.db.executeSql(
      `SELECT COUNT(*) as count FROM pesanan_kue 
       WHERE status_pesanan IN ('pending', 'diproses') 
       AND deleted_at IS NULL`
    );
    return result.rows.item(0).count;
  }

  /**
   * Get unsynced count
   */
  async getUnsyncedCount(): Promise<number> {
    const result = await this.db.executeSql(
      `SELECT COUNT(*) as count FROM pesanan_kue WHERE sync_status = ?`,
      [SyncStatus.PENDING_SYNC]
    );
    return result.rows.item(0).count;
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

let orderRepositoryInstance: OrderRepository | null = null;

export function getOrderRepository(
  db: SQLiteService,
  deviceId: string
): OrderRepository {
  if (!orderRepositoryInstance) {
    orderRepositoryInstance = new OrderRepository(db, deviceId);
  }
  return orderRepositoryInstance;
}

export function resetOrderRepository(): void {
  orderRepositoryInstance = null;
}
