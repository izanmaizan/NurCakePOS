// repositories/PricingRepository.ts - Fixed with Complete SQLite Integration
import { sqliteService } from "../database/SQLiteService";

export interface KriteriaItem {
  id: string;
  nama: string;
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
  dibuat: Date;
  diperbarui: Date;
}

export interface RulesHargaWithDetails extends RulesHarga {
  jenisKue: string;
  variasiKue: string;
  ukuranKue: string;
  kotakKue: string;
}

export interface MasterKriteria {
  jenisKue: KriteriaItem[];
  variasiKue: KriteriaItem[];
  ukuranKue: KriteriaItem[];
  kotakKue: KriteriaItem[];
}

class PricingRepository {
  // ==================== KRITERIA MANAGEMENT ====================

  // Get all master criteria data
  async getAllKriteria(): Promise<MasterKriteria> {
    try {
      const [jenisKue, variasiKue, ukuranKue, kotakKue] = await Promise.all([
        sqliteService.getAll("SELECT id, nama FROM jenis_kue ORDER BY nama"),
        sqliteService.getAll("SELECT id, nama FROM variasi_kue ORDER BY nama"),
        sqliteService.getAll(
          "SELECT id, nama FROM ukuran_kue ORDER BY multiplier_harga"
        ),
        sqliteService.getAll(
          "SELECT id, nama FROM aksesoris_kue ORDER BY nama"
        ),
      ]);

      return {
        jenisKue: jenisKue.map((item: any) => ({
          id: item.id,
          nama: item.nama,
        })),
        variasiKue: variasiKue.map((item: any) => ({
          id: item.id,
          nama: item.nama,
        })),
        ukuranKue: ukuranKue.map((item: any) => ({
          id: item.id,
          nama: item.nama,
        })),
        kotakKue: kotakKue.map((item: any) => ({
          id: item.id,
          nama: item.nama,
        })),
      };
    } catch (error) {
      console.error("Error getting all kriteria:", error);
      return {
        jenisKue: [],
        variasiKue: [],
        ukuranKue: [],
        kotakKue: [],
      };
    }
  }

  // Add new kriteria item
  async addKriteriaItem(
    type: "jenisKue" | "variasiKue" | "ukuranKue" | "kotakKue",
    nama: string
  ): Promise<KriteriaItem> {
    try {
      const id = sqliteService.generateId();
      const timestamp = sqliteService.getCurrentTimestamp();

      let sql: string;
      let params: any[];

      switch (type) {
        case "jenisKue":
          // Check for duplicate
          const existingJenis = await sqliteService.getFirst(
            "SELECT id FROM jenis_kue WHERE LOWER(nama) = LOWER(?)",
            [nama]
          );
          if (existingJenis) {
            throw new Error("Nama jenis kue sudah ada");
          }

          sql =
            "INSERT INTO jenis_kue (id, nama, harga_base, dibuat) VALUES (?, ?, ?, ?)";
          params = [id, nama, 0, timestamp];
          break;

        case "variasiKue":
          // Check for duplicate
          const existingVariasi = await sqliteService.getFirst(
            "SELECT id FROM variasi_kue WHERE LOWER(nama) = LOWER(?)",
            [nama]
          );
          if (existingVariasi) {
            throw new Error("Nama variasi kue sudah ada");
          }

          sql =
            "INSERT INTO variasi_kue (id, nama, harga_tambahan, dibuat) VALUES (?, ?, ?, ?)";
          params = [id, nama, 0, timestamp];
          break;

        case "ukuranKue":
          // Check for duplicate
          const existingUkuran = await sqliteService.getFirst(
            "SELECT id FROM ukuran_kue WHERE LOWER(nama) = LOWER(?)",
            [nama]
          );
          if (existingUkuran) {
            throw new Error("Nama ukuran kue sudah ada");
          }

          sql =
            "INSERT INTO ukuran_kue (id, nama, multiplier_harga, dibuat) VALUES (?, ?, ?, ?)";
          params = [id, nama, 1.0, timestamp];
          break;

        case "kotakKue":
          // Check for duplicate
          const existingKotak = await sqliteService.getFirst(
            "SELECT id FROM aksesoris_kue WHERE LOWER(nama) = LOWER(?)",
            [nama]
          );
          if (existingKotak) {
            throw new Error("Nama kotak kue sudah ada");
          }

          sql =
            "INSERT INTO aksesoris_kue (id, nama, harga, dibuat) VALUES (?, ?, ?, ?)";
          params = [id, nama, 0, timestamp];
          break;

        default:
          throw new Error("Invalid kriteria type");
      }

      await sqliteService.executeQuery(sql, params);

      return {
        id,
        nama,
      };
    } catch (error: any) {
      console.error("Error adding kriteria item:", error);
      if (error.message && error.message.includes("sudah ada")) {
        throw error;
      }
      throw new Error("Gagal menambah kriteria");
    }
  }

