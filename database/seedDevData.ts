// database/seedDevData.ts
// Seed lengkap untuk development & demo — semua halaman terisi data
// Panggil: await seedDevData() setelah DB initialized

import { sqliteService } from "./SQLiteService";

// ─── Helpers ───────────────────────────────────────────────────
function uid(prefix = ""): string {
  return `${prefix}${Date.now().toString(36).toUpperCase()}${Math.random()
    .toString(36)
    .slice(2, 6)
    .toUpperCase()}`;
}

function iso(offsetDays = 0, hour = 10, minute = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function dateOnly(offsetDays = 0): string {
  return iso(offsetDays).slice(0, 10);
}

function formatRp(n: number): string {
  return `Rp ${n.toLocaleString("id-ID")}`;
}

// ─── Clear all data sebelum seed ───────────────────────────────
async function clearAll(): Promise<void> {
  // Hapus urutan FK-safe
  await sqliteService.run("DELETE FROM detail_transaksi");
  await sqliteService.run("DELETE FROM transaksi");
  await sqliteService.run("DELETE FROM pesanan_kue");
  await sqliteService.run("DELETE FROM kue_ready");
  await sqliteService.run("DELETE FROM produk");
  await sqliteService.run(
    "DELETE FROM pengaturan WHERE key LIKE 'rules_harga_%'"
  );
  // Jangan hapus master data (kategori, jenis_kue, dll) — itu sudah ada dari checkAndSeedData
}

// ─── SEED PRODUK ───────────────────────────────────────────────
async function seedProduk(deviceId: string): Promise<Record<string, string>> {
  const now = iso();
  type Row = { id: string; nama: string };

  const kategori = await sqliteService.query<Row>(
    "SELECT id, nama FROM kategori_produk"
  );
  const kId = (nama: string) =>
    kategori.find((k) => k.nama === nama)?.id ?? kategori[0]?.id ?? "KP001";

  const items = [
    // Kue Basah
    { nama: "Brownies Coklat",  harga: 35000, stok: 20, kat: "Kue Basah"  },
    { nama: "Bolu Kukus Pandan",harga: 28000, stok: 15, kat: "Kue Basah"  },
    { nama: "Lemper Ayam",      harga: 12000, stok: 30, kat: "Kue Basah"  },
    { nama: "Onde-Onde Wijen",  harga: 8000,  stok: 25, kat: "Kue Basah"  },
    { nama: "Klepon Gula Jawa", harga: 10000, stok: 20, kat: "Kue Basah"  },
    { nama: "Putu Ayu",         harga: 9000,  stok: 18, kat: "Kue Basah"  },
    // Kue Kering
    { nama: "Nastar Keju",      harga: 65000, stok: 10, kat: "Kue Kering" },
    { nama: "Putri Salju",      harga: 58000, stok: 8,  kat: "Kue Kering" },
    { nama: "Lidah Kucing",     harga: 55000, stok: 12, kat: "Kue Kering" },
    { nama: "Sagu Keju",        harga: 48000, stok: 14, kat: "Kue Kering" },
    // Roti
    { nama: "Roti Tawar Susu",  harga: 22000, stok: 10, kat: "Roti"       },
    { nama: "Roti Isi Coklat",  harga: 8000,  stok: 20, kat: "Roti"       },
    { nama: "Croissant Butter", harga: 18000, stok: 8,  kat: "Roti"       },
    // Minuman
    { nama: "Es Teh Manis",     harga: 5000,  stok: 50, kat: "Minuman"    },
    { nama: "Es Jeruk Peras",   harga: 8000,  stok: 40, kat: "Minuman"    },
    { nama: "Jus Alpukat",      harga: 18000, stok: 25, kat: "Minuman"    },
    // Lainnya
    { nama: "Kotak Makan Siang",harga: 35000, stok: 15, kat: "Lainnya"    },
    { nama: "Hampers Mini",     harga: 120000,stok: 5,  kat: "Lainnya"    },
  ];

  const ids: Record<string, string> = {};

  for (const item of items) {
    const id = uid("PRD");
    ids[item.nama] = id;
    await sqliteService.run(
      `INSERT OR IGNORE INTO produk
        (id, nama, harga, stok, kategoriId, gambarPath, dibuat, diperbarui, device_id, version, sync_status)
       VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, 1, 'synced')`,
      [id, item.nama, item.harga, item.stok, kId(item.kat), now, now, deviceId]
    );
  }

  return ids;
}

// ─── SEED KUE READY ────────────────────────────────────────────
async function seedKueReady(deviceId: string): Promise<void> {
  const now = iso();
  const items = [
    { nama: "Red Velvet Medium",      jenis: "Red Velvet",      variasi: "Original",    ukuran: "Medium (18cm)", harga: 280000, catatan: "Siap hari ini" },
    { nama: "Chocolate Cake Large",   jenis: "Sponge Cake",     variasi: "Coklat Chip", ukuran: "Large (22cm)",  harga: 380000, catatan: null },
    { nama: "Black Forest Small",     jenis: "Black Forest",    variasi: "Original",    ukuran: "Small (15cm)",  harga: 180000, catatan: null },
    { nama: "Cheese Cake Mini",       jenis: "Cheese Cake",     variasi: "Keju",        ukuran: "Mini (10cm)",   harga: 120000, catatan: "Stok terakhir" },
    { nama: "Vanilla Sponge Medium",  jenis: "Sponge Cake",     variasi: "Original",    ukuran: "Medium (18cm)", harga: 220000, catatan: null },
    { nama: "Butter Cake Buah",       jenis: "Butter Cake",     variasi: "Buah-buahan", ukuran: "Medium (18cm)", harga: 260000, catatan: "Ready ambil sore" },
    { nama: "Red Velvet Keju Large",  jenis: "Red Velvet",      variasi: "Keju",        ukuran: "Large (22cm)",  harga: 420000, catatan: null },
  ];

  for (const item of items) {
    const id = uid("KR");
    await sqliteService.run(
      `INSERT OR IGNORE INTO kue_ready
        (id, nama, jenisKue, variasiKue, ukuranKue, hargaJual, gambarPath, status, catatan,
         dibuat, diperbarui, device_id, version, sync_status)
       VALUES (?, ?, ?, ?, ?, ?, NULL, 'tersedia', ?, ?, ?, ?, 1, 'synced')`,
      [id, item.nama, item.jenis, item.variasi, item.ukuran, item.harga,
       item.catatan, now, now, deviceId]
    );
  }
}

// ─── SEED TRANSAKSI ────────────────────────────────────────────
async function seedTransaksi(
  deviceId: string,
  produkIds: Record<string, string>
): Promise<void> {
  const produkList = [
    { nama: "Brownies Coklat",   harga: 35000 },
    { nama: "Bolu Kukus Pandan", harga: 28000 },
    { nama: "Nastar Keju",       harga: 65000 },
    { nama: "Roti Isi Coklat",   harga: 8000  },
    { nama: "Es Teh Manis",      harga: 5000  },
    { nama: "Lemper Ayam",       harga: 12000 },
    { nama: "Kotak Makan Siang", harga: 35000 },
    { nama: "Klepon Gula Jawa",  harga: 10000 },
    { nama: "Jus Alpukat",       harga: 18000 },
    { nama: "Putri Salju",       harga: 58000 },
  ];

  const pelanggan = [
    "Ibu Sari", "Pak Budi", "Ibu Dewi", "Ibu Hani", "Pak Rizal",
    "Ibu Wulan", "Bu Yuli", "Pak Dani", "Ibu Mega", "Bu Tika",
    "Ibu Ratna", "Pak Agus", "Bu Rina", "Ibu Fitri", "Bu Nita",
  ];

  const metode = ["cash", "transfer", "qris"];
  const statuses = [
    "selesai", "selesai", "selesai", "selesai", "selesai",
    "selesai", "selesai", "selesai", "selesai", "dibatalkan",
  ]; // 9 selesai : 1 dibatalkan

  let txCount = 0;
  const totalTx = 30;

  for (let day = 30; day >= 0; day--) {
    // 0–3 transaksi per hari
    const txPerDay = day === 0 ? 4 : Math.floor(Math.random() * 3) + 1;
    for (let t = 0; t < txPerDay && txCount < totalTx; t++) {
      txCount++;
      const txId   = uid("TX");
      const tanggal = iso(-day, 9 + t * 2, t * 15);
      const statusIdx = Math.floor(Math.random() * statuses.length);
      const status   = statuses[statusIdx];
      const metodeIdx = Math.floor(Math.random() * metode.length);
      const namaPelanggan = pelanggan[txCount % pelanggan.length];
      const mmdd = tanggal.slice(5, 7) + tanggal.slice(8, 10);
      const nomorTransaksi = `#${mmdd}-${String(t + 1).padStart(3, "0")}${txCount}`;

      // Pick 1-4 random items
      const itemCount = Math.floor(Math.random() * 3) + 1;
      const picked: typeof produkList = [];
      const shuffled = [...produkList].sort(() => Math.random() - 0.5);
      for (let i = 0; i < itemCount; i++) picked.push(shuffled[i]);

      const totalHarga = picked.reduce((s, p) => s + p.harga * (Math.floor(Math.random() * 2) + 1), 0);

      const catatan = `Pelanggan: ${namaPelanggan}\nMetode: ${metode[metodeIdx]}`;

      await sqliteService.run(
        `INSERT OR IGNORE INTO transaksi
          (id, nomorTransaksi, tanggal, totalHarga, metodePembayaran, statusPembayaran,
           catatan, dibuat, diperbarui, device_id, version, sync_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'synced')`,
        [txId, nomorTransaksi, tanggal, totalHarga, metode[metodeIdx], status,
         catatan, tanggal, tanggal, deviceId]
      );

      // Detail items
      for (const p of picked) {
        const jumlah = Math.floor(Math.random() * 2) + 1;
        const subtotal = p.harga * jumlah;
        const dtId  = uid("DT");
        const produkId = produkIds[p.nama] ?? uid("PRD");

        await sqliteService.run(
          `INSERT OR IGNORE INTO detail_transaksi
            (id, transaksiId, tipeItem, itemId, namaItem, jumlah, hargaSatuan, subtotal,
             catatan, dibuat, device_id, version, sync_status)
           VALUES (?, ?, 'produk', ?, ?, ?, ?, ?, NULL, ?, ?, 1, 'synced')`,
          [dtId, txId, produkId, p.nama, jumlah, p.harga, subtotal, tanggal, deviceId]
        );
      }
    }
  }
}

// ─── SEED PESANAN KUE ──────────────────────────────────────────
async function seedPesananKue(deviceId: string): Promise<void> {
  type PesananInput = {
    namaPelanggan: string;
    noHp: string;
    jenisKue: string;
    variasiKue: string;
    ukuranKue: string;
    kotakKue: string;
    tulisanKue: string;
    warnaTema: string;
    totalHarga: number;
    dpBayar: number;
    offsetPesan: number;  // hari lalu
    offsetAmbil: number;  // hari dari sekarang (+ future, - past)
    status: string;
    catatan: string;
  };

  const pesanan: PesananInput[] = [
    // ── PENDING ──────────────────────────────
    {
      namaPelanggan: "Ibu Santi",      noHp: "0812-1111-2222",
      jenisKue: "Red Velvet",          variasiKue: "Keju",
      ukuranKue: "Large (22cm)",       kotakKue: "Kotak Premium",
      tulisanKue: "Happy Birthday Mama", warnaTema: "Merah Putih",
      totalHarga: 420000, dpBayar: 200000,
      offsetPesan: -7, offsetAmbil: 3,
      status: "pending",
      catatan: "Minta dekorasi bunga mawar"
    },
    {
      namaPelanggan: "Pak Hendra",     noHp: "0813-2222-3333",
      jenisKue: "Black Forest",        variasiKue: "Original",
      ukuranKue: "Medium (18cm)",      kotakKue: "Kotak Eksklusif",
      tulisanKue: "Selamat Ulang Tahun",warnaTema: "Coklat Krem",
      totalHarga: 320000, dpBayar: 150000,
      offsetPesan: -3, offsetAmbil: 5,
      status: "pending",
      catatan: "Tambahkan lilin angka 40"
    },
    {
      namaPelanggan: "Ibu Melisa",     noHp: "0815-3333-4444",
      jenisKue: "Cheese Cake",         variasiKue: "Buah-buahan",
      ukuranKue: "Small (15cm)",       kotakKue: "Kotak Premium",
      tulisanKue: "Happy Anniversary", warnaTema: "Pastel Pink",
      totalHarga: 240000, dpBayar: 100000,
      offsetPesan: -1, offsetAmbil: 6,
      status: "pending",
      catatan: ""
    },
    // ── IN PROGRESS ──────────────────────────
    {
      namaPelanggan: "Ibu Putri",      noHp: "0817-4444-5555",
      jenisKue: "Sponge Cake",         variasiKue: "Coklat Chip",
      ukuranKue: "Large (22cm)",       kotakKue: "Gift Box",
      tulisanKue: "Congrats Wisuda",   warnaTema: "Biru Emas",
      totalHarga: 480000, dpBayar: 250000,
      offsetPesan: -5, offsetAmbil: 2,
      status: "in_progress",
      catatan: "Foto topper wisuda sudah dikirim via WA"
    },
    {
      namaPelanggan: "Pak Darmawan",   noHp: "0819-5555-6666",
      jenisKue: "Butter Cake",         variasiKue: "Keju",
      ukuranKue: "XL (26cm)",          kotakKue: "Kotak Eksklusif",
      tulisanKue: "Happy Wedding",     warnaTema: "Putih Gold",
      totalHarga: 650000, dpBayar: 350000,
      offsetPesan: -8, offsetAmbil: 1,
      status: "in_progress",
      catatan: "Tier 2 lapisan, minta fondant putih"
    },
    // ── SIAP DIAMBIL ─────────────────────────
    {
      namaPelanggan: "Ibu Nadia",      noHp: "0821-6666-7777",
      jenisKue: "Red Velvet",          variasiKue: "Original",
      ukuranKue: "Medium (18cm)",      kotakKue: "Kotak Premium",
      tulisanKue: "Sweet 17",          warnaTema: "Merah Pink",
      totalHarga: 320000, dpBayar: 160000,
      offsetPesan: -10, offsetAmbil: 0,
      status: "siap_diambil",
      catatan: "Ambil jam 16.00 WIB"
    },
    {
      namaPelanggan: "Bu Lestari",     noHp: "0823-7777-8888",
      jenisKue: "Black Forest",        variasiKue: "Coklat Chip",
      ukuranKue: "Large (22cm)",       kotakKue: "Gift Box",
      tulisanKue: "Happy Birthday Ayah",warnaTema: "Coklat Dark",
      totalHarga: 430000, dpBayar: 200000,
      offsetPesan: -12, offsetAmbil: 0,
      status: "siap_diambil",
      catatan: "Sudah dikonfirmasi via telepon"
    },
    // ── SUDAH DIAMBIL / COMPLETED ─────────────
    {
      namaPelanggan: "Ibu Rini",       noHp: "0825-8888-9999",
      jenisKue: "Sponge Cake",         variasiKue: "Original",
      ukuranKue: "Medium (18cm)",      kotakKue: "Kotak Biasa",
      tulisanKue: "Selamat Ulang Tahun",warnaTema: "Kuning Putih",
      totalHarga: 220000, dpBayar: 220000,
      offsetPesan: -20, offsetAmbil: -8,
      status: "sudah_diambil",
      catatan: "Lunas saat pengambilan"
    },
    {
      namaPelanggan: "Pak Wahyu",      noHp: "0826-0000-1111",
      jenisKue: "Red Velvet",          variasiKue: "Kombinasi",
      ukuranKue: "Large (22cm)",       kotakKue: "Kotak Eksklusif",
      tulisanKue: "Happy Anniversary", warnaTema: "Merah Gold",
      totalHarga: 480000, dpBayar: 480000,
      offsetPesan: -18, offsetAmbil: -6,
      status: "sudah_diambil",
      catatan: ""
    },
    {
      namaPelanggan: "Ibu Citra",      noHp: "0827-1111-2222",
      jenisKue: "Cheese Cake",         variasiKue: "Original",
      ukuranKue: "Small (15cm)",       kotakKue: "Kotak Premium",
      tulisanKue: "Congratulations",   warnaTema: "Pastel",
      totalHarga: 200000, dpBayar: 200000,
      offsetPesan: -25, offsetAmbil: -14,
      status: "sudah_diambil",
      catatan: ""
    },
    {
      namaPelanggan: "Bu Endang",      noHp: "0828-2222-3333",
      jenisKue: "Butter Cake",         variasiKue: "Buah-buahan",
      ukuranKue: "Medium (18cm)",      kotakKue: "Kotak Biasa",
      tulisanKue: "Happy Birthday",    warnaTema: "Hijau Mint",
      totalHarga: 260000, dpBayar: 260000,
      offsetPesan: -30, offsetAmbil: -18,
      status: "sudah_diambil",
      catatan: ""
    },
    {
      namaPelanggan: "Pak Fajar",      noHp: "0829-3333-4444",
      jenisKue: "Black Forest",        variasiKue: "Original",
      ukuranKue: "Large (22cm)",       kotakKue: "Gift Box",
      tulisanKue: "Selamat Lulus",     warnaTema: "Hitam Gold",
      totalHarga: 430000, dpBayar: 430000,
      offsetPesan: -22, offsetAmbil: -10,
      status: "sudah_diambil",
      catatan: ""
    },
  ];

  let seq = 1;
  for (const p of pesanan) {
    const id           = uid("PK");
    const tanggalPesan = iso(p.offsetPesan, 10, 0);
    const tanggalAmbil = iso(p.offsetAmbil, 14, 0);
    const sisa         = p.totalHarga - p.dpBayar;
    const nomorPesanan = `ORD-${dateOnly(p.offsetPesan).replace(/-/g, "")}-${String(seq++).padStart(4, "0")}`;

    await sqliteService.run(
      `INSERT OR IGNORE INTO pesanan_kue
        (id, nomorPesanan, namaPelanggan, noHp, jenisKue, variasiKue, ukuranKue, kotakKue,
         aksesorisKue, tulisanKue, warnaTema, tanggalPesan, tanggalAmbil, totalHarga, dpBayar,
         sisaPembayaran, statusPesanan, metodePembayaran, catatan, gambarReferensi,
         dibuat, diperbarui, device_id, version, sync_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, 'cash', ?, NULL, ?, ?, ?, 1, 'synced')`,
      [
        id, nomorPesanan, p.namaPelanggan, p.noHp, p.jenisKue, p.variasiKue,
        p.ukuranKue, p.kotakKue, p.tulisanKue, p.warnaTema,
        tanggalPesan, tanggalAmbil, p.totalHarga, p.dpBayar, sisa,
        p.status, p.catatan || null,
        tanggalPesan, tanggalPesan, deviceId,
      ]
    );
  }
}

// ─── SEED RULES HARGA ──────────────────────────────────────────
async function seedRulesHarga(): Promise<void> {
  type Row = { id: string; nama: string };

  const [jenisKue, variasiKue, ukuranKue, kotakKue] = await Promise.all([
    sqliteService.query<Row>("SELECT id, nama FROM jenis_kue ORDER BY rowid"),
    sqliteService.query<Row>("SELECT id, nama FROM variasi_kue ORDER BY rowid"),
    sqliteService.query<Row>("SELECT id, nama FROM ukuran_kue ORDER BY rowid"),
    sqliteService.query<Row>("SELECT id, nama FROM kotak_kue ORDER BY rowid"),
  ]);

  if (!jenisKue.length || !ukuranKue.length) return;

  // Harga modal & jual per kombinasi ukuran × jenis
  const hargaBase: Record<string, Record<string, number>> = {
    "Mini (10cm)":    { "Sponge Cake":40000, "Butter Cake":45000, "Red Velvet":60000, "Cheese Cake":75000, "Black Forest":55000 },
    "Small (15cm)":   { "Sponge Cake":55000, "Butter Cake":65000, "Red Velvet":85000, "Cheese Cake":100000,"Black Forest":75000  },
    "Medium (18cm)":  { "Sponge Cake":75000, "Butter Cake":90000, "Red Velvet":115000,"Cheese Cake":135000,"Black Forest":100000 },
    "Large (22cm)":   { "Sponge Cake":95000, "Butter Cake":115000,"Red Velvet":145000,"Cheese Cake":165000,"Black Forest":130000 },
    "XL (26cm)":      { "Sponge Cake":120000,"Butter Cake":145000,"Red Velvet":185000,"Cheese Cake":210000,"Black Forest":165000 },
  };

  // Harga tambahan variasi
  const varTambah: Record<string, number> = {
    "Original":0, "Coklat Chip":15000, "Keju":20000, "Buah-buahan":25000, "Kombinasi":30000,
  };

  const kotakTambah: Record<string, number> = {
    "Kotak Biasa":5000, "Kotak Premium":10000, "Kotak Eksklusif":15000, "Tanpa Kotak":0,
  };

  const marginTarget = 0.4; // 40% margin
  const now = iso();

  for (const jk of jenisKue) {
    for (const uk of ukuranKue) {
      for (const vk of variasiKue) {
        for (const kk of kotakKue) {
          const baseModal =
            (hargaBase[uk.nama]?.[jk.nama] ?? 60000) +
            (varTambah[vk.nama] ?? 0) +
            (kotakTambah[kk.nama] ?? 0);

          const hargaModal = Math.round(baseModal / 1000) * 1000;
          const hargaJual  = Math.round((hargaModal * (1 + marginTarget)) / 5000) * 5000;
          const margin     = Math.round(((hargaJual - hargaModal) / hargaModal) * 100);

          const ruleId    = uid("RH");
          const ruleKey   = `rules_harga_${ruleId}`;
          const ruleValue = JSON.stringify({
            jenisKueId:   jk.id,
            variasiKueId: vk.id,
            ukuranKueId:  uk.id,
            kotakKueId:   kk.id,
            hargaModal,
            hargaJual,
            margin,
          });

          await sqliteService.run(
            `INSERT OR IGNORE INTO pengaturan (id, key, value, dibuat, diperbarui)
             VALUES (?, ?, ?, ?, ?)`,
            [ruleId, ruleKey, ruleValue, now, now]
          );
        }
      }
    }
  }
}

// ─── MAIN ──────────────────────────────────────────────────────
export async function seedDevData(force = false): Promise<void> {
  try {
    // Cek apakah sudah pernah seed
    const existing = await sqliteService.getFirst<{ c: number }>(
      "SELECT COUNT(*) as c FROM transaksi"
    );

    if (!force && (existing?.c ?? 0) > 0) {
      console.log("Dev seed sudah ada, skip. Gunakan seedDevData(true) untuk force.");
      return;
    }

    console.log("Memulai dev seed...");

    // Ambil device ID dari DB
    const deviceInfo = await sqliteService.getFirst<{ device_id: string }>(
      "SELECT device_id FROM device_info LIMIT 1"
    );
    const deviceId = deviceInfo?.device_id ?? "DEV-SEED-001";

    await clearAll();
    console.log("  ✓ Data lama dibersihkan");

    const produkIds = await seedProduk(deviceId);
    console.log(`  ✓ ${Object.keys(produkIds).length} produk`);

    await seedKueReady(deviceId);
    console.log("  ✓ 7 kue ready");

    await seedTransaksi(deviceId, produkIds);
    const txCount = await sqliteService.getFirst<{ c: number }>(
      "SELECT COUNT(*) as c FROM transaksi"
    );
    console.log(`  ✓ ${txCount?.c ?? 0} transaksi`);

    await seedPesananKue(deviceId);
    const pkCount = await sqliteService.getFirst<{ c: number }>(
      "SELECT COUNT(*) as c FROM pesanan_kue"
    );
    console.log(`  ✓ ${pkCount?.c ?? 0} pesanan kue`);

    await seedRulesHarga();
    const rhCount = await sqliteService.getFirst<{ c: number }>(
      "SELECT COUNT(*) as c FROM pengaturan WHERE key LIKE 'rules_harga_%'"
    );
    console.log(`  ✓ ${rhCount?.c ?? 0} rules harga`);

    console.log("Dev seed selesai!");
  } catch (err) {
    console.error("Gagal seed dev data:", err);
    throw err;
  }
}
