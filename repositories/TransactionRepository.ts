// repositories/TransactionRepository.ts - Fixed v3
// - Short transaction numbers (#MMDD-XXX)
// - namaPelanggan in catatan
// - statusPesanan based on pickup time
// - tanggalPengambilan field
import uuid from "react-native-uuid";
import { sqliteService } from "../database/SQLiteService";

export interface Transaksi {
  id: string;
  nomorTransaksi: string;
  tanggal: string;
  totalHarga: number;
  metodePembayaran: string;
  statusPembayaran: string;
  statusPesanan?: string; // 'completed' | 'pending'
  catatan?: string;
  dibuat: string;
  diperbarui: string;
  server_id?: string;
  device_id?: string;
  version: number;
  sync_status: "pending" | "synced" | "conflict";
  deleted_at?: string;
}

export interface DetailTransaksi {
  id: string;
  transaksiId: string;
  tipeItem: "produk" | "kue_ready" | "pesanan";
  itemId: string;
  namaItem: string;
  jumlah: number;
  hargaSatuan: number;
  subtotal: number;
  catatan?: string;
  dibuat: string;
  server_id?: string;
  device_id?: string;
  version: number;
  sync_status: "pending" | "synced" | "conflict";
  deleted_at?: string;
}

export interface TransaksiWithDetails extends Transaksi {
  details: DetailTransaksi[];
  namaPelanggan?: string;
  tanggalPengambilan?: string;
  jamPengambilan?: string;
}

export interface CartItem {
  tipeItem?: "produk" | "kue_ready" | "pesanan";
  itemId?: string;
  produkId?: string;
  namaItem?: string;
  namaProduk?: string;
  hargaSatuan: number;
  jumlah: number;
  subtotal: number;
  catatan?: string;
}

export interface TransactionData {
  items: CartItem[];
  metodePembayaran: string;
  catatan?: string;
  namaPelanggan?: string;
  statusPembayaran?: string;
  statusPesanan?: string;
  jumlahBayar?: number;
  tanggalPengambilan?: string;
}

export interface TransactionWithDetails extends TransaksiWithDetails {}

class TransactionRepository {
  // Short transaction number: #MMDD-XXX
  private async generateNomorTransaksi(): Promise<string> {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const today = now.toISOString().slice(0, 10);

    const result = await sqliteService.getFirst<{ count: number }>(
      `SELECT COUNT(*) as count FROM transaksi WHERE DATE(tanggal) = ?`,
      [today]
    );

    const count = (result?.count || 0) + 1;
    return `#${month}${day}-${count.toString().padStart(3, "0")}`;
  }

  // Parse data from catatan field
  private parseCatatan(catatan?: string): {
    namaPelanggan: string;
    tanggalPengambilan?: string;
    jamPengambilan?: string;
    notes?: string;
  } {
    if (!catatan) return { namaPelanggan: "Customer" };

    let namaPelanggan = "Customer";
    let tanggalPengambilan: string | undefined;
    let jamPengambilan: string | undefined;
    let notes: string | undefined;

    const lines = catatan.split("\n");
    const remainingNotes: string[] = [];

    for (const line of lines) {
      if (line.startsWith("Pelanggan:")) {
        namaPelanggan = line.replace("Pelanggan:", "").trim();
      } else if (line.startsWith("Pengambilan:")) {
        const dateTime = line.replace("Pengambilan:", "").trim();
        const parts = dateTime.split(" ");
        tanggalPengambilan = parts[0];
        jamPengambilan = parts[1] || undefined;
      } else if (line.trim()) {
        remainingNotes.push(line);
      }
    }

    return {
      namaPelanggan,
      tanggalPengambilan,
      jamPengambilan,
      notes: remainingNotes.join("\n"),
    };
  }

  private normalizeCartItems(items: CartItem[]) {
    return items.map((item) => ({
      tipeItem: item.tipeItem || ("produk" as const),
      itemId: item.itemId || item.produkId || uuid.v4().toString(),
      namaItem: item.namaItem || item.namaProduk || "Unknown",
      jumlah: item.jumlah,
      hargaSatuan: item.hargaSatuan,
      catatan: item.catatan,
    }));
  }