  // Update kriteria item
  async updateKriteriaItem(
    type: "jenisKue" | "variasiKue" | "ukuranKue" | "kotakKue",
    id: string,
    nama: string
  ): Promise<KriteriaItem> {
    try {
      const tableName = this.getTableName(type);

      // Check for duplicate name (excluding current item)
      const existingItem = await sqliteService.getFirst(
        `SELECT id FROM ${tableName} WHERE LOWER(nama) = LOWER(?) AND id != ?`,
        [nama, id]
      );
      if (existingItem) {
        throw new Error("Nama kriteria sudah ada");
      }

      // Check if item exists
      const currentItem = await sqliteService.getFirst(
        `SELECT id FROM ${tableName} WHERE id = ?`,
        [id]
      );
      if (!currentItem) {
        throw new Error("Item kriteria tidak ditemukan");
      }

      const sql = `UPDATE ${tableName} SET nama = ? WHERE id = ?`;
      const result = await sqliteService.executeQuery(sql, [nama, id]);

      if (result.changes === 0) {
        throw new Error("Item kriteria tidak ditemukan");
      }

      return {
        id,
        nama,
      };
    } catch (error: any) {
      console.error("Error updating kriteria item:", error);
      if (error.message && error.message.includes("sudah ada")) {
        throw error;
      }
      throw new Error("Gagal memperbarui kriteria");
    }
  }

  // Delete kriteria item
  async deleteKriteriaItem(
    type: "jenisKue" | "variasiKue" | "ukuranKue" | "kotakKue",
    id: string
  ): Promise<void> {
    try {
      // Check if used in rules harga
      const rulesHarga = await this.getAllRulesHarga();
      const fieldName = `${type}Id`;

      const isUsed = rulesHarga.some((rule: any) => rule[fieldName] === id);
      if (isUsed) {
        throw new Error(
          "Item kriteria tidak dapat dihapus karena masih digunakan dalam rules harga"
        );
      }

      const tableName = this.getTableName(type);
      const sql = `DELETE FROM ${tableName} WHERE id = ?`;

      const result = await sqliteService.executeQuery(sql, [id]);

      if (result.changes === 0) {
        throw new Error("Item kriteria tidak ditemukan");
      }
    } catch (error: any) {
      console.error("Error deleting kriteria item:", error);
      throw error;
    }
  }

  private getTableName(type: string): string {
    switch (type) {
      case "jenisKue":
        return "jenis_kue";
      case "variasiKue":
        return "variasi_kue";
      case "ukuranKue":
        return "ukuran_kue";
      case "kotakKue":
        return "aksesoris_kue";
      default:
        throw new Error("Invalid kriteria type");
    }
  }

  // ==================== RULES HARGA MANAGEMENT ====================

