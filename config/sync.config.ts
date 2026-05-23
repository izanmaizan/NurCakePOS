// config/sync.config.ts - Konfigurasi untuk sync multi-device NurCake POS
// Path: NurCakePOS/client/config/sync.config.ts

export const SYNC_CONFIG = {
  // ============================================
  // SERVER CONFIGURATION
  // ============================================
  // Untuk Android Emulator gunakan: http://10.0.2.2:3000/api/v1
  // Untuk Physical Device gunakan IP laptop: http://192.168.x.x:3000/api/v1
  // Untuk iOS Simulator gunakan: http://localhost:3000/api/v1
  SERVER_URL: "http://172.20.10.11:3000/api/v1", // ini pada hotspot HP
  // SERVER_URL: "http://10.225.0.61:3000/api/v1", // ini pada Wifi RS

  // ============================================
  // BATCH CONFIGURATION
  // ============================================
  BATCH_SIZE: 50, // Max items per sync batch

  // ============================================
  // TIMEOUT
  // ============================================
  REQUEST_TIMEOUT: 10000, // 10 detik

  // ============================================
  // RETRY CONFIGURATION
  // ============================================
  MAX_RETRY_ATTEMPTS: 3,
  RETRY_DELAY_BASE: 1000, // 1 detik, exponential backoff
};

// ============================================
// POLLING INTERVALS (dalam milliseconds)
// ============================================
export const POLLING_INTERVALS = {
  IDLE: 5000, // 5 detik (tidak ada aktivitas)
  ACTIVE: 2000, // 2 detik (baru ada transaksi)
  PENDING: 1000, // 1 detik (ada pending sync)
  OFFLINE: 30000, // 30 detik (server offline)
};

// ============================================
// SYNC PRIORITIES
// ============================================
export const SYNC_PRIORITY = {
  LOW: 1,
  NORMAL: 2,
  HIGH: 3,
  CRITICAL: 4, // Untuk transaksi
};

// ============================================
// TABLES TO SYNC
// ============================================
export const SYNCABLE_TABLES = [
  "transaksi",
  "detail_transaksi",
  "pesanan_kue",
  "produk",
  "kue_ready",
];

// Tables yang read-only dari server (master data)
export const READONLY_TABLES = [
  "kategori_produk",
  "jenis_kue",
  "variasi_kue",
  "ukuran_kue",
  "kotak_kue",
  "aksesoris_kue",
];

// ============================================
// TYPES
// ============================================
export type SyncStatus =
  | "pending"
  | "syncing"
  | "synced"
  | "conflict"
  | "error";
export type SyncOperation = "INSERT" | "UPDATE" | "DELETE";
export type ManagerStatus = "idle" | "syncing" | "offline" | "error";

export default SYNC_CONFIG;