  async createTransaction(
    input: TransactionData
  ): Promise<TransaksiWithDetails> {
    const id = uuid.v4().toString();
    const now = new Date().toISOString();
    const nomorTransaksi = await this.generateNomorTransaksi();
    const deviceId = sqliteService.getDeviceId();

    const normalizedItems = this.normalizeCartItems(input.items);
    const totalHarga = normalizedItems.reduce(
      (sum, item) => sum + item.hargaSatuan * item.jumlah,
      0
    );

    // Build catatan with all info
    const catatanParts: string[] = [];
    if (input.namaPelanggan?.trim()) {
      catatanParts.push(`Pelanggan: ${input.namaPelanggan.trim()}`);
    }
    if (input.tanggalPengambilan) {
      const pickupDate = new Date(input.tanggalPengambilan);
      const dateStr = pickupDate.toISOString().split("T")[0];
      const timeStr = pickupDate.toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      });
      catatanParts.push(`Pengambilan: ${dateStr} ${timeStr}`);
    }
    if (input.catatan?.trim()) {
      catatanParts.push(input.catatan.trim());
    }
    const fullCatatan = catatanParts.join("\n");

    const statusPembayaran = input.statusPembayaran || "lunas";
    const statusPesanan = input.statusPesanan || "completed";

    await sqliteService.run(
      `INSERT INTO transaksi 
       (id, nomorTransaksi, tanggal, totalHarga, metodePembayaran, statusPembayaran, catatan, dibuat, diperbarui, device_id, version, sync_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'pending')`,
      [
        id,
        nomorTransaksi,
        now,
        totalHarga,
        input.metodePembayaran,
        statusPembayaran,
        fullCatatan,
        now,
        now,
        deviceId,
      ]
    );

    const details: DetailTransaksi[] = [];

    for (const item of normalizedItems) {
      const detailId = uuid.v4().toString();
      const subtotal = item.hargaSatuan * item.jumlah;

      await sqliteService.run(
        `INSERT INTO detail_transaksi 
         (id, transaksiId, tipeItem, itemId, namaItem, jumlah, hargaSatuan, subtotal, catatan, dibuat, device_id, version, sync_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'pending')`,
        [
          detailId,
          id,
          item.tipeItem,
          item.itemId,
          item.namaItem,
          item.jumlah,
          item.hargaSatuan,
          subtotal,
          item.catatan || "",
          now,
          deviceId,
        ]
      );

      details.push({
        id: detailId,
        transaksiId: id,
        tipeItem: item.tipeItem,
        itemId: item.itemId,
        namaItem: item.namaItem,
        jumlah: item.jumlah,
        hargaSatuan: item.hargaSatuan,
        subtotal,
        catatan: item.catatan,
        dibuat: now,
        device_id: deviceId,
        version: 1,
        sync_status: "pending",
      });

      if (item.tipeItem === "produk") {
        await sqliteService.run(
          `UPDATE produk SET stok = stok - ?, diperbarui = ?, version = version + 1, sync_status = 'pending' WHERE id = ?`,
          [item.jumlah, now, item.itemId]
        );
      }

      if (item.tipeItem === "kue_ready") {
        await sqliteService.run(
          `UPDATE kue_ready SET status = 'terjual', diperbarui = ?, version = version + 1, sync_status = 'pending' WHERE id = ?`,
          [now, item.itemId]
        );
      }
    }

    const parsed = this.parseCatatan(fullCatatan);

    const transaction: TransaksiWithDetails = {
      id,
      nomorTransaksi,
      tanggal: now,
      totalHarga,
      metodePembayaran: input.metodePembayaran,
      statusPembayaran,
      statusPesanan,
      catatan: fullCatatan,
      dibuat: now,
      diperbarui: now,
      device_id: deviceId,
      version: 1,
      sync_status: "pending",
      details,
      namaPelanggan: parsed.namaPelanggan,
      tanggalPengambilan: parsed.tanggalPengambilan,
      jamPengambilan: parsed.jamPengambilan,
    };

    await sqliteService.addToSyncQueue({
      table_name: "transaksi",
      record_id: id,
      operation: "INSERT",
      data: JSON.stringify(transaction),
      priority: 10,
    });

    return transaction;
  }

  async updateTransactionStatus(
    id: string,
    statusPembayaran: string,
    catatan?: string
  ): Promise<void> {
    const now = new Date().toISOString();
    await sqliteService.run(
      `UPDATE transaksi SET statusPembayaran = ?, catatan = COALESCE(?, catatan), diperbarui = ?, version = version + 1, sync_status = 'pending' WHERE id = ?`,
      [statusPembayaran, catatan, now, id]
    );
  }

  // FIX: Mark transaction as picked up (completed)
  async markAsPickedUp(id: string): Promise<void> {
    const now = new Date().toISOString();
    const transaction = await this.getTransactionById(id);
    if (!transaction) return;

    // Update catatan to include status
    let newCatatan = transaction.catatan || "";
    if (!newCatatan.includes("Status: Sudah Diambil")) {
      newCatatan = newCatatan
        ? `${newCatatan}\nStatus: Sudah Diambil`
        : "Status: Sudah Diambil";
    }

    await sqliteService.run(
      `UPDATE transaksi SET statusPembayaran = 'lunas', catatan = ?, diperbarui = ?, version = version + 1, sync_status = 'pending' WHERE id = ?`,
      [newCatatan, now, id]
    );
  }

  async deleteTransaction(id: string): Promise<void> {
    const now = new Date().toISOString();
    await sqliteService.run(
      `UPDATE transaksi SET deleted_at = ?, sync_status = 'pending', version = version + 1 WHERE id = ?`,
      [now, id]
    );
    await sqliteService.run(
      `UPDATE detail_transaksi SET deleted_at = ?, sync_status = 'pending', version = version + 1 WHERE transaksiId = ?`,
      [now, id]
    );
  }

  private addParsedFields(
    t: Transaksi,
    details: DetailTransaksi[]
  ): TransaksiWithDetails {
    const parsed = this.parseCatatan(t.catatan);

    // Determine statusPesanan based on pickup date
    let statusPesanan = "completed";
    if (parsed.tanggalPengambilan) {
      const pickupDate = new Date(
        `${parsed.tanggalPengambilan} ${parsed.jamPengambilan || "00:00"}`
      );
      if (pickupDate > new Date()) {
        statusPesanan = "pending";
      }
    }

    // If catatan contains "Sudah Diambil", mark as completed
    if (t.catatan?.includes("Sudah Diambil")) {
      statusPesanan = "completed";
    }

    return {
      ...t,
      details,
      namaPelanggan: parsed.namaPelanggan,
      tanggalPengambilan: parsed.tanggalPengambilan,
      jamPengambilan: parsed.jamPengambilan,
      statusPesanan,
    };
  }

  async getTransactionById(id: string): Promise<TransaksiWithDetails | null> {
    const t = await sqliteService.getFirst<Transaksi>(
      "SELECT * FROM transaksi WHERE id = ? AND deleted_at IS NULL",
      [id]
    );
    if (!t) return null;
    const details = await sqliteService.query<DetailTransaksi>(
      "SELECT * FROM detail_transaksi WHERE transaksiId = ? AND deleted_at IS NULL",
      [id]
    );
    return this.addParsedFields(t, details);
  }

  async getAllTransactions(): Promise<TransaksiWithDetails[]> {
    const transactions = await sqliteService.query<Transaksi>(
      "SELECT * FROM transaksi WHERE deleted_at IS NULL ORDER BY tanggal DESC"
    );
    const result: TransaksiWithDetails[] = [];
    for (const t of transactions) {
      const details = await sqliteService.query<DetailTransaksi>(
        "SELECT * FROM detail_transaksi WHERE transaksiId = ? AND deleted_at IS NULL",
        [t.id]
      );
      result.push(this.addParsedFields(t, details));
    }
    return result;
  }

  async searchTransactions(
    searchTerm: string
  ): Promise<TransaksiWithDetails[]> {
    const transactions = await sqliteService.query<Transaksi>(
      `SELECT * FROM transaksi WHERE deleted_at IS NULL AND (nomorTransaksi LIKE ? OR catatan LIKE ?) ORDER BY tanggal DESC`,
      [`%${searchTerm}%`, `%${searchTerm}%`]
    );
    const result: TransaksiWithDetails[] = [];
    for (const t of transactions) {
      const details = await sqliteService.query<DetailTransaksi>(
        "SELECT * FROM detail_transaksi WHERE transaksiId = ? AND deleted_at IS NULL",
        [t.id]
      );
      result.push(this.addParsedFields(t, details));
    }
    return result;
  }

  async getTransactionsByDate(
    startDate: Date,
    endDate: Date
  ): Promise<TransaksiWithDetails[]> {
    const transactions = await sqliteService.query<Transaksi>(
      `SELECT * FROM transaksi WHERE deleted_at IS NULL AND tanggal BETWEEN ? AND ? ORDER BY tanggal DESC`,
      [startDate.toISOString(), endDate.toISOString()]
    );
    const result: TransaksiWithDetails[] = [];
    for (const t of transactions) {
      const details = await sqliteService.query<DetailTransaksi>(
        "SELECT * FROM detail_transaksi WHERE transaksiId = ? AND deleted_at IS NULL",
        [t.id]
      );
      result.push(this.addParsedFields(t, details));
    }
    return result;
  }

  async getTransactionsByPaymentMethod(
    method: string
  ): Promise<TransaksiWithDetails[]> {
    const transactions = await sqliteService.query<Transaksi>(
      `SELECT * FROM transaksi WHERE deleted_at IS NULL AND metodePembayaran = ? ORDER BY tanggal DESC`,
      [method]
    );
    const result: TransaksiWithDetails[] = [];
    for (const t of transactions) {
      const details = await sqliteService.query<DetailTransaksi>(
        "SELECT * FROM detail_transaksi WHERE transaksiId = ? AND deleted_at IS NULL",
        [t.id]
      );
      result.push(this.addParsedFields(t, details));
    }
    return result;
  }

  async getTodayTransactions(): Promise<TransaksiWithDetails[]> {
    const today = new Date().toISOString().slice(0, 10);
    const transactions = await sqliteService.query<Transaksi>(
      `SELECT * FROM transaksi WHERE deleted_at IS NULL AND DATE(tanggal) = ? ORDER BY tanggal DESC`,
      [today]
    );
    const result: TransaksiWithDetails[] = [];
    for (const t of transactions) {
      const details = await sqliteService.query<DetailTransaksi>(
        "SELECT * FROM detail_transaksi WHERE transaksiId = ? AND deleted_at IS NULL",
        [t.id]
      );
      result.push(this.addParsedFields(t, details));
    }
    return result;
  }

  async getSalesStats(startDate?: Date, endDate?: Date) {
    let dateCondition = "";
    const params: any[] = [];
    if (startDate && endDate) {
      dateCondition = "AND tanggal BETWEEN ? AND ?";
      params.push(startDate.toISOString(), endDate.toISOString());
    }

    const totals = await sqliteService.getFirst<{
      totalPendapatan: number;
      totalTransaksi: number;
    }>(
      `SELECT COALESCE(SUM(totalHarga), 0) as totalPendapatan, COUNT(*) as totalTransaksi FROM transaksi WHERE deleted_at IS NULL ${dateCondition}`,
      params
    );
    const itemCount = await sqliteService.getFirst<{ totalItem: number }>(
      `SELECT COALESCE(SUM(dt.jumlah), 0) as totalItem FROM detail_transaksi dt JOIN transaksi t ON dt.transaksiId = t.id WHERE dt.deleted_at IS NULL AND t.deleted_at IS NULL ${dateCondition}`,
      params
    );
    const methodStats = await sqliteService.query<{
      metodePembayaran: string;
      count: number;
    }>(
      `SELECT metodePembayaran, COUNT(*) as count FROM transaksi WHERE deleted_at IS NULL ${dateCondition} GROUP BY metodePembayaran`,
      params
    );

    const metodePembayaranStats: Record<string, number> = {};
    methodStats.forEach((m) => {
      metodePembayaranStats[m.metodePembayaran] = m.count;
    });

    return {
      totalTransaksi: totals?.totalTransaksi || 0,
      totalPendapatan: totals?.totalPendapatan || 0,
      totalItem: itemCount?.totalItem || 0,
      rataRataTransaksi: totals?.totalTransaksi
        ? totals.totalPendapatan / totals.totalTransaksi
        : 0,
      metodePembayaranStats,
    };
  }

  async getTopSellingProducts(
    limit: number = 10,
    startDate?: Date,
    endDate?: Date
  ) {
    let dateCondition = "";
    const params: any[] = [];
    if (startDate && endDate) {
      dateCondition = "AND t.tanggal BETWEEN ? AND ?";
      params.push(startDate.toISOString(), endDate.toISOString());
    }
    params.push(limit);

    return sqliteService.query<{
      namaItem: string;
      totalQuantity: number;
      totalSales: number;
    }>(
      `SELECT namaItem, SUM(jumlah) as totalQuantity, SUM(subtotal) as totalSales FROM detail_transaksi dt JOIN transaksi t ON dt.transaksiId = t.id WHERE dt.deleted_at IS NULL AND t.deleted_at IS NULL ${dateCondition} GROUP BY namaItem ORDER BY totalSales DESC LIMIT ?`,
      params
    );
  }

  async getDailySales(days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    return sqliteService.query<{
      tanggal: string;
      totalPendapatan: number;
      jumlahTransaksi: number;
    }>(
      `SELECT DATE(tanggal) as tanggal, COALESCE(SUM(totalHarga), 0) as totalPendapatan, COUNT(*) as jumlahTransaksi FROM transaksi WHERE deleted_at IS NULL AND tanggal >= ? GROUP BY DATE(tanggal) ORDER BY tanggal DESC`,
      [startDate.toISOString()]
    );
  }

  async getMonthlySales(year: number, month: number) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);
    const stats = await this.getSalesStats(startDate, endDate);
    return {
      totalTransaksi: stats.totalTransaksi,
      totalPendapatan: stats.totalPendapatan,
      totalItem: stats.totalItem,
      rataRataTransaksi: stats.rataRataTransaksi,
    };
  }

  async getUnsyncedTransactions() {
    return sqliteService.query<Transaksi>(
      `SELECT * FROM transaksi WHERE sync_status = 'pending'`
    );
  }
  async markAsSynced(id: string, serverId: string) {
    await sqliteService.markRecordAsSynced("transaksi", id, serverId);
  }
}

export const transactionRepository = new TransactionRepository();