  // Get all rules harga
  async getAllRulesHarga(): Promise<RulesHargaWithDetails[]> {
    try {
      // Get rules from pengaturan table with key pattern "rules_harga_*"
      const rulesSettings = await sqliteService.getAll(
        'SELECT * FROM pengaturan WHERE key LIKE "rules_harga_%" ORDER BY diperbarui DESC'
      );

      const results: RulesHargaWithDetails[] = [];

      for (const setting of rulesSettings) {
        try {
          const ruleData = JSON.parse(setting.value);

          // Get detail names from master data
          const [jenisKue, variasiKue, ukuranKue, kotakKue] = await Promise.all(
            [
              sqliteService.getFirst(
                "SELECT nama FROM jenis_kue WHERE id = ?",
                [ruleData.jenisKueId]
              ),
              sqliteService.getFirst(
                "SELECT nama FROM variasi_kue WHERE id = ?",
                [ruleData.variasiKueId]
              ),
              sqliteService.getFirst(
                "SELECT nama FROM ukuran_kue WHERE id = ?",
                [ruleData.ukuranKueId]
              ),
              sqliteService.getFirst(
                "SELECT nama FROM aksesoris_kue WHERE id = ?",
                [ruleData.kotakKueId]
              ),
            ]
          );

          results.push({
            id: setting.id,
            jenisKueId: ruleData.jenisKueId,
            variasiKueId: ruleData.variasiKueId,
            ukuranKueId: ruleData.ukuranKueId,
            kotakKueId: ruleData.kotakKueId,
            hargaModal: ruleData.hargaModal,
            hargaJual: ruleData.hargaJual,
            margin: ruleData.margin,
            dibuat: new Date(setting.dibuat),
            diperbarui: new Date(setting.diperbarui),
            jenisKue: jenisKue?.nama || "Unknown",
            variasiKue: variasiKue?.nama || "Unknown",
            ukuranKue: ukuranKue?.nama || "Unknown",
            kotakKue: kotakKue?.nama || "Unknown",
          });
        } catch (parseError) {
          console.error("Error parsing rules data:", parseError);
          continue;
        }
      }

      return results;
    } catch (error) {
      console.error("Error getting rules harga:", error);
      return [];
    }
  }

