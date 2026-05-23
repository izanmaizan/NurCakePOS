// hooks/useOrders.ts - Fixed version using sqliteService directly
import { useCallback, useEffect, useState } from "react";
import { useDatabase } from "../context/DatabaseProvider";
import { sqliteService } from "../database/SQLiteService";

// ============================================================
// INTERFACES
// ============================================================

export interface MasterData {
  jenisKue: { id: string; nama: string }[];
  variasiKue: { id: string; nama: string }[];
  ukuranKue: { id: string; nama: string }[];
  aksesorisKue: { id: string; nama: string; harga: number }[];
}

export interface OrderData {
  namaPelanggan: string;
  noHp?: string;
  tanggalAmbil: string;
  jenisKue: string;
  variasiKue?: string;
  ukuranKue: string;
  kotakKue?: string;
  aksesorisKue?: string;
  tulisanKue?: string;
  warnaTema?: string;
  catatan?: string;
  gambarReferensi?: string;
  totalHarga: number;
  dpBayar?: number;
  metodePembayaran?: string;
}

export interface OrderWithDetails {
  id: string;
  nomorPesanan: string;
  namaPelanggan: string;
  noHp?: string;
  jenisKue: string;
  variasiKue?: string;
  ukuranKue: string;
  kotakKue?: string;
  aksesorisKue?: string;
  tulisanKue?: string;
  warnaTema?: string;
  tanggalPesan: string;
  tanggalAmbil: string;
  totalHarga: number;
  dpBayar: number;
  sisaPembayaran: number;
  statusPesanan: string;
  metodePembayaran?: string;
  catatan?: string;
  gambarReferensi?: string;
  dibuat: string;
  diperbarui: string;
}

