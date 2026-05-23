// hooks/useTransactions.ts - Fixed v3
import { useCallback, useEffect, useState } from "react";
import { useDatabase } from "../context/DatabaseProvider";
import {
  CartItem,
  TransactionData,
  transactionRepository,
  TransactionWithDetails,
} from "../repositories/TransactionRepository";

export const useTransactions = () => {
  const { isInitialized } = useDatabase();

  const [transactions, setTransactions] = useState<TransactionWithDetails[]>(
    []
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!isInitialized) return;

    try {
      setLoading(true);
      setError(null);
      const data = await transactionRepository.getAllTransactions();
      setTransactions(data);
    } catch (err: any) {
      setError(err.message || "Gagal memuat data transaksi");
      console.error("Error loading transactions:", err);
    } finally {
      setLoading(false);
    }
  }, [isInitialized]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const createTransaction = useCallback(
    async (transactionData: TransactionData) => {
      try {
        setError(null);
        const newTransaction = await transactionRepository.createTransaction(
          transactionData
        );
        await loadData();
        return newTransaction;
      } catch (err: any) {
        setError(err.message || "Gagal membuat transaksi");
        console.error("❌ Error creating transaction:", err);
        throw err;
      }
    },
    [loadData]
  );

  const deleteTransaction = useCallback(
    async (id: string) => {
      try {
        setError(null);
        await transactionRepository.deleteTransaction(id);
        await loadData();
      } catch (err: any) {
        setError(err.message || "Gagal menghapus transaksi");
        throw err;
      }
    },
    [loadData]
  );

  const searchTransactions = useCallback(async (searchTerm: string) => {
    try {
      setError(null);
      return await transactionRepository.searchTransactions(searchTerm);
    } catch (err: any) {
      setError(err.message || "Gagal mencari transaksi");
      return [];
    }
  }, []);

  const getTransactionsByDate = useCallback(
    async (startDate: Date, endDate: Date) => {
      try {
        setError(null);
        return await transactionRepository.getTransactionsByDate(
          startDate,
          endDate
        );
      } catch (err: any) {
        setError(
          err.message || "Gagal mengambil transaksi berdasarkan tanggal"
        );
        return [];
      }
    },
    []
  );

  const getTransactionById = useCallback(async (id: string) => {
    try {
      setError(null);
      return await transactionRepository.getTransactionById(id);
    } catch (err: any) {
      setError(err.message || "Gagal mengambil transaksi");
      return null;
    }
  }, []);

  const getTransactionsByPaymentMethod = useCallback(async (method: string) => {
    try {
      setError(null);
      return await transactionRepository.getTransactionsByPaymentMethod(method);
    } catch (err: any) {
      setError(
        err.message || "Gagal mengambil transaksi berdasarkan metode pembayaran"
      );
      return [];
    }
  }, []);

  const getTodayTransactions = useCallback(async () => {
    try {
      setError(null);
      return await transactionRepository.getTodayTransactions();
    } catch (err: any) {
      setError(err.message || "Gagal mengambil transaksi hari ini");
      return [];
    }
  }, []);

  const updateTransactionStatus = useCallback(
    async (id: string, newStatus: string) => {
      try {
        setError(null);
        await transactionRepository.updateTransactionStatus(id, newStatus);
        await loadData();
      } catch (err: any) {
        setError(err.message || "Gagal memperbarui status transaksi");
        throw err;
      }
    },
    [loadData]
  );

  // FIX: Add markAsPickedUp function
  const markAsPickedUp = useCallback(
    async (id: string) => {
      try {
        setError(null);
        await transactionRepository.markAsPickedUp(id);
        await loadData();
      } catch (err: any) {
        setError(err.message || "Gagal menandai pesanan sudah diambil");
        throw err;
      }
    },
    [loadData]
  );

  const getSalesStats = useCallback(
    async (startDate?: Date, endDate?: Date) => {
      try {
        setError(null);
        return await transactionRepository.getSalesStats(startDate, endDate);
      } catch (err: any) {
        setError(err.message || "Gagal mengambil statistik penjualan");
        return {
          totalTransaksi: 0,
          totalPendapatan: 0,
          totalItem: 0,
          rataRataTransaksi: 0,
          metodePembayaranStats: {},
        };
      }
    },
    []
  );

  const getTopSellingProducts = useCallback(
    async (limit: number = 10, startDate?: Date, endDate?: Date) => {
      try {
        setError(null);
        return await transactionRepository.getTopSellingProducts(
          limit,
          startDate,
          endDate
        );
      } catch (err: any) {
        setError(err.message || "Gagal mengambil produk terlaris");
        return [];
      }
    },
    []
  );

  const getDailySales = useCallback(async (days: number = 30) => {
    try {
      setError(null);
      return await transactionRepository.getDailySales(days);
    } catch (err: any) {
      setError(err.message || "Gagal mengambil penjualan harian");
      return [];
    }
  }, []);

  const getMonthlySales = useCallback(async (year: number, month: number) => {
    try {
      setError(null);
      return await transactionRepository.getMonthlySales(year, month);
    } catch (err: any) {
      setError(err.message || "Gagal mengambil ringkasan penjualan bulanan");
      return {
        totalTransaksi: 0,
        totalPendapatan: 0,
        totalItem: 0,
        rataRataTransaksi: 0,
      };
    }
  }, []);

  const calculateCartTotal = useCallback((items: CartItem[]) => {
    return items.reduce((total, item) => total + item.subtotal, 0);
  }, []);

  const calculateCartItemCount = useCallback((items: CartItem[]) => {
    return items.reduce((total, item) => total + item.jumlah, 0);
  }, []);

  const validateCartItems = useCallback((items: CartItem[]) => {
    if (items.length === 0) throw new Error("Keranjang kosong");
    for (const item of items) {
      if (item.jumlah <= 0)
        throw new Error(
          `Jumlah ${item.namaItem || item.namaProduk} harus lebih dari 0`
        );
      if (item.hargaSatuan <= 0)
        throw new Error(
          `Harga ${item.namaItem || item.namaProduk} tidak valid`
        );
    }
  }, []);

  const getPaymentMethodStats = useCallback(
    async (startDate?: Date, endDate?: Date) => {
      try {
        setError(null);
        const stats = await transactionRepository.getSalesStats(
          startDate,
          endDate
        );
        return stats.metodePembayaranStats;
      } catch (err: any) {
        setError(err.message || "Gagal mengambil statistik metode pembayaran");
        return {};
      }
    },
    []
  );

  const getWeeklySalesData = useCallback(async () => {
    try {
      setError(null);
      const today = new Date();
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);
      return await transactionRepository.getSalesStats(startOfWeek, endOfWeek);
    } catch (err: any) {
      setError(err.message || "Gagal mengambil data penjualan mingguan");
      return {
        totalTransaksi: 0,
        totalPendapatan: 0,
        totalItem: 0,
        rataRataTransaksi: 0,
        metodePembayaranStats: {},
      };
    }
  }, []);

  const getMonthlySalesData = useCallback(async () => {
    try {
      setError(null);
      const today = new Date();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      endOfMonth.setHours(23, 59, 59, 999);
      return await transactionRepository.getSalesStats(
        startOfMonth,
        endOfMonth
      );
    } catch (err: any) {
      setError(err.message || "Gagal mengambil data penjualan bulanan");
      return {
        totalTransaksi: 0,
        totalPendapatan: 0,
        totalItem: 0,
        rataRataTransaksi: 0,
        metodePembayaranStats: {},
      };
    }
  }, []);

  const getYearlySalesData = useCallback(async () => {
    try {
      setError(null);
      const today = new Date();
      const startOfYear = new Date(today.getFullYear(), 0, 1);
      const endOfYear = new Date(today.getFullYear(), 11, 31, 23, 59, 59, 999);
      return await transactionRepository.getSalesStats(startOfYear, endOfYear);
    } catch (err: any) {
      setError(err.message || "Gagal mengambil data penjualan tahunan");
      return {
        totalTransaksi: 0,
        totalPendapatan: 0,
        totalItem: 0,
        rataRataTransaksi: 0,
        metodePembayaranStats: {},
      };
    }
  }, []);

  const refetch = useCallback(() => {
    loadData();
  }, [loadData]);

  return {
    transactions,
    loading,
    error,
    createTransaction,
    deleteTransaction,
    updateTransactionStatus,
    markAsPickedUp, // FIX: Added
    searchTransactions,
    getTransactionsByDate,
    getTransactionById,
    getTransactionsByPaymentMethod,
    getTodayTransactions,
    getSalesStats,
    getTopSellingProducts,
    getDailySales,
    getMonthlySales,
    getPaymentMethodStats,
    getWeeklySalesData,
    getMonthlySalesData,
    getYearlySalesData,
    calculateCartTotal,
    calculateCartItemCount,
    validateCartItems,
    refetch,
  };
};

export type { CartItem, TransactionData, TransactionWithDetails };
