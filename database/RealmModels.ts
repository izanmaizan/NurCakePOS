// database/RealmModels.ts
import Realm from "realm";

// Schema untuk Kategori Produk
export class KategoriProduk extends Realm.Object<KategoriProduk> {
  id!: string;
  nama!: string;
  deskripsi?: string;
  dibuat!: Date;
  diperbarui!: Date;

  static schema: Realm.ObjectSchema = {
    name: "KategoriProduk",
    primaryKey: "id",
    properties: {
      id: "string",
      nama: "string",
      deskripsi: "string?",
      dibuat: "date",
      diperbarui: "date",
    },
  };
}

// Schema untuk Produk
export class Produk extends Realm.Object<Produk> {
  id!: string;
  nama!: string;
  harga!: number;
  stok!: number;
  kategoriId!: string;
  gambarPath?: string;
  dibuat!: Date;
  diperbarui!: Date;

  static schema: Realm.ObjectSchema = {
    name: "Produk",
    primaryKey: "id",
    properties: {
      id: "string",
      nama: "string",
      harga: "double",
      stok: "int",
      kategoriId: "string",
      gambarPath: "string?",
      dibuat: "date",
      diperbarui: "date",
    },
  };
}

// Schema untuk Transaksi
export class Transaksi extends Realm.Object<Transaksi> {
  id!: string;
  nomorTransaksi!: string;
  totalHarga!: number;
  jumlahItem!: number;
  metodePembayaran!: string;
  statusTransaksi!: string;
  catatan?: string;
  namaPelanggan?: string;
  dibuat!: Date;
  diperbarui!: Date;

  static schema: Realm.ObjectSchema = {
    name: "Transaksi",
    primaryKey: "id",
    properties: {
      id: "string",
      nomorTransaksi: "string",
      totalHarga: "double",
      jumlahItem: "int",
      metodePembayaran: "string",
      statusTransaksi: "string",
      catatan: "string?",
      namaPelanggan: "string?",
      dibuat: "date",
      diperbarui: "date",
    },
  };
}

// Schema untuk Detail Transaksi
export class DetailTransaksi extends Realm.Object<DetailTransaksi> {
  id!: string;
  transaksiId!: string;
  produkId!: string;
  namaProduk!: string;
  hargaSatuan!: number;
  jumlah!: number;
  subtotal!: number;
  dibuat!: Date;

  static schema: Realm.ObjectSchema = {
    name: "DetailTransaksi",
    primaryKey: "id",
    properties: {
      id: "string",
      transaksiId: "string",
      produkId: "string",
      namaProduk: "string",
      hargaSatuan: "double",
      jumlah: "int",
      subtotal: "double",
      dibuat: "date",
    },
  };
}

// Schema untuk Pesanan Kue Custom
export class PesananKue extends Realm.Object<PesananKue> {
  id!: string;
  nomorPesanan!: string;
  namaPelanggan!: string;
  nomorTelepon!: string;
  jenisKue!: string;
  variasiKue!: string;
  ukuranKue!: string;
  aksesoris?: string;
  hargaTotal!: number;
  tanggalPesan!: Date;
  tanggalAmbil!: Date;
  statusPesanan!: string;
  catatan?: string;
  gambarReferensiPath?: string;
  dibuat!: Date;
  diperbarui!: Date;

  static schema: Realm.ObjectSchema = {
    name: "PesananKue",
    primaryKey: "id",
    properties: {
      id: "string",
      nomorPesanan: "string",
      namaPelanggan: "string",
      nomorTelepon: "string",
      jenisKue: "string",
      variasiKue: "string",
      ukuranKue: "string",
      aksesoris: "string?",
      hargaTotal: "double",
      tanggalPesan: "date",
      tanggalAmbil: "date",
      statusPesanan: "string",
      catatan: "string?",
      gambarReferensiPath: "string?",
      dibuat: "date",
      diperbarui: "date",
    },
  };
}

// Schema untuk Jenis Kue (Master Data)
export class JenisKue extends Realm.Object<JenisKue> {
  id!: string;
  nama!: string;
  hargaBase!: number;
  dibuat!: Date;

  static schema: Realm.ObjectSchema = {
    name: "JenisKue",
    primaryKey: "id",
    properties: {
      id: "string",
      nama: "string",
      hargaBase: "double",
      dibuat: "date",
    },
  };
}

// Schema untuk Variasi Kue (Master Data)
export class VariasiKue extends Realm.Object<VariasiKue> {
  id!: string;
  nama!: string;
  hargaTambahan!: number;
  dibuat!: Date;

  static schema: Realm.ObjectSchema = {
    name: "VariasiKue",
    primaryKey: "id",
    properties: {
      id: "string",
      nama: "string",
      hargaTambahan: "double",
      dibuat: "date",
    },
  };
}

// Schema untuk Ukuran Kue (Master Data)
export class UkuranKue extends Realm.Object<UkuranKue> {
  id!: string;
  nama!: string;
  multiplierHarga!: number;
  dibuat!: Date;

  static schema: Realm.ObjectSchema = {
    name: "UkuranKue",
    primaryKey: "id",
    properties: {
      id: "string",
      nama: "string",
      multiplierHarga: "double",
      dibuat: "date",
    },
  };
}

// Schema untuk Aksesoris Kue (Master Data)
export class AksesorisKue extends Realm.Object<AksesorisKue> {
  id!: string;
  nama!: string;
  harga!: number;
  dibuat!: Date;

  static schema: Realm.ObjectSchema = {
    name: "AksesorisKue",
    primaryKey: "id",
    properties: {
      id: "string",
      nama: "string",
      harga: "double",
      dibuat: "date",
    },
  };
}

// Schema untuk Settings/Pengaturan
export class Pengaturan extends Realm.Object<Pengaturan> {
  id!: string;
  key!: string;
  value!: string;
  dibuat!: Date;
  diperbarui!: Date;

  static schema: Realm.ObjectSchema = {
    name: "Pengaturan",
    primaryKey: "id",
    properties: {
      id: "string",
      key: "string",
      value: "string",
      dibuat: "date",
      diperbarui: "date",
    },
  };
}

// Array semua schema untuk inisialisasi Realm
export const AllSchemas = [
  KategoriProduk,
  Produk,
  Transaksi,
  DetailTransaksi,
  PesananKue,
  JenisKue,
  VariasiKue,
  UkuranKue,
  AksesorisKue,
  Pengaturan,
];