export const useOrders = () => {
  const { isInitialized } = useDatabase();

  // States
  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [masterData, setMasterData] = useState<MasterData>({
    jenisKue: [],
    variasiKue: [],
    ukuranKue: [],
    aksesorisKue: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load all data
  const loadData = useCallback(async () => {
    if (!isInitialized) return;

    try {
      setLoading(true);
      setError(null);

      // Load master data
      const [jenisKue, variasiKue, ukuranKue, aksesorisKue] = await Promise.all([
        sqliteService.getAllJenisKue(),
        sqliteService.getAllVariasiKue(),
        sqliteService.getAllUkuranKue(),
        sqliteService.getAllAksesorisKue(),
      ]);

      setMasterData({
        jenisKue: jenisKue.map((j) => ({ id: j.id, nama: j.nama })),
        variasiKue: variasiKue.map((v) => ({ id: v.id, nama: v.nama })),
        ukuranKue: ukuranKue.map((u) => ({ id: u.id, nama: u.nama })),
        aksesorisKue: aksesorisKue.map((a) => ({
          id: a.id,
          nama: a.nama,
          harga: a.harga,
        })),
      });

      // Load orders - simple query without JOINs since we store names directly
      const ordersData = await sqliteService.query<OrderWithDetails>(
        `SELECT * FROM pesanan_kue 
         WHERE deleted_at IS NULL
         ORDER BY tanggalAmbil ASC`
      );

      setOrders(ordersData);
    } catch (err: any) {
      setError(err.message || "Gagal memuat data pesanan");
      console.error("Error loading orders data:", err);
    } finally {
      setLoading(false);
    }
  }, [isInitialized]);

  // Load data when database is initialized
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Generate order number
  const generateOrderNumber = async (): Promise<string> => {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
    const prefix = `ORD-${dateStr}-`;

    const result = await sqliteService.getFirst<{ count: number }>(
      `SELECT COUNT(*) as count FROM pesanan_kue WHERE nomorPesanan LIKE ?`,
      [`${prefix}%`]
    );

    const count = (result?.count || 0) + 1;
    return `${prefix}${count.toString().padStart(4, "0")}`;
  };

  // Create order
  const createOrder = useCallback(
    async (orderData: OrderData, imageUri?: string) => {
      try {
        setError(null);

        const id = sqliteService.generateId();
        const nomorPesanan = await generateOrderNumber();
        const timestamp = sqliteService.getCurrentTimestamp();
        const dpBayar = orderData.dpBayar || 0;
        const sisaPembayaran = orderData.totalHarga - dpBayar;

        await sqliteService.run(
          `INSERT INTO pesanan_kue (
            id, nomorPesanan, namaPelanggan, noHp, tanggalPesan, tanggalAmbil,
            jenisKue, variasiKue, ukuranKue, kotakKue, aksesorisKue, tulisanKue, warnaTema,
            totalHarga, dpBayar, sisaPembayaran, statusPesanan, metodePembayaran, catatan, gambarReferensi,
            dibuat, diperbarui, device_id, version, sync_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, 1, 'pending')`,
          [
            id,
            nomorPesanan,
            orderData.namaPelanggan,
            orderData.noHp || null,
            timestamp.split("T")[0],
            orderData.tanggalAmbil,
            orderData.jenisKue,
            orderData.variasiKue || null,
            orderData.ukuranKue,
            orderData.kotakKue || null,
            orderData.aksesorisKue || null,
            orderData.tulisanKue || null,
            orderData.warnaTema || null,
            orderData.totalHarga,
            dpBayar,
            sisaPembayaran,
            orderData.metodePembayaran || null,
            orderData.catatan || null,
            imageUri || orderData.gambarReferensi || null,
            timestamp,
            timestamp,
            sqliteService.getDeviceId(),
          ]
        );

        await loadData();
        return { id, nomorPesanan };
      } catch (err: any) {
        setError(err.message || "Gagal membuat pesanan");
        throw err;
      }
    },
    [loadData]
  );

  // Update order
  const updateOrder = useCallback(
    async (id: string, orderData: Partial<OrderData>, imageUri?: string) => {
      try {
        setError(null);

        const timestamp = sqliteService.getCurrentTimestamp();
        const fields: string[] = [];
        const values: any[] = [];

        if (orderData.namaPelanggan !== undefined) {
          fields.push("namaPelanggan = ?");
          values.push(orderData.namaPelanggan);
        }
        if (orderData.noHp !== undefined) {
          fields.push("noHp = ?");
          values.push(orderData.noHp);
        }
        if (orderData.tanggalAmbil !== undefined) {
          fields.push("tanggalAmbil = ?");
          values.push(orderData.tanggalAmbil);
        }
        if (orderData.jenisKue !== undefined) {
          fields.push("jenisKue = ?");
          values.push(orderData.jenisKue);
        }
        if (orderData.variasiKue !== undefined) {
          fields.push("variasiKue = ?");
          values.push(orderData.variasiKue);
        }
        if (orderData.ukuranKue !== undefined) {
          fields.push("ukuranKue = ?");
          values.push(orderData.ukuranKue);
        }
        if (orderData.tulisanKue !== undefined) {
          fields.push("tulisanKue = ?");
          values.push(orderData.tulisanKue);
        }
        if (orderData.catatan !== undefined) {
          fields.push("catatan = ?");
          values.push(orderData.catatan);
        }
        if (orderData.totalHarga !== undefined) {
          fields.push("totalHarga = ?");
          values.push(orderData.totalHarga);
        }
        if (orderData.dpBayar !== undefined) {
          fields.push("dpBayar = ?");
          values.push(orderData.dpBayar);
          const sisaPembayaran = (orderData.totalHarga || 0) - orderData.dpBayar;
          fields.push("sisaPembayaran = ?");
          values.push(sisaPembayaran);
        }
        if (imageUri) {
          fields.push("gambarReferensi = ?");
          values.push(imageUri);
        }

        fields.push("diperbarui = ?");
        fields.push("sync_status = 'pending'");
        fields.push("version = version + 1");
        values.push(timestamp, id);

        await sqliteService.run(
          `UPDATE pesanan_kue SET ${fields.join(", ")} WHERE id = ?`,
          values
        );

        await loadData();
      } catch (err: any) {
        setError(err.message || "Gagal memperbarui pesanan");
        throw err;
      }
    },
    [loadData]
  );

  // Delete order (soft delete)
  const deleteOrder = useCallback(
    async (id: string) => {
      try {
        setError(null);

        const timestamp = sqliteService.getCurrentTimestamp();

        await sqliteService.run(
          `UPDATE pesanan_kue SET deleted_at = ?, sync_status = 'pending', version = version + 1 WHERE id = ?`,
          [timestamp, id]
        );

        await loadData();
      } catch (err: any) {
        setError(err.message || "Gagal menghapus pesanan");
        throw err;
      }
    },
    [loadData]
  );

  // Update order status
  const updateOrderStatus = useCallback(
    async (id: string, newStatus: string) => {
      try {
        setError(null);

        const timestamp = sqliteService.getCurrentTimestamp();

        await sqliteService.run(
          `UPDATE pesanan_kue SET statusPesanan = ?, diperbarui = ?, sync_status = 'pending', version = version + 1 WHERE id = ?`,
          [newStatus, timestamp, id]
        );

        await loadData();
      } catch (err: any) {
        setError(err.message || "Gagal memperbarui status pesanan");
        throw err;
      }
    },
    [loadData]
  );

  // Cancel order
  const cancelOrder = useCallback(
    async (id: string, reason?: string) => {
      try {
        setError(null);

        const timestamp = sqliteService.getCurrentTimestamp();

        await sqliteService.run(
          `UPDATE pesanan_kue SET statusPesanan = 'dibatalkan', catatan = COALESCE(?, catatan), diperbarui = ?, sync_status = 'pending', version = version + 1 WHERE id = ?`,
          [reason, timestamp, id]
        );

        await loadData();
      } catch (err: any) {
        setError(err.message || "Gagal membatalkan pesanan");
        throw err;
      }
    },
    [loadData]
  );

  // Complete order
  const completeOrder = useCallback(
    async (id: string) => {
      return updateOrderStatus(id, "selesai");
    },
    [updateOrderStatus]
  );

  // Search orders
  const searchOrders = useCallback(
    (searchTerm: string) => {
      if (!searchTerm.trim()) return orders;

      const term = searchTerm.toLowerCase();
      return orders.filter(
        (order) =>
          order.namaPelanggan.toLowerCase().includes(term) ||
          (order.noHp && order.noHp.includes(term)) ||
          order.nomorPesanan.toLowerCase().includes(term)
      );
    },
    [orders]
  );

  // Get orders by status
  const getOrdersByStatus = useCallback(
    (status: string) => {
      return orders.filter((order) => order.statusPesanan === status);
    },
    [orders]
  );

  // Get orders by pickup date
  const getOrdersByPickupDate = useCallback(
    (date: Date) => {
      const dateStr = date.toISOString().split("T")[0];
      return orders.filter((order) => order.tanggalAmbil === dateStr);
    },
    [orders]
  );

  // Get today's pickups
  const getTodayPickups = useCallback(() => {
    const today = new Date().toISOString().split("T")[0];
    return orders.filter(
      (order) =>
        order.tanggalAmbil === today &&
        ["pending", "diproses", "siap"].includes(order.statusPesanan)
    );
  }, [orders]);

  // Get overdue orders
  const getOverdueOrders = useCallback(() => {
    const today = new Date().toISOString().split("T")[0];
    return orders.filter(
      (order) =>
        order.tanggalAmbil < today &&
        ["pending", "diproses"].includes(order.statusPesanan)
    );
  }, [orders]);

  // Get orders needing attention
  const getOrdersNeedingAttention = useCallback(() => {
    const today = new Date().toISOString().split("T")[0];
    return {
      overdue: orders.filter(
        (order) =>
          order.tanggalAmbil < today &&
          ["pending", "diproses"].includes(order.statusPesanan)
      ),
      todayPickups: orders.filter(
        (order) =>
          order.tanggalAmbil === today &&
          ["pending", "diproses", "siap"].includes(order.statusPesanan)
      ),
      inProgress: orders.filter((order) => order.statusPesanan === "diproses"),
    };
  }, [orders]);

  // Get order statistics
  const getOrderStats = useCallback(
    async (startDate?: Date, endDate?: Date) => {
      try {
        let filtered = orders;

        if (startDate) {
          const start = startDate.toISOString().split("T")[0];
          filtered = filtered.filter((o) => o.tanggalAmbil >= start);
        }
        if (endDate) {
          const end = endDate.toISOString().split("T")[0];
          filtered = filtered.filter((o) => o.tanggalAmbil <= end);
        }

        const totalPesanan = filtered.length;
        const totalPendapatan = filtered.reduce(
          (sum, o) => sum + o.totalHarga,
          0
        );

        const statusStats: Record<string, number> = {};
        filtered.forEach((o) => {
          statusStats[o.statusPesanan] =
            (statusStats[o.statusPesanan] || 0) + 1;
        });

        const jenisKueStats: Record<string, number> = {};
        filtered.forEach((o) => {
          if (o.jenisKue) {
            jenisKueStats[o.jenisKue] =
              (jenisKueStats[o.jenisKue] || 0) + 1;
          }
        });

        return {
          totalPesanan,
          totalPendapatan,
          statusStats,
          jenisKueStats,
        };
      } catch (err: any) {
        setError(err.message || "Gagal mengambil statistik pesanan");
        return {
          totalPesanan: 0,
          totalPendapatan: 0,
          statusStats: {},
          jenisKueStats: {},
        };
      }
    },
    [orders]
  );

  // Get popular cake combinations
  const getPopularCakeCombinations = useCallback(
    async (limit: number = 5) => {
      const combinations: Record<string, number> = {};

      orders.forEach((order) => {
        const key = `${order.jenisKue}-${order.variasiKue || 'Standard'}-${order.ukuranKue}`;
        combinations[key] = (combinations[key] || 0) + 1;
      });

      return Object.entries(combinations)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
    },
    [orders]
  );

  // Get order by ID
  const getOrderById = useCallback(
    (id: string) => {
      return orders.find((order) => order.id === id) || null;
    },
    [orders]
  );

  // Bulk update order status
  const bulkUpdateOrderStatus = useCallback(
    async (orderIds: string[], newStatus: string) => {
      try {
        setError(null);

        const timestamp = sqliteService.getCurrentTimestamp();

        for (const id of orderIds) {
          await sqliteService.run(
            `UPDATE pesanan_kue SET statusPesanan = ?, diperbarui = ?, sync_status = 'pending', version = version + 1 WHERE id = ?`,
            [newStatus, timestamp, id]
          );
        }

        await loadData();
      } catch (err: any) {
        setError(
          err.message || "Gagal memperbarui status pesanan secara massal"
        );
        throw err;
      }
    },
    [loadData]
  );

  // Get this week orders
  const getThisWeekOrders = useCallback(() => {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    const start = startOfWeek.toISOString().split("T")[0];
    const end = endOfWeek.toISOString().split("T")[0];

    return orders.filter(
      (o) => o.tanggalAmbil >= start && o.tanggalAmbil <= end
    );
  }, [orders]);

  // Get this month orders
  const getThisMonthOrders = useCallback(() => {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const start = startOfMonth.toISOString().split("T")[0];
    const end = endOfMonth.toISOString().split("T")[0];

    return orders.filter(
      (o) => o.tanggalAmbil >= start && o.tanggalAmbil <= end
    );
  }, [orders]);

  const refetch = useCallback(() => {
    loadData();
  }, [loadData]);

  return {
    // Data
    orders,
    masterData,

    // States
    loading,
    error,

    // Order operations
    createOrder,
    updateOrder,
    deleteOrder,
    updateOrderStatus,
    cancelOrder,
    completeOrder,

    // Search and filter
    searchOrders,
    getOrdersByStatus,
    getOrdersByPickupDate,
    getTodayPickups,
    getOverdueOrders,
    getOrdersNeedingAttention,

    // Statistics
    getOrderStats,
    getPopularCakeCombinations,

    // Utilities
    getOrderById,
    bulkUpdateOrderStatus,
    getThisWeekOrders,
    getThisMonthOrders,
    refetch,
  };
};

export type { MasterData, OrderData, OrderWithDetails };
export default useOrders;