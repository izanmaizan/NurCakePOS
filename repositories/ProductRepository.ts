/**
 * ProductRepository.ts
 * Repository untuk mengelola produk (produk) dengan dukungan sync
 *
 * Path: src/repositories/ProductRepository.ts
 */

import { SYNC_CONFIG } from "../config/sync.config";
import { SQLiteService } from "../database/SQLiteService";
import { SyncOperation, SyncStatus } from "../types/sync";
import { generateUUID, getCurrentTimestamp } from "../utils/helpers";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface Product {
  id?: number;
  client_id: string;
  device_id: string;
  kode_produk: string;
  nama_produk: string;
  kategori_id: number;
  kategori_nama?: string;
  harga_jual: number;
  harga_modal: number;
  stok: number;
  stok_minimum: number;
  satuan: string;
  deskripsi: string | null;
  gambar: string | null;
  is_active: boolean;
  barcode: string | null;

  // Sync fields
  version: number;
  sync_status: SyncStatus;
  last_synced_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateProductInput {
  kode_produk?: string;
  nama_produk: string;
  kategori_id: number;
  harga_jual: number;
  harga_modal?: number;
  stok?: number;
  stok_minimum?: number;
  satuan?: string;
  deskripsi?: string | null;
  gambar?: string | null;
  is_active?: boolean;
  barcode?: string | null;
}

export interface UpdateProductInput {
  kode_produk?: string;
  nama_produk?: string;
  kategori_id?: number;
  harga_jual?: number;
  harga_modal?: number;
  stok?: number;
  stok_minimum?: number;
  satuan?: string;
  deskripsi?: string | null;
  gambar?: string | null;
  is_active?: boolean;
  barcode?: string | null;
}

export interface ProductFilter {
  kategori_id?: number;
  is_active?: boolean;
  search?: string;
  lowStock?: boolean;
  includeDeleted?: boolean;
}

export interface StockAdjustment {
  product_id: number;
  quantity: number; // positive for add, negative for subtract
  reason: string;
  reference_id?: string; // e.g., transaction client_id
}

// ============================================================================
// PRODUCT REPOSITORY CLASS
// ============================================================================

export class ProductRepository {
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
   * Generate kode produk dengan format: PRD-XXXX
   */
  private async generateProductCode(): Promise<string> {
    const result = await this.db.executeSql(
      `SELECT kode_produk FROM produk 
       WHERE kode_produk LIKE 'PRD-%' 
       ORDER BY kode_produk DESC LIMIT 1`
    );

    let sequence = 1;
    if (result.rows.length > 0) {
      const lastCode = result.rows.item(0).kode_produk;
      const lastSeq = parseInt(lastCode.split("-").pop() || "0", 10);
      sequence = lastSeq + 1;
    }

    return `PRD-${sequence.toString().padStart(4, "0")}`;
  }

  /**
   * Map database row to Product object
   */
  private mapRowToProduct(row: any): Product {
    return {
      id: row.id,
      client_id: row.client_id,
      device_id: row.device_id,
      kode_produk: row.kode_produk,
      nama_produk: row.nama_produk,
      kategori_id: row.kategori_id,
      kategori_nama: row.kategori_nama,
      harga_jual: row.harga_jual,
      harga_modal: row.harga_modal || 0,
      stok: row.stok,
      stok_minimum: row.stok_minimum || 0,
      satuan: row.satuan || "pcs",
      deskripsi: row.deskripsi,
      gambar: row.gambar,
      is_active: row.is_active === 1 || row.is_active === true,
      barcode: row.barcode,
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
   * Create new product
   */
  async createProduct(input: CreateProductInput): Promise<Product> {
    const client_id = generateUUID();
    const kode_produk = input.kode_produk || (await this.generateProductCode());
    const timestamp = getCurrentTimestamp();

    const sql = `
      INSERT INTO produk (
        client_id, device_id, kode_produk, nama_produk, kategori_id,
        harga_jual, harga_modal, stok, stok_minimum, satuan,
        deskripsi, gambar, is_active, barcode,
        version, sync_status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      client_id,
      this.deviceId,
      kode_produk,
      input.nama_produk,
      input.kategori_id,
      input.harga_jual,
      input.harga_modal || 0,
      input.stok ?? 0,
      input.stok_minimum ?? 5,
      input.satuan || "pcs",
      input.deskripsi || null,
      input.gambar || null,
      input.is_active !== false ? 1 : 0,
      input.barcode || null,
      1, // version
      SyncStatus.PENDING_SYNC,
      timestamp,
      timestamp,
    ];

    const result = await this.db.executeSql(sql, params);
    const productId = result.insertId;

    // Add to sync queue
    await this.db.addToSyncQueue({
      table_name: "produk",
      record_id: client_id,
      operation: SyncOperation.INSERT,
      data: {
        client_id,
        device_id: this.deviceId,
        kode_produk,
        nama_produk: input.nama_produk,
        kategori_id: input.kategori_id,
        harga_jual: input.harga_jual,
        harga_modal: input.harga_modal || 0,
        stok: input.stok ?? 0,
        stok_minimum: input.stok_minimum ?? 5,
        satuan: input.satuan || "pcs",
        deskripsi: input.deskripsi || null,
        gambar: input.gambar || null,
        is_active: input.is_active !== false,
        barcode: input.barcode || null,
        version: 1,
        created_at: timestamp,
        updated_at: timestamp,
      },
      priority: SYNC_CONFIG.SYNC_PRIORITY.NORMAL,
    });

    return this.getProductById(productId) as Promise<Product>;
  }

  /**
   * Update existing product
   */
  async updateProduct(
    id: number,
    input: UpdateProductInput
  ): Promise<Product | null> {
    const existing = await this.getProductById(id);
    if (!existing) return null;

    const timestamp = getCurrentTimestamp();
    const newVersion = existing.version + 1;

    const sql = `
      UPDATE produk SET
        kode_produk = ?,
        nama_produk = ?,
        kategori_id = ?,
        harga_jual = ?,
        harga_modal = ?,
        stok = ?,
        stok_minimum = ?,
        satuan = ?,
        deskripsi = ?,
        gambar = ?,
        is_active = ?,
        barcode = ?,
        version = ?,
        sync_status = ?,
        updated_at = ?
      WHERE id = ?
    `;

    const params = [
      input.kode_produk ?? existing.kode_produk,
      input.nama_produk ?? existing.nama_produk,
      input.kategori_id ?? existing.kategori_id,
      input.harga_jual ?? existing.harga_jual,
      input.harga_modal ?? existing.harga_modal,
      input.stok ?? existing.stok,
      input.stok_minimum ?? existing.stok_minimum,
      input.satuan ?? existing.satuan,
      input.deskripsi !== undefined ? input.deskripsi : existing.deskripsi,
      input.gambar !== undefined ? input.gambar : existing.gambar,
      input.is_active !== undefined
        ? input.is_active
          ? 1
          : 0
        : existing.is_active
        ? 1
        : 0,
      input.barcode !== undefined ? input.barcode : existing.barcode,
      newVersion,
      SyncStatus.PENDING_SYNC,
      timestamp,
      id,
    ];

    await this.db.executeSql(sql, params);

    // Add to sync queue
    await this.db.addToSyncQueue({
      table_name: "produk",
      record_id: existing.client_id,
      operation: SyncOperation.UPDATE,
      data: {
        client_id: existing.client_id,
        kode_produk: input.kode_produk ?? existing.kode_produk,
        nama_produk: input.nama_produk ?? existing.nama_produk,
        kategori_id: input.kategori_id ?? existing.kategori_id,
        harga_jual: input.harga_jual ?? existing.harga_jual,
        harga_modal: input.harga_modal ?? existing.harga_modal,
        stok: input.stok ?? existing.stok,
        stok_minimum: input.stok_minimum ?? existing.stok_minimum,
        satuan: input.satuan ?? existing.satuan,
        deskripsi:
          input.deskripsi !== undefined ? input.deskripsi : existing.deskripsi,
        gambar: input.gambar !== undefined ? input.gambar : existing.gambar,
        is_active:
          input.is_active !== undefined ? input.is_active : existing.is_active,
        barcode: input.barcode !== undefined ? input.barcode : existing.barcode,
        version: newVersion,
        updated_at: timestamp,
      },
      priority: SYNC_CONFIG.SYNC_PRIORITY.NORMAL,
    });

    return this.getProductById(id);
  }

  /**
   * Soft delete product
   */
  async deleteProduct(id: number): Promise<boolean> {
    const existing = await this.getProductById(id);
    if (!existing) return false;

    const timestamp = getCurrentTimestamp();
    const newVersion = existing.version + 1;

    await this.db.executeSql(
      `UPDATE produk SET 
        deleted_at = ?, 
        is_active = 0,
        version = ?, 
        sync_status = ?, 
        updated_at = ? 
       WHERE id = ?`,
      [timestamp, newVersion, SyncStatus.PENDING_SYNC, timestamp, id]
    );

    // Add to sync queue
    await this.db.addToSyncQueue({
      table_name: "produk",
      record_id: existing.client_id,
      operation: SyncOperation.DELETE,
      data: {
        client_id: existing.client_id,
        deleted_at: timestamp,
        version: newVersion,
        updated_at: timestamp,
      },
      priority: SYNC_CONFIG.SYNC_PRIORITY.NORMAL,
    });

    return true;
  }

  // ==========================================================================
  // STOCK MANAGEMENT
  // ==========================================================================

  /**
   * Adjust stock (add or subtract)
   */
  async adjustStock(adjustment: StockAdjustment): Promise<Product | null> {
    const existing = await this.getProductById(adjustment.product_id);
    if (!existing) return null;

    const newStock = existing.stok + adjustment.quantity;

    // Prevent negative stock
    if (newStock < 0) {
      throw new Error(
        `Stok tidak mencukupi. Stok saat ini: ${
          existing.stok
        }, pengurangan: ${Math.abs(adjustment.quantity)}`
      );
    }

    const timestamp = getCurrentTimestamp();
    const newVersion = existing.version + 1;

    await this.db.executeSql(
      `UPDATE produk SET 
        stok = ?, 
        version = ?, 
        sync_status = ?, 
        updated_at = ? 
       WHERE id = ?`,
      [
        newStock,
        newVersion,
        SyncStatus.PENDING_SYNC,
        timestamp,
        adjustment.product_id,
      ]
    );

    // Log stock adjustment (optional - if you have a stock_log table)
    try {
      await this.db.executeSql(
        `INSERT INTO stock_log (
          product_client_id, quantity_change, new_quantity, 
          reason, reference_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          existing.client_id,
          adjustment.quantity,
          newStock,
          adjustment.reason,
          adjustment.reference_id || null,
          timestamp,
        ]
      );
    } catch (e) {
      // stock_log table might not exist, ignore
      console.log("Stock log table not available");
    }

    // Add to sync queue
    await this.db.addToSyncQueue({
      table_name: "produk",
      record_id: existing.client_id,
      operation: SyncOperation.UPDATE,
      data: {
        client_id: existing.client_id,
        stok: newStock,
        version: newVersion,
        updated_at: timestamp,
      },
      priority: SYNC_CONFIG.SYNC_PRIORITY.HIGH, // Stock changes are important
    });

    return this.getProductById(adjustment.product_id);
  }

  /**
   * Reduce stock for sale transaction
   */
  async reduceStockForSale(
    productId: number,
    quantity: number,
    transactionClientId: string
  ): Promise<Product | null> {
    return this.adjustStock({
      product_id: productId,
      quantity: -quantity, // negative for reduction
      reason: "SALE",
      reference_id: transactionClientId,
    });
  }

  /**
   * Restore stock for cancelled transaction
   */
  async restoreStockForCancel(
    productId: number,
    quantity: number,
    transactionClientId: string
  ): Promise<Product | null> {
    return this.adjustStock({
      product_id: productId,
      quantity: quantity, // positive for restoration
      reason: "CANCEL_RESTORE",
      reference_id: transactionClientId,
    });
  }

  /**
   * Add stock for purchase/restock
   */
  async addStock(
    productId: number,
    quantity: number,
    reason: string = "RESTOCK"
  ): Promise<Product | null> {
    return this.adjustStock({
      product_id: productId,
      quantity: quantity,
      reason: reason,
    });
  }

  /**
   * Check if stock is available
   */
  async checkStockAvailability(
    productId: number,
    requiredQuantity: number
  ): Promise<boolean> {
    const product = await this.getProductById(productId);
    if (!product) return false;
    return product.stok >= requiredQuantity;
  }

  /**
   * Get products with low stock
   */
  async getLowStockProducts(): Promise<Product[]> {
    const sql = `
      SELECT 
        p.*,
        k.nama as kategori_nama
      FROM produk p
      LEFT JOIN kategori_produk k ON p.kategori_id = k.id
      WHERE p.deleted_at IS NULL 
        AND p.is_active = 1 
        AND p.stok <= p.stok_minimum
      ORDER BY p.stok ASC
    `;

    const result = await this.db.executeSql(sql);
    const products: Product[] = [];

    for (let i = 0; i < result.rows.length; i++) {
      products.push(this.mapRowToProduct(result.rows.item(i)));
    }

    return products;
  }

  // ==========================================================================
  // QUERY METHODS
  // ==========================================================================

  /**
   * Get product by ID
   */
  async getProductById(id: number): Promise<Product | null> {
    const sql = `
      SELECT 
        p.*,
        k.nama as kategori_nama
      FROM produk p
      LEFT JOIN kategori_produk k ON p.kategori_id = k.id
      WHERE p.id = ? AND p.deleted_at IS NULL
    `;

    const result = await this.db.executeSql(sql, [id]);
    if (result.rows.length === 0) return null;

    return this.mapRowToProduct(result.rows.item(0));
  }

  /**
   * Get product by client_id
   */
  async getProductByClientId(clientId: string): Promise<Product | null> {
    const sql = `
      SELECT 
        p.*,
        k.nama as kategori_nama
      FROM produk p
      LEFT JOIN kategori_produk k ON p.kategori_id = k.id
      WHERE p.client_id = ? AND p.deleted_at IS NULL
    `;

    const result = await this.db.executeSql(sql, [clientId]);
    if (result.rows.length === 0) return null;

    return this.mapRowToProduct(result.rows.item(0));
  }

  /**
   * Get product by kode produk
   */
  async getProductByCode(kodeProduk: string): Promise<Product | null> {
    const sql = `
      SELECT 
        p.*,
        k.nama as kategori_nama
      FROM produk p
      LEFT JOIN kategori_produk k ON p.kategori_id = k.id
      WHERE p.kode_produk = ? AND p.deleted_at IS NULL
    `;

    const result = await this.db.executeSql(sql, [kodeProduk]);
    if (result.rows.length === 0) return null;

    return this.mapRowToProduct(result.rows.item(0));
  }

  /**
   * Get product by barcode
   */
  async getProductByBarcode(barcode: string): Promise<Product | null> {
    const sql = `
      SELECT 
        p.*,
        k.nama as kategori_nama
      FROM produk p
      LEFT JOIN kategori_produk k ON p.kategori_id = k.id
      WHERE p.barcode = ? AND p.deleted_at IS NULL
    `;

    const result = await this.db.executeSql(sql, [barcode]);
    if (result.rows.length === 0) return null;

    return this.mapRowToProduct(result.rows.item(0));
  }

  /**
   * Get all products with optional filters
   */
  async getProducts(filter?: ProductFilter): Promise<Product[]> {
    let sql = `
      SELECT 
        p.*,
        k.nama as kategori_nama
      FROM produk p
      LEFT JOIN kategori_produk k ON p.kategori_id = k.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (!filter?.includeDeleted) {
      sql += " AND p.deleted_at IS NULL";
    }

    if (filter?.kategori_id !== undefined) {
      sql += " AND p.kategori_id = ?";
      params.push(filter.kategori_id);
    }

    if (filter?.is_active !== undefined) {
      sql += " AND p.is_active = ?";
      params.push(filter.is_active ? 1 : 0);
    }

    if (filter?.lowStock) {
      sql += " AND p.stok <= p.stok_minimum";
    }

    if (filter?.search) {
      sql +=
        " AND (p.nama_produk LIKE ? OR p.kode_produk LIKE ? OR p.barcode LIKE ?)";
      const searchTerm = `%${filter.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    sql += " ORDER BY p.nama_produk ASC";

    const result = await this.db.executeSql(sql, params);
    const products: Product[] = [];

    for (let i = 0; i < result.rows.length; i++) {
      products.push(this.mapRowToProduct(result.rows.item(i)));
    }

    return products;
  }

  /**
   * Get active products for POS
   */
  async getActiveProducts(): Promise<Product[]> {
    return this.getProducts({ is_active: true });
  }

  /**
   * Get products by category
   */
  async getProductsByCategory(kategoriId: number): Promise<Product[]> {
    return this.getProducts({ kategori_id: kategoriId, is_active: true });
  }

  /**
   * Search products
   */
  async searchProducts(query: string): Promise<Product[]> {
    return this.getProducts({ search: query, is_active: true });
  }

  // ==========================================================================
  // SYNC METHODS
  // ==========================================================================

  /**
   * Get unsynced products for pushing to server
   */
  async getUnsyncedProducts(limit: number = 50): Promise<Product[]> {
    const sql = `
      SELECT 
        p.*,
        k.nama as kategori_nama
      FROM produk p
      LEFT JOIN kategori_produk k ON p.kategori_id = k.id
      WHERE p.sync_status = ?
      ORDER BY p.updated_at ASC
      LIMIT ?
    `;

    const result = await this.db.executeSql(sql, [
      SyncStatus.PENDING_SYNC,
      limit,
    ]);
    const products: Product[] = [];

    for (let i = 0; i < result.rows.length; i++) {
      products.push(this.mapRowToProduct(result.rows.item(i)));
    }

    return products;
  }

  /**
   * Apply update from server (upsert)
   */
  async upsertFromServer(serverData: any): Promise<void> {
    const existingResult = await this.db.executeSql(
      "SELECT id, version, stok FROM produk WHERE client_id = ?",
      [serverData.client_id]
    );

    const timestamp = getCurrentTimestamp();

    if (existingResult.rows.length > 0) {
      const existing = existingResult.rows.item(0);

      // Only update if server version is newer
      if (serverData.version > existing.version) {
        // For stock: use server stock if server is source of truth
        // Or implement custom merge logic
        const finalStock = serverData.stok;

        await this.db.executeSql(
          `UPDATE produk SET
            device_id = ?,
            kode_produk = ?,
            nama_produk = ?,
            kategori_id = ?,
            harga_jual = ?,
            harga_modal = ?,
            stok = ?,
            stok_minimum = ?,
            satuan = ?,
            deskripsi = ?,
            gambar = ?,
            is_active = ?,
            barcode = ?,
            version = ?,
            sync_status = ?,
            last_synced_at = ?,
            deleted_at = ?,
            updated_at = ?
          WHERE client_id = ?`,
          [
            serverData.device_id,
            serverData.kode_produk,
            serverData.nama_produk,
            serverData.kategori_id,
            serverData.harga_jual,
            serverData.harga_modal || 0,
            finalStock,
            serverData.stok_minimum || 5,
            serverData.satuan || "pcs",
            serverData.deskripsi,
            serverData.gambar,
            serverData.is_active ? 1 : 0,
            serverData.barcode,
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
        `INSERT INTO produk (
          client_id, device_id, kode_produk, nama_produk, kategori_id,
          harga_jual, harga_modal, stok, stok_minimum, satuan,
          deskripsi, gambar, is_active, barcode,
          version, sync_status, last_synced_at, deleted_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          serverData.client_id,
          serverData.device_id,
          serverData.kode_produk,
          serverData.nama_produk,
          serverData.kategori_id,
          serverData.harga_jual,
          serverData.harga_modal || 0,
          serverData.stok || 0,
          serverData.stok_minimum || 5,
          serverData.satuan || "pcs",
          serverData.deskripsi,
          serverData.gambar,
          serverData.is_active ? 1 : 0,
          serverData.barcode,
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
   * Mark product as synced
   */
  async markAsSynced(clientId: string, serverVersion?: number): Promise<void> {
    const timestamp = getCurrentTimestamp();

    if (serverVersion !== undefined) {
      await this.db.executeSql(
        `UPDATE produk SET 
          sync_status = ?, 
          last_synced_at = ?, 
          version = ? 
         WHERE client_id = ?`,
        [SyncStatus.SYNCED, timestamp, serverVersion, clientId]
      );
    } else {
      await this.db.executeSql(
        `UPDATE produk SET 
          sync_status = ?, 
          last_synced_at = ? 
         WHERE client_id = ?`,
        [SyncStatus.SYNCED, timestamp, clientId]
      );
    }
  }

  /**
   * Mark product as having conflict
   */
  async markAsConflict(clientId: string): Promise<void> {
    await this.db.executeSql(
      "UPDATE produk SET sync_status = ? WHERE client_id = ?",
      [SyncStatus.CONFLICT, clientId]
    );
  }

  /**
   * Get products with sync conflicts
   */
  async getConflictedProducts(): Promise<Product[]> {
    const sql = `
      SELECT 
        p.*,
        k.nama as kategori_nama
      FROM produk p
      LEFT JOIN kategori_produk k ON p.kategori_id = k.id
      WHERE p.sync_status = ?
      ORDER BY p.updated_at DESC
    `;

    const result = await this.db.executeSql(sql, [SyncStatus.CONFLICT]);
    const products: Product[] = [];

    for (let i = 0; i < result.rows.length; i++) {
      products.push(this.mapRowToProduct(result.rows.item(i)));
    }

    return products;
  }

  // ==========================================================================
  // STATISTICS METHODS
  // ==========================================================================

  /**
   * Get product statistics
   */
  async getStatistics(): Promise<{
    totalProducts: number;
    activeProducts: number;
    lowStockCount: number;
    outOfStockCount: number;
    totalStockValue: number;
    byCategory: Array<{
      kategori_id: number;
      kategori_nama: string;
      count: number;
    }>;
  }> {
    // Total and active
    const countResult = await this.db.executeSql(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN stok <= stok_minimum AND stok > 0 THEN 1 ELSE 0 END) as low_stock,
        SUM(CASE WHEN stok = 0 THEN 1 ELSE 0 END) as out_of_stock,
        COALESCE(SUM(stok * harga_modal), 0) as stock_value
       FROM produk 
       WHERE deleted_at IS NULL`
    );

    // By category
    const categoryResult = await this.db.executeSql(
      `SELECT 
        p.kategori_id,
        k.nama as kategori_nama,
        COUNT(*) as count
       FROM produk p
       LEFT JOIN kategori_produk k ON p.kategori_id = k.id
       WHERE p.deleted_at IS NULL AND p.is_active = 1
       GROUP BY p.kategori_id, k.nama
       ORDER BY count DESC`
    );

    const byCategory: Array<{
      kategori_id: number;
      kategori_nama: string;
      count: number;
    }> = [];
    for (let i = 0; i < categoryResult.rows.length; i++) {
      const row = categoryResult.rows.item(i);
      byCategory.push({
        kategori_id: row.kategori_id,
        kategori_nama: row.kategori_nama || "Tanpa Kategori",
        count: row.count,
      });
    }

    const row = countResult.rows.item(0);
    return {
      totalProducts: row.total,
      activeProducts: row.active,
      lowStockCount: row.low_stock,
      outOfStockCount: row.out_of_stock,
      totalStockValue: row.stock_value,
      byCategory,
    };
  }

  /**
   * Get unsynced count
   */
  async getUnsyncedCount(): Promise<number> {
    const result = await this.db.executeSql(
      `SELECT COUNT(*) as count FROM produk WHERE sync_status = ?`,
      [SyncStatus.PENDING_SYNC]
    );
    return result.rows.item(0).count;
  }

  // ==========================================================================
  // CATEGORY METHODS (Helper)
  // ==========================================================================

  /**
   * Get all categories
   */
  async getCategories(): Promise<Array<{ id: number; nama: string }>> {
    const result = await this.db.executeSql(
      "SELECT id, nama FROM kategori_produk ORDER BY nama ASC"
    );

    const categories: Array<{ id: number; nama: string }> = [];
    for (let i = 0; i < result.rows.length; i++) {
      const row = result.rows.item(i);
      categories.push({ id: row.id, nama: row.nama });
    }

    return categories;
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

let productRepositoryInstance: ProductRepository | null = null;

export function getProductRepository(
  db: SQLiteService,
  deviceId: string
): ProductRepository {
  if (!productRepositoryInstance) {
    productRepositoryInstance = new ProductRepository(db, deviceId);
  }
  return productRepositoryInstance;
}

export function resetProductRepository(): void {
  productRepositoryInstance = null;
}
