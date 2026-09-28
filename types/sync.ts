/**
 * types/sync.ts
 * Type definitions untuk sync multi-device NurCake POS
 *
 * Path: src/types/sync.ts
 */

// ============================================================================
// ENUMS & CONSTANTS
// ============================================================================

/**
 * Status sync record individual
 */
export const SyncStatus = {
  PENDING_SYNC: "pending",
  SYNCING: "syncing",
  SYNCED: "synced",
  CONFLICT: "conflict",
  ERROR: "error",
} as const;

export type SyncStatusType = (typeof SyncStatus)[keyof typeof SyncStatus];

/**
 * Operasi sync
 */
export const SyncOperation = {
  INSERT: "INSERT",
  UPDATE: "UPDATE",
  DELETE: "DELETE",
} as const;

export type SyncOperationType =
  (typeof SyncOperation)[keyof typeof SyncOperation];

/**
 * Status SyncManager
 */
export const ManagerStatus = {
  IDLE: "idle",
  SYNCING: "syncing",
  OFFLINE: "offline",
  ERROR: "error",
} as const;

export type ManagerStatusType =
  (typeof ManagerStatus)[keyof typeof ManagerStatus];

/**
 * Nama tabel yang dapat disync
 */
export const TableName = {
  TRANSAKSI: "transaksi",
  DETAIL_TRANSAKSI: "detail_transaksi",
  PESANAN_KUE: "pesanan_kue",
  PRODUK: "produk",
  KUE_READY: "kue_ready",
} as const;

export type TableNameType = (typeof TableName)[keyof typeof TableName];

/**
 * Tabel master (readonly, tidak di-sync dari device)
 */
export const MasterTableName = {
  KATEGORI_PRODUK: "kategori_produk",
  JENIS_KUE: "jenis_kue",
  VARIASI_KUE: "variasi_kue",
  UKURAN_KUE: "ukuran_kue",
  KOTAK_KUE: "kotak_kue",
  AKSESORIS_KUE: "aksesoris_kue",
} as const;

export type MasterTableNameType =
  (typeof MasterTableName)[keyof typeof MasterTableName];

export interface SyncQueueItem {
  id: string;
  table_name: string;
  record_id: string;
  operation: SyncOperationType;
  payload: string;
  priority: number;
  attempts: number;
  last_error?: string;
  created_at: string;
}

export interface SyncPushRequest {
  batch_id: string;
  device_id: string;
  changes: SyncChange[];
}

export interface SyncChange {
  table: string;
  operation: SyncOperationType;
  client_id: string;
  data: Record<string, any>;
  version: number;
  local_updated_at?: string;
}

export interface SyncPushResponse {
  success: boolean;
  batch_id: string;
  processed_at: string;
  results: SyncPushResult[];
  conflicts: SyncConflict[];
}

export interface SyncPushResult {
  client_id: string;
  server_id: string;
  status: "inserted" | "updated" | "skipped";
  server_version: number;
}

export interface SyncConflict {
  client_id: string;
  reason: string;
  server_version?: number;
  client_version?: number;
  server_data?: Record<string, any>;
  resolution: string;
  message?: string;
}

export interface SyncPullParams {
  since: string;
  tables?: string;
  limit?: number;
  exclude_device?: string;
}

export interface SyncPullResponse {
  success: boolean;
  server_time: string;
  has_more: boolean;
  next_cursor?: string;
  changes: { [tableName: string]: SyncPullChange[] };
}

export interface SyncPullChange {
  server_id: string;
  client_id: string;
  operation: SyncOperationType;
  data: Record<string, any>;
  version: number;
  updated_at: string;
  source_device: string;
}

export interface SyncProgress {
  phase: "push" | "pull" | "complete";
  current: number;
  total: number;
  tableName?: string;
  message?: string;
}

export type SyncStatusCallback = (status: ManagerStatusType) => void;
export type SyncProgressCallback = (progress: SyncProgress) => void;

// ============================================================================
// DEVICE TYPES
// ============================================================================