  // Add new rules harga
  async addRulesHarga(rulesData: {
    jenisKueId: string;
    variasiKueId: string;
    ukuranKueId: string;
    kotakKueId: string;
    hargaModal: number;
    hargaJual: number;
  }): Promise<RulesHarga> {
    try {
      // Validate that all required IDs exist
      const [jenisKue, variasiKue, ukuranKue, kotakKue] = await Promise.all([
        sqliteService.getFirst("SELECT id FROM jenis_kue WHERE id = ?", [
          rulesData.jenisKueId,
        ]),
        sqliteService.getFirst("SELECT id FROM variasi_kue WHERE id = ?", [
          rulesData.variasiKueId,
        ]),
        sqliteService.getFirst("SELECT id FROM ukuran_kue WHERE id = ?", [
          rulesData.ukuranKueId,
        ]),
        sqliteService.getFirst("SELECT id FROM aksesoris_kue WHERE id = ?", [
          rulesData.kotakKueId,
        ]),
      ]);

      if (!jenisKue || !variasiKue || !ukuranKue || !kotakKue) {
        throw new Error("Salah satu kriteria tidak valid");
      }

      // Check for duplicate combination
      const existingRules = await this.getAllRulesHarga();
      const isDuplicate = existingRules.some(
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
      const margin = this.calculateMargin(
        rulesData.hargaModal,
        rulesData.hargaJual
      );
      const timestamp = sqliteService.getCurrentTimestamp();

      const ruleKey = `rules_harga_${id}`;
      const ruleValue = {
        ...rulesData,
        margin,
      };

      await sqliteService.executeQuery(
        "INSERT INTO pengaturan (id, key, value, dibuat, diperbarui) VALUES (?, ?, ?, ?, ?)",
        [id, ruleKey, JSON.stringify(ruleValue), timestamp, timestamp]
      );

      return {
        id,
        ...rulesData,
        margin,
        dibuat: new Date(timestamp),
        diperbarui: new Date(timestamp),
      };
    } catch (error: any) {
      console.error("Error adding rules harga:", error);
      throw error;
    }
  }

  // Update rules harga
  async updateRulesHarga(
    id: string,
    rulesData: {
      jenisKueId: string;
      variasiKueId: string;
      ukuranKueId: string;
      kotakKueId: string;
      hargaModal: number;
      hargaJual: number;
    }
  ): Promise<RulesHarga> {
    try {
      const setting = await sqliteService.getFirst(
        "SELECT * FROM pengaturan WHERE id = ?",
        [id]
      );

      if (!setting) {
        throw new Error("Rules harga tidak ditemukan");
      }

      // Validate that all required IDs exist
      const [jenisKue, variasiKue, ukuranKue, kotakKue] = await Promise.all([
        sqliteService.getFirst("SELECT id FROM jenis_kue WHERE id = ?", [
          rulesData.jenisKueId,
        ]),
        sqliteService.getFirst("SELECT id FROM variasi_kue WHERE id = ?", [
          rulesData.variasiKueId,
        ]),
        sqliteService.getFirst("SELECT id FROM ukuran_kue WHERE id = ?", [
          rulesData.ukuranKueId,
        ]),
        sqliteService.getFirst("SELECT id FROM aksesoris_kue WHERE id = ?", [
          rulesData.kotakKueId,
        ]),
      ]);

      if (!jenisKue || !variasiKue || !ukuranKue || !kotakKue) {
        throw new Error("Salah satu kriteria tidak valid");
      }

      // Check for duplicate combination (excluding current rule)
      const existingRules = await this.getAllRulesHarga();
      const isDuplicate = existingRules.some(
        (rule) =>
          rule.id !== id &&
          rule.jenisKueId === rulesData.jenisKueId &&
          rule.variasiKueId === rulesData.variasiKueId &&
          rule.ukuranKueId === rulesData.ukuranKueId &&
          rule.kotakKueId === rulesData.kotakKueId
      );

      if (isDuplicate) {
        throw new Error("Kombinasi kriteria ini sudah ada");
      }

      const margin = this.calculateMargin(
        rulesData.hargaModal,
        rulesData.hargaJual
      );
      const timestamp = sqliteService.getCurrentTimestamp();
      const ruleValue = {
        ...rulesData,
        margin,
      };

      await sqliteService.executeQuery(
        "UPDATE pengaturan SET value = ?, diperbarui = ? WHERE id = ?",
        [JSON.stringify(ruleValue), timestamp, id]
      );

      return {
        id,
        ...rulesData,
        margin,
        dibuat: new Date(setting.dibuat),
        diperbarui: new Date(timestamp),
      };
    } catch (error: any) {
      console.error("Error updating rules harga:", error);
      throw error;
    }
  }

  // Delete rules harga
  async deleteRulesHarga(id: string): Promise<void> {
    try {
      const result = await sqliteService.executeQuery(
        "DELETE FROM pengaturan WHERE id = ?",
        [id]
      );

      if (result.changes === 0) {
        throw new Error("Rules harga tidak ditemukan");
      }
    } catch (error: any) {
      console.error("Error deleting rules harga:", error);
      throw error;
    }
  }

  // Get rules harga by combination
  async getRulesHargaByCombination(
    jenisKueId: string,
    variasiKueId: string,
    ukuranKueId: string,
    kotakKueId: string
  ): Promise<RulesHargaWithDetails | null> {
    try {
      const allRules = await this.getAllRulesHarga();

      return (
        allRules.find(
          (rule) =>
            rule.jenisKueId === jenisKueId &&
            rule.variasiKueId === variasiKueId &&
            rule.ukuranKueId === ukuranKueId &&
            rule.kotakKueId === kotakKueId
        ) || null
      );
    } catch (error) {
      console.error("Error getting rules by combination:", error);
      return null;
    }
  }

  // Calculate margin percentage
  private calculateMargin(hargaModal: number, hargaJual: number): number {
    if (hargaModal <= 0) return 0;
    return Math.round(((hargaJual - hargaModal) / hargaModal) * 100);
  }

  // Get pricing statistics
  async getPricingStats(): Promise<{
    totalRules: number;
    averageMargin: number;
    totalKriteria: {
      jenisKue: number;
      variasiKue: number;
      ukuranKue: number;
      kotakKue: number;
    };
  }> {
    try {
      const rules = await this.getAllRulesHarga();
      const kriteria = await this.getAllKriteria();

      const totalRules = rules.length;
      const averageMargin =
        totalRules > 0
          ? Math.round(
              rules.reduce((sum, rule) => sum + rule.margin, 0) / totalRules
            )
          : 0;

      return {
        totalRules,
        averageMargin,
        totalKriteria: {
          jenisKue: kriteria.jenisKue.length,
          variasiKue: kriteria.variasiKue.length,
          ukuranKue: kriteria.ukuranKue.length,
          kotakKue: kriteria.kotakKue.length,
        },
      };
    } catch (error) {
      console.error("Error getting pricing stats:", error);
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
  }

  // ==================== BULK OPERATIONS ====================

  // Bulk delete rules harga
  async bulkDeleteRulesHarga(ids: string[]): Promise<void> {
    try {
      const db = sqliteService.getDatabase();
      await db.execAsync("BEGIN TRANSACTION");

      try {
        for (const id of ids) {
          await sqliteService.executeQuery(
            "DELETE FROM pengaturan WHERE id = ?",
            [id]
          );
        }

        await db.execAsync("COMMIT");
      } catch (error) {
        await db.execAsync("ROLLBACK");
        throw error;
      }
    } catch (error: any) {
      console.error("Error bulk deleting rules harga:", error);
      throw new Error("Gagal menghapus rules harga secara bulk");
    }
  }

  // ==================== UTILITY METHODS ====================

  // Import kriteria from array
  async importKriteria(
    type: "jenisKue" | "variasiKue" | "ukuranKue" | "kotakKue",
    items: string[]
  ): Promise<KriteriaItem[]> {
    try {
      const results: KriteriaItem[] = [];

      for (const nama of items) {
        if (nama && nama.trim()) {
          try {
            const newItem = await this.addKriteriaItem(type, nama.trim());
            results.push(newItem);
          } catch (error) {
            console.warn(`Failed to import ${nama}:`, error);
          }
        }
      }

      return results;
    } catch (error) {
      console.error("Error importing kriteria:", error);
      throw new Error("Gagal mengimpor kriteria");
    }
  }

  // Export rules harga to JSON
  async exportRulesHarga(): Promise<RulesHargaWithDetails[]> {
    try {
      return await this.getAllRulesHarga();
    } catch (error) {
      console.error("Error exporting rules harga:", error);
      throw new Error("Gagal mengekspor rules harga");
    }
  }

  // Clear all data (for development/testing)
  async clearAllPricingData(): Promise<void> {
    try {
      const db = sqliteService.getDatabase();
      await db.execAsync("BEGIN TRANSACTION");

      try {
        // Delete all rules harga
        await sqliteService.executeQuery(
          'DELETE FROM pengaturan WHERE key LIKE "rules_harga_%"'
        );

        // Reset master data to defaults (keeping the seeded data)
        await db.execAsync("COMMIT");
      } catch (error) {
        await db.execAsync("ROLLBACK");
        throw error;
      }
    } catch (error) {
      console.error("Error clearing pricing data:", error);
      throw new Error("Gagal menghapus data pricing");
    }
  }
}

export const pricingRepository = new PricingRepository();
export default pricingRepository;
