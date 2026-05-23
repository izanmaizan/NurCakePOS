// hooks/useKueReady.ts - Fixed version using sqliteService directly
import { useCallback, useEffect, useState } from "react";
import { useDatabase } from "../context/DatabaseProvider";
import { KueReady, sqliteService } from "../database/SQLiteService";

export interface KueReadyItem extends KueReady {}

export interface KueReadyForm {
  nama: string;
  jenisKue: string;
  variasiKue: string;
  ukuranKue: string;
  hargaJual: number;
  gambarPath?: string;
  status?: string;
  catatan?: string;
}

export const useKueReady = () => {
  const { isInitialized } = useDatabase();
  const [kueReadyList, setKueReadyList] = useState<KueReadyItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load all kue ready
  const loadKueReady = useCallback(async () => {
    if (!isInitialized) return;

    try {
      setLoading(true);
      setError(null);

      const kueReadyData = await sqliteService.getAllKueReady();
      setKueReadyList(kueReadyData);
    } catch (err: any) {
      setError(err.message || "Gagal memuat data kue ready");
      console.error("Error loading kue ready:", err);
    } finally {
      setLoading(false);
    }
  }, [isInitialized]);

  // Load data when database is initialized
  useEffect(() => {
    loadKueReady();
  }, [loadKueReady]);

  // Add kue ready
  const addKueReady = useCallback(
    async (kueReadyData: KueReadyForm) => {
      try {
        setError(null);

        const newKue = await sqliteService.createKueReady({
          nama: kueReadyData.nama,
          jenisKue: kueReadyData.jenisKue,
          variasiKue: kueReadyData.variasiKue,
          ukuranKue: kueReadyData.ukuranKue,
          hargaJual: kueReadyData.hargaJual,
          gambarPath: kueReadyData.gambarPath,
          status: kueReadyData.status || "tersedia",
          catatan: kueReadyData.catatan,
        });

        await loadKueReady();
        return newKue.id;
      } catch (err: any) {
        setError(err.message || "Gagal menambah kue ready");
        throw err;
      }
    },
    [loadKueReady]
  );

  // Update kue ready
  const updateKueReady = useCallback(
    async (id: string, kueReadyData: Partial<KueReadyForm>) => {
      try {
        setError(null);

        await sqliteService.updateKueReady(id, kueReadyData);
        await loadKueReady();
      } catch (err: any) {
        setError(err.message || "Gagal memperbarui kue ready");
        throw err;
      }
    },
    [loadKueReady]
  );

  // Delete kue ready
  const deleteKueReady = useCallback(
    async (id: string) => {
      try {
        setError(null);

        // Get the item to delete its image file if exists
        const item = kueReadyList.find((k) => k.id === id);
        if (item?.gambarPath) {
          await sqliteService.deleteFile(item.gambarPath);
        }

        await sqliteService.deleteKueReady(id);
        await loadKueReady();
      } catch (err: any) {
        setError(err.message || "Gagal menghapus kue ready");
        throw err;
      }
    },
    [loadKueReady, kueReadyList]
  );

  // Search kue ready
  const searchKueReady = useCallback(
    (searchTerm: string, status?: string) => {
      let filtered = kueReadyList;

      if (status) {
        filtered = filtered.filter((item) => item.status === status);
      }

      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        filtered = filtered.filter(
          (item) =>
            item.nama.toLowerCase().includes(term) ||
            item.jenisKue.toLowerCase().includes(term) ||
            item.variasiKue.toLowerCase().includes(term) ||
            item.ukuranKue.toLowerCase().includes(term) ||
            (item.catatan && item.catatan.toLowerCase().includes(term))
        );
      }

      return filtered;
    },
    [kueReadyList]
  );

  // Get kue ready by id
  const getKueReadyById = useCallback(
    (id: string) => {
      return kueReadyList.find((item) => item.id === id) || null;
    },
    [kueReadyList]
  );

  // Get statistics
  const getKueReadyStats = useCallback(async () => {
    try {
      const total = kueReadyList.length;
      const available = kueReadyList.filter(
        (item) => item.status === "tersedia"
      ).length;
      const unavailable = kueReadyList.filter(
        (item) => item.status !== "tersedia"
      ).length;
      const avgPrice =
        total > 0
          ? Math.round(
              kueReadyList.reduce((sum, item) => sum + item.hargaJual, 0) /
                total
            )
          : 0;

      return {
        total,
        available,
        unavailable,
        averagePrice: avgPrice,
      };
    } catch (err: any) {
      setError(err.message || "Gagal mengambil statistik kue ready");
      return {
        total: 0,
        available: 0,
        unavailable: 0,
        averagePrice: 0,
      };
    }
  }, [kueReadyList]);

  return {
    kueReadyList,
    loading,
    error,
    addKueReady,
    updateKueReady,
    deleteKueReady,
    searchKueReady,
    getKueReadyById,
    getKueReadyStats,
    refetch: loadKueReady,
  };
};

export default useKueReady;