export interface DeviceInfo {
  device_id: string;
  device_name: string;
  device_type: "kasir" | "dapur" | "admin";
  api_key?: string;
  is_registered: boolean;
  registered_at?: string;
  last_seen_at?: string;
}

export interface DeviceRegistration {
  device_id: string;
  device_name: string;
  device_type: string;
}

export interface DeviceVerifyResponse {
  success: boolean;
  device_id: string;
  is_active: boolean;
  message?: string;
}

// ============================================================================
// SYNC LOG TYPES
// ============================================================================

export interface SyncLog {
  id: number;
  sync_type: "push" | "pull" | "full";
  status: "started" | "completed" | "failed";
  records_pushed: number;
  records_pulled: number;
  conflicts_count: number;
  error_message?: string;
  started_at: string;
  completed_at?: string;
  duration_ms?: number;
}

// ============================================================================
// API TYPES
// ============================================================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface HealthCheckResponse {
  status: "healthy" | "unhealthy";
  serverTime: string;
  uptime: number;
  version?: string;
}

export interface SyncStatsResponse {
  totalDevices: number;
  activeDevices: number;
  totalRecords: {
    transaksi: number;
    pesanan_kue: number;
    produk: number;
  };
  lastSyncTime?: string;
}

// ============================================================================
// MASTER DATA TYPES
// ============================================================================

export interface MasterDataResponse {
  kategori_produk: KategoriProduk[];
  jenis_kue: JenisKue[];
  variasi_kue: VariasiKue[];
  ukuran_kue: UkuranKue[];
  kotak_kue: KotakKue[];
  aksesoris_kue: AksesorisKue[];
}

export interface KategoriProduk {
  id: number;
  nama: string;
  deskripsi?: string;
}

export interface JenisKue {
  id: number;
  nama: string;
  harga_dasar: number;
  deskripsi?: string;
}

export interface VariasiKue {
  id: number;
  nama: string;
  harga_tambahan: number;
}

export interface UkuranKue {
  id: number;
  nama: string;
  multiplier: number;
}

export interface KotakKue {
  id: number;
  nama: string;
  harga: number;
}

export interface AksesorisKue {
  id: number;
  nama: string;
  harga: number;
  deskripsi?: string;
}

// ============================================================================
// SYNC ERROR CLASS
// ============================================================================

export class SyncError extends Error {
  constructor(
    message: string,
    public code: SyncErrorCode,
    public details?: Record<string, any>,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = "SyncError";
  }

  static networkError(message: string = "Network error"): SyncError {
    return new SyncError(message, SyncErrorCode.NETWORK_ERROR, undefined, true);
  }

  static serverError(message: string, details?: any): SyncError {
    return new SyncError(message, SyncErrorCode.SERVER_ERROR, details, true);
  }

  static authError(message: string = "Authentication failed"): SyncError {
    return new SyncError(message, SyncErrorCode.AUTH_ERROR, undefined, false);
  }

  static conflictError(message: string, details?: any): SyncError {
    return new SyncError(message, SyncErrorCode.CONFLICT, details, false);
  }

  static validationError(message: string, details?: any): SyncError {
    return new SyncError(
      message,
      SyncErrorCode.VALIDATION_ERROR,
      details,
      false
    );
  }

  static timeout(message: string = "Request timeout"): SyncError {
    return new SyncError(message, SyncErrorCode.TIMEOUT, undefined, true);
  }
}

export enum SyncErrorCode {
  NETWORK_ERROR = "NETWORK_ERROR",
  SERVER_ERROR = "SERVER_ERROR",
  AUTH_ERROR = "AUTH_ERROR",
  CONFLICT = "CONFLICT",
  VALIDATION_ERROR = "VALIDATION_ERROR",
  TIMEOUT = "TIMEOUT",
  UNKNOWN = "UNKNOWN",
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Partial record untuk update operations
 */
export type UpdatePayload<T> = Partial<
  Omit<T, "id" | "client_id" | "created_at">
>;

/**
 * Response wrapper untuk repository methods
 */
export interface RepositoryResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}
