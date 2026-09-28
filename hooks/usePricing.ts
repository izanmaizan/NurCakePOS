// hooks/usePricing.ts - Fixed version using sqliteService directly
import { useCallback, useEffect, useState } from "react";
import { useDatabase } from "../context/DatabaseProvider";
import { sqliteService } from "../database/SQLiteService";

export interface KriteriaItem {
  id: string;
  nama: string;
}

export interface MasterKriteria {
  jenisKue: KriteriaItem[];
  variasiKue: KriteriaItem[];
  ukuranKue: KriteriaItem[];
  kotakKue: KriteriaItem[];
}

export interface RulesHarga {
  id: string;
  jenisKueId: string;
  variasiKueId: string;
  ukuranKueId: string;
  kotakKueId: string;
  hargaModal: number;
  hargaJual: number;
  margin: number;
  dibuat: string;
  diperbarui: string;
}

export interface RulesHargaWithDetails extends RulesHarga {
  jenisKue: string;
  variasiKue: string;
  ukuranKue: string;
  kotakKue: string;
}

export const usePricing = () => {
  const { isInitialized } = useDatabase();

  // States for kriteria
  const [masterKriteria, setMasterKriteria] = useState<MasterKriteria>({
    jenisKue: [],
    variasiKue: [],
    ukuranKue: [],
    kotakKue: [],
  });

  // States for rules harga
  const [rulesHarga, setRulesHarga] = useState<RulesHargaWithDetails[]>([]);

  // Loading states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load all data
  const loadData = useCallback(async () => {
    if (!isInitialized) return;

    try {
      setLoading(true);
      setError(null);

      // Load master kriteria
      const [jenisKue, variasiKue, ukuranKue, kotakKue] = await Promise.all([
        sqliteService.getAllJenisKue(),
        sqliteService.getAllVariasiKue(),
        sqliteService.getAllUkuranKue(),
        sqliteService.getAllKotakKue(),
      ]);

      setMasterKriteria({
        jenisKue: jenisKue.map((item) => ({ id: item.id, nama: item.nama })),
        variasiKue: variasiKue.map((item) => ({
          id: item.id,
          nama: item.nama,
        })),
        ukuranKue: ukuranKue.map((item) => ({ id: item.id, nama: item.nama })),
        kotakKue: kotakKue.map((item) => ({ id: item.id, nama: item.nama })),
      });

      // Load rules harga from pengaturan
      const rulesSettings = await sqliteService.query<{
        id: string;
        key: string;
        value: string;
        dibuat: string;
        diperbarui: string;
      }>(
        'SELECT * FROM pengaturan WHERE key LIKE "rules_harga_%" ORDER BY diperbarui DESC'
      );

      const rulesWithDetails: RulesHargaWithDetails[] = [];

      for (const setting of rulesSettings) {
        try {
          const ruleData = JSON.parse(setting.value);

          // Get detail names from master data
          const jenisItem = jenisKue.find((j) => j.id === ruleData.jenisKueId);
          const variasiItem = variasiKue.find(
            (v) => v.id === ruleData.variasiKueId
          );
          const ukuranItem = ukuranKue.find(
            (u) => u.id === ruleData.ukuranKueId
          );
          const kotakItem = kotakKue.find((k) => k.id === ruleData.kotakKueId);

          rulesWithDetails.push({
            id: setting.id,
            jenisKueId: ruleData.jenisKueId,
            variasiKueId: ruleData.variasiKueId,
            ukuranKueId: ruleData.ukuranKueId,
            kotakKueId: ruleData.kotakKueId,
            hargaModal: ruleData.hargaModal,
            hargaJual: ruleData.hargaJual,
            margin: ruleData.margin || 0,
            dibuat: setting.dibuat,
            diperbarui: setting.diperbarui,
            jenisKue: jenisItem?.nama || "Unknown",
            variasiKue: variasiItem?.nama || "Unknown",
            ukuranKue: ukuranItem?.nama || "Unknown",
            kotakKue: kotakItem?.nama || "Unknown",
          });
        } catch (parseError) {
          console.error("Error parsing rules data:", parseError);
          continue;
        }
      }

      setRulesHarga(rulesWithDetails);
    } catch (err: any) {
      setError(err.message || "Gagal memuat data pricing");
      console.error("Error loading pricing data:", err);
    } finally {
      setLoading(false);
    }
  }, [isInitialized]);

  // Load data when database is initialized
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Add kriteria item
  const addKriteriaItem = useCallback(
    async (
      type: "jenisKue" | "variasiKue" | "ukuranKue" | "kotakKue",
      nama: string
    ) => {
      try {
        setError(null);

        if (!nama.trim()) {
          throw new Error("Nama kriteria harus diisi");
        }

        // Check for duplicate name
        const currentItems = masterKriteria[type];
        const isDuplicate = currentItems.some(
          (item) => item.nama.toLowerCase() === nama.toLowerCase().trim()
        );

        if (isDuplicate) {
          throw new Error("Nama kriteria sudah ada");
        }

        const id = sqliteService.generateId();
        const timestamp = sqliteService.getCurrentTimestamp();

        let sql: string;
        let params: any[];

        switch (type) {
          case "jenisKue":
            sql =
              "INSERT INTO jenis_kue (id, nama, hargaBase, dibuat, diperbarui) VALUES (?, ?, 0, ?, ?)";
            params = [id, nama.trim(), timestamp, timestamp];
            break;
          case "variasiKue":
            sql =
              "INSERT INTO variasi_kue (id, nama, hargaTambahan, dibuat, diperbarui) VALUES (?, ?, 0, ?, ?)";
            params = [id, nama.trim(), timestamp, timestamp];
            break;
          case "ukuranKue":
            sql =
              "INSERT INTO ukuran_kue (id, nama, multiplierHarga, dibuat, diperbarui) VALUES (?, ?, 1.0, ?, ?)";
            params = [id, nama.trim(), timestamp, timestamp];
            break;
          case "kotakKue":
            sql =
              "INSERT INTO kotak_kue (id, nama, hargaTambahan, dibuat, diperbarui) VALUES (?, ?, 0, ?, ?)";
            params = [id, nama.trim(), timestamp, timestamp];
            break;
          default:
            throw new Error("Invalid kriteria type");
        }

        await sqliteService.run(sql, params);
        await loadData();

        return { id, nama: nama.trim() };
      } catch (err: any) {
        setError(err.message || "Gagal menambah kriteria");
        throw err;
      }
    },
    [masterKriteria, loadData]
  );

  // Update kriteria item
  const updateKriteriaItem = useCallback(
    async (
      type: "jenisKue" | "variasiKue" | "ukuranKue" | "kotakKue",
      id: string,
      nama: string
    ) => {
      try {
        setError(null);

        if (!nama.trim()) {
          throw new Error("Nama kriteria harus diisi");
        }

        const tableName = getTableName(type);
        const timestamp = sqliteService.getCurrentTimestamp();

        await sqliteService.run(
          `UPDATE ${tableName} SET nama = ?, diperbarui = ? WHERE id = ?`,
          [nama.trim(), timestamp, id]
        );

        await loadData();
        return { id, nama: nama.trim() };
      } catch (err: any) {
        setError(err.message || "Gagal memperbarui kriteria");
        throw err;
      }
    },
    [loadData]
  );

  // Delete kriteria item
  const deleteKriteriaItem = useCallback(
    async (
      type: "jenisKue" | "variasiKue" | "ukuranKue" | "kotakKue",
      id: string
    ) => {
      try {
        setError(null);

        // Check if used in rules harga
        const fieldName = `${type}Id`;
        const isUsed = rulesHarga.some((rule: any) => rule[fieldName] === id);

        if (isUsed) {
          throw new Error(
            "Item kriteria tidak dapat dihapus karena masih digunakan dalam rules harga"
          );
        }

        const tableName = getTableName(type);
        await sqliteService.run(`DELETE FROM ${tableName} WHERE id = ?`, [id]);
        await loadData();
      } catch (err: any) {
        setError(err.message || "Gagal menghapus kriteria");
        throw err;
      }
    },
    [rulesHarga, loadData]
  );

  // Add rules harga
  const addRulesHarga = useCallback(
    async (rulesData: {
      jenisKueId: string;
      variasiKueId: string;
      ukuranKueId: string;
      kotakKueId: string;
      hargaModal: number;
      hargaJual: number;
    }) => {
      try {
        setError(null);

        // Validate
        if (
          !rulesData.jenisKueId ||
          !rulesData.variasiKueId ||
          !rulesData.ukuranKueId ||
          !rulesData.kotakKueId
        ) {
          throw new Error("Semua kriteria harus dipilih");
        }

        // Check for duplicate combination
        const isDuplicate = rulesHarga.some(
          (rule) =>
            rule.jenisKueId === rulesData.jenisKueId &&
            rule.variasiKueId === rulesData.variasiKueId &&
            rule.ukuranKueId === rulesData.ukuranKueId &&
            rule.kotakKueId === rulesData.kotakKueId
        );

        if (isDuplicate) {
          throw new Error("Kombinasi kriteria ini sudah ada");
        }

        const id = sqliteService.generateId();
        const timestamp = sqliteService.getCurrentTimestamp();
        const margin = calculateMargin(
          rulesData.hargaModal,
          rulesData.hargaJual
        );

        const ruleKey = `rules_harga_${id}`;
        const ruleValue = { ...rulesData, margin };

        await sqliteService.run(
          "INSERT INTO pengaturan (id, key, value, dibuat, diperbarui) VALUES (?, ?, ?, ?, ?)",
          [id, ruleKey, JSON.stringify(ruleValue), timestamp, timestamp]
        );

        await loadData();
        return { id, ...rulesData, margin };
      } catch (err: any) {
        setError(err.message || "Gagal menambah rules harga");
        throw err;
      }
    },
    [rulesHarga, loadData]
  );

  // Update rules harga
  const updateRulesHarga = useCallback(
    async (
      id: string,
      rulesData: {
        jenisKueId: string;
        variasiKueId: string;
        ukuranKueId: string;
        kotakKueId: string;
        hargaModal: number;
        hargaJual: number;
      }
    ) => {
      try {
        setError(null);

        const timestamp = sqliteService.getCurrentTimestamp();
        const margin = calculateMargin(
          rulesData.hargaModal,
          rulesData.hargaJual
        );

        const ruleValue = { ...rulesData, margin };

        await sqliteService.run(
          "UPDATE pengaturan SET value = ?, diperbarui = ? WHERE id = ?",
          [JSON.stringify(ruleValue), timestamp, id]
        );

        await loadData();
        return { id, ...rulesData, margin };
      } catch (err: any) {
        setError(err.message || "Gagal memperbarui rules harga");
        throw err;
      }
    },
    [loadData]
  );

  // Delete rules harga
  const deleteRulesHarga = useCallback(async (id: string) => {
    try {
      setError(null);
      await sqliteService.run("DELETE FROM pengaturan WHERE id = ?", [id]);
      setRulesHarga((prev) => prev.filter((rule) => rule.id !== id));
    } catch (err: any) {
      setError(err.message || "Gagal menghapus rules harga");
      throw err;
    }
  }, []);

  // Search rules harga
  const searchRulesHarga = useCallback(
    (searchTerm: string, jenisKueId?: string) => {
      let filtered = rulesHarga;

      if (jenisKueId) {
        filtered = filtered.filter((rule) => rule.jenisKueId === jenisKueId);
      }

      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        filtered = filtered.filter(
          (rule) =>
            rule.jenisKue.toLowerCase().includes(term) ||
            rule.variasiKue.toLowerCase().includes(term) ||
            rule.ukuranKue.toLowerCase().includes(term) ||
            rule.kotakKue.toLowerCase().includes(term)
        );
      }

      return filtered;
    },
    [rulesHarga]
  );

  // Get rules harga by combination
  const getRulesHargaByCombination = useCallback(
    (
      jenisKueId: string,
      variasiKueId: string,
      ukuranKueId: string,
      kotakKueId: string
    ) => {
      return (
        rulesHarga.find(
          (rule) =>
            rule.jenisKueId === jenisKueId &&
            rule.variasiKueId === variasiKueId &&
            rule.ukuranKueId === ukuranKueId &&
            rule.kotakKueId === kotakKueId
        ) || null
      );
    },
    [rulesHarga]
  );

  // Check combination exists
  const checkCombinationExists = useCallback(
    (
      jenisKueId: string,
      variasiKueId: string,
      ukuranKueId: string,
      kotakKueId: string,
      excludeId?: string
    ) => {
      return rulesHarga.some(
        (rule) =>
          rule.id !== excludeId &&
          rule.jenisKueId === jenisKueId &&
          rule.variasiKueId === variasiKueId &&
          rule.ukuranKueId === ukuranKueId &&
          rule.kotakKueId === kotakKueId
      );
    },
    [rulesHarga]
  );

  // Get pricing stats
  const getPricingStats = useCallback(async () => {
    try {
      const totalRules = rulesHarga.length;
      const averageMargin =
        totalRules > 0
          ? Math.round(
              rulesHarga.reduce((sum, rule) => sum + rule.margin, 0) /
                totalRules
            )
          : 0;

      return {
        totalRules,
        averageMargin,
        totalKriteria: {
          jenisKue: masterKriteria.jenisKue.length,
          variasiKue: masterKriteria.variasiKue.length,
          ukuranKue: masterKriteria.ukuranKue.length,
          kotakKue: masterKriteria.kotakKue.length,
        },
      };
    } catch (err: any) {
      setError(err.message || "Gagal mengambil statistik pricing");
      return {
        totalRules: 0,
        averageMargin: 0,
        totalKriteria: {
          jenisKue: 0,
          variasiKue: 0,
          ukuranKue: 0,
          kotakKue: 0,
        },
      };
    }
  }, [rulesHarga, masterKriteria]);

  const getKriteriaById = useCallback(
    (
      type: "jenisKue" | "variasiKue" | "ukuranKue" | "kotakKue",
      id: string
    ) => {
      return masterKriteria[type].find((item) => item.id === id) || null;
    },
    [masterKriteria]
  );

  const refetch = useCallback(() => {
    loadData();
  }, [loadData]);

  // Bulk operations
  const bulkAddKriteria = useCallback(
    async (
      type: "jenisKue" | "variasiKue" | "ukuranKue" | "kotakKue",
      items: string[]
    ) => {
      const results = [];
      for (const nama of items) {
        if (nama.trim()) {
          try {
            const newItem = await addKriteriaItem(type, nama.trim());
            results.push(newItem);
          } catch (error) {
            console.warn(`Failed to add ${nama}:`, error);
          }
        }
      }
      return results;
    },
    [addKriteriaItem]
  );

  const bulkDeleteRulesHarga = useCallback(async (ids: string[]) => {
    for (const id of ids) {
      await sqliteService.run("DELETE FROM pengaturan WHERE id = ?", [id]);
    }
    setRulesHarga((prev) => prev.filter((rule) => !ids.includes(rule.id)));
  }, []);

  const validateRulesData = useCallback(
    (rulesData: {
      jenisKueId: string;
      variasiKueId: string;
      ukuranKueId: string;
      kotakKueId: string;
      hargaModal: number;
      hargaJual: number;
    }) => {
      const errors: string[] = [];

      if (!masterKriteria.jenisKue.find((k) => k.id === rulesData.jenisKueId)) {
        errors.push("Jenis kue tidak valid");
      }
      if (
        !masterKriteria.variasiKue.find((k) => k.id === rulesData.variasiKueId)
      ) {
        errors.push("Variasi kue tidak valid");
      }
      if (
        !masterKriteria.ukuranKue.find((k) => k.id === rulesData.ukuranKueId)
      ) {
        errors.push("Ukuran kue tidak valid");
      }
      if (!masterKriteria.kotakKue.find((k) => k.id === rulesData.kotakKueId)) {
        errors.push("Kotak kue tidak valid");
      }
      if (rulesData.hargaModal <= 0) {
        errors.push("Harga modal harus lebih dari 0");
      }
      if (rulesData.hargaJual <= 0) {
        errors.push("Harga jual harus lebih dari 0");
      }
      if (rulesData.hargaJual <= rulesData.hargaModal) {
        errors.push("Harga jual harus lebih tinggi dari harga modal");
      }

      return errors;
    },
    [masterKriteria]
  );

  return {
    // Data
    masterKriteria,
    rulesHarga,

    // States
    loading,
    error,

    // Kriteria operations
    addKriteriaItem,
    updateKriteriaItem,
    deleteKriteriaItem,
    bulkAddKriteria,

    // Rules harga operations
    addRulesHarga,
    updateRulesHarga,
    deleteRulesHarga,
    bulkDeleteRulesHarga,

    // Search and filter
    searchRulesHarga,

    // Utilities
    getRulesHargaByCombination,
    calculateMargin,
    getPricingStats,
    checkCombinationExists,
    validateRulesData,
    getKriteriaById,
    refetch,
  };
};

// Helper functions
function getTableName(type: string): string {
  switch (type) {
    case "jenisKue":
      return "jenis_kue";
    case "variasiKue":
      return "variasi_kue";
    case "ukuranKue":
      return "ukuran_kue";
    case "kotakKue":
      return "kotak_kue";
    default:
      throw new Error("Invalid kriteria type");
  }
}

function calculateMargin(hargaModal: number, hargaJual: number): number {
  if (hargaModal <= 0) return 0;
  return Math.round(((hargaJual - hargaModal) / hargaModal) * 100);
}

export default usePricing;
