// database/RealmService.ts
import * as FileSystem from "expo-file-system";
import uuid from "react-native-uuid";
import Realm from "realm";
import {
  AksesorisKue,
  AllSchemas,
  JenisKue,
  KategoriProduk,
  UkuranKue,
  VariasiKue,
} from "./RealmModels";

class RealmService {
  private realm: Realm | null = null;

  // Inisialisasi database
  async initialize(): Promise<void> {
    try {
      this.realm = await Realm.open({
        schema: AllSchemas,
        schemaVersion: 1,
        deleteRealmIfMigrationNeeded: true, // Untuk development
      });

      console.log("Realm database berhasil dibuka");
    } catch (error) {
      console.error("Error membuka Realm database:", error);
      throw error;
    }
  }

  // Mendapatkan instance Realm
  getRealm(): Realm {
    if (!this.realm) {
      throw new Error(
        "Database belum diinisialisasi. Panggil initialize() terlebih dahulu."
      );
    }
    return this.realm;
  }

  // Generate ID unik
  generateId(): string {
    return uuid.v4() as string;
  }

  // Tutup database
  close(): void {
    if (this.realm && !this.realm.isClosed) {
      this.realm.close();
      this.realm = null;
    }
  }

  // Simpan file gambar
  async saveFile(
    sourceUri: string,
    fileName: string,
    folder: string = ""
  ): Promise<string> {
    try {
      const fileUri = `${FileSystem.documentDirectory}${
        folder ? folder + "/" : ""
      }${fileName}`;

      // Buat folder jika belum ada
      if (folder) {
        const folderUri = `${FileSystem.documentDirectory}${folder}`;
        const folderInfo = await FileSystem.getInfoAsync(folderUri);
        if (!folderInfo.exists) {
          await FileSystem.makeDirectoryAsync(folderUri, {
            intermediates: true,
          });
        }
      }

      // Copy file
      await FileSystem.copyAsync({
        from: sourceUri,
        to: fileUri,
      });

      return fileUri;
    } catch (error) {
      console.error("Error menyimpan file:", error);
      throw error;
    }
  }

  // Hapus file
  async deleteFile(fileUri: string): Promise<void> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(fileUri);
      }
    } catch (error) {
      console.error("Error menghapus file:", error);
      // Tidak throw error karena file mungkin sudah tidak ada
    }
  }

  // Seed master data untuk development
  async seedMasterData(): Promise<void> {
    try {
      const realm = this.getRealm();

      // Cek apakah sudah ada data
      const existingCategories = realm.objects("KategoriProduk").length;
      if (existingCategories > 0) {
        console.log("Master data sudah ada, skip seeding");
        return;
      }

      realm.write(() => {
        // Seed Kategori Produk
        const categories = [
          { nama: "Minuman", deskripsi: "Berbagai jenis minuman" },
          { nama: "Makanan", deskripsi: "Makanan ringan dan berat" },
          { nama: "Snack", deskripsi: "Camilan dan kudapan" },
          { nama: "Kue Kering", deskripsi: "Aneka kue kering" },
          { nama: "Roti", deskripsi: "Roti dan pastry" },
        ];

        categories.forEach((cat) => {
          realm.create<KategoriProduk>("KategoriProduk", {
            id: this.generateId(),
            nama: cat.nama,
            deskripsi: cat.deskripsi,
            dibuat: new Date(),
            diperbarui: new Date(),
          });
        });

        // Seed Jenis Kue
        const jenisKue = [
          { nama: "Sponge Cake", hargaBase: 80000 },
          { nama: "Butter Cake", hargaBase: 90000 },
          { nama: "Red Velvet", hargaBase: 120000 },
          { nama: "Chocolate Cake", hargaBase: 100000 },
          { nama: "Vanilla Cake", hargaBase: 85000 },
        ];

        jenisKue.forEach((jenis) => {
          realm.create<JenisKue>("JenisKue", {
            id: this.generateId(),
            nama: jenis.nama,
            hargaBase: jenis.hargaBase,
            dibuat: new Date(),
          });
        });

        // Seed Variasi Kue
        const variasiKue = [
          { nama: "Original", hargaTambahan: 0 },
          { nama: "Coklat Chip", hargaTambahan: 15000 },
          { nama: "Keju", hargaTambahan: 20000 },
          { nama: "Fruit Mix", hargaTambahan: 25000 },
          { nama: "Nuts", hargaTambahan: 30000 },
        ];

        variasiKue.forEach((variasi) => {
          realm.create<VariasiKue>("VariasiKue", {
            id: this.generateId(),
            nama: variasi.nama,
            hargaTambahan: variasi.hargaTambahan,
            dibuat: new Date(),
          });
        });

        // Seed Ukuran Kue
        const ukuranKue = [
          { nama: "Mini (15cm)", multiplierHarga: 0.5 },
          { nama: "Small (20cm)", multiplierHarga: 1.0 },
          { nama: "Medium (25cm)", multiplierHarga: 1.5 },
          { nama: "Large (30cm)", multiplierHarga: 2.0 },
          { nama: "Extra Large (35cm)", multiplierHarga: 2.5 },
        ];

        ukuranKue.forEach((ukuran) => {
          realm.create<UkuranKue>("UkuranKue", {
            id: this.generateId(),
            nama: ukuran.nama,
            multiplierHarga: ukuran.multiplierHarga,
            dibuat: new Date(),
          });
        });

        // Seed Aksesoris Kue
        const aksesorisKue = [
          { nama: "Lilin Ulang Tahun", harga: 5000 },
          { nama: "Topper Happy Birthday", harga: 10000 },
          { nama: "Edible Flowers", harga: 15000 },
          { nama: "Chocolate Decoration", harga: 20000 },
          { nama: "Custom Message", harga: 25000 },
        ];

        aksesorisKue.forEach((aksesoris) => {
          realm.create<AksesorisKue>("AksesorisKue", {
            id: this.generateId(),
            nama: aksesoris.nama,
            harga: aksesoris.harga,
            dibuat: new Date(),
          });
        });
      });

      console.log("Master data berhasil di-seed");
    } catch (error) {
      console.error("Error seeding master data:", error);
      throw error;
    }
  }

  // Clear all data (untuk development/testing)
  async clearAllData(): Promise<void> {
    try {
      const realm = this.getRealm();

      realm.write(() => {
        realm.deleteAll();
      });

      console.log("Semua data berhasil dihapus");
    } catch (error) {
      console.error("Error clearing data:", error);
      throw error;
    }
  }
}

export const realmService = new RealmService();
export default realmService;
