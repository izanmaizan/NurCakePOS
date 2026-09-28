// server/src/scripts/seedFullData.js
// Seed lengkap PostgreSQL — semua halaman terisi data demo
// Jalankan: node src/scripts/seedFullData.js
// Atau dengan --force untuk reset data lama: node src/scripts/seedFullData.js --force

require("dotenv").config();
const { Pool } = require("pg");
const { v4: uuidv4 } = require("uuid");

const pool = new Pool({
  host:     process.env.DB_HOST     || "localhost",
  port:     parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME     || "nurcake_pos",
  user:     process.env.DB_USER     || "izanm",
  password: process.env.DB_PASSWORD || "zxcv",
});

const FORCE = process.argv.includes("--force");

// ─── Helpers ────────────────────────────────────────────────────
function daysAgo(n, hour = 10, min = 0) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, min, 0, 0);
  return d;
}
function daysAhead(n, hour = 14, min = 0) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(hour, min, 0, 0);
  return d;
}
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ─── Master Data ────────────────────────────────────────────────
const KATEGORI = [
  { nama: "Kue Basah",  deskripsi: "Kue dengan tekstur lembut dan basah" },
  { nama: "Kue Kering", deskripsi: "Kue dengan tekstur renyah dan kering" },
  { nama: "Roti",       deskripsi: "Berbagai macam roti" },
  { nama: "Minuman",    deskripsi: "Minuman segar" },
  { nama: "Lainnya",    deskripsi: "Produk lainnya" },
];

const JENIS_KUE = [
  { nama: "Sponge Cake",   harga_base: 80000  },
  { nama: "Butter Cake",   harga_base: 90000  },
  { nama: "Red Velvet",    harga_base: 120000 },
  { nama: "Cheese Cake",   harga_base: 150000 },
  { nama: "Black Forest",  harga_base: 110000 },
];

const VARIASI_KUE = [
  { nama: "Original",     harga_tambahan: 0     },
  { nama: "Coklat Chip",  harga_tambahan: 15000 },
  { nama: "Keju",         harga_tambahan: 20000 },
  { nama: "Buah-buahan",  harga_tambahan: 25000 },
  { nama: "Kombinasi",    harga_tambahan: 30000 },
];

const UKURAN_KUE = [
  { nama: "Mini (10cm)",  multiplier_harga: 0.5 },
  { nama: "Small (15cm)", multiplier_harga: 1.0 },
  { nama: "Medium (18cm)",multiplier_harga: 1.5 },
  { nama: "Large (22cm)", multiplier_harga: 2.0 },
  { nama: "XL (26cm)",    multiplier_harga: 2.5 },
];

const KOTAK_KUE = [
  { nama: "Kotak Biasa",     harga_tambahan: 5000  },
  { nama: "Kotak Premium",   harga_tambahan: 10000 },
  { nama: "Kotak Eksklusif", harga_tambahan: 15000 },
  { nama: "Tanpa Kotak",     harga_tambahan: 0     },
  { nama: "Gift Box",        harga_tambahan: 20000 },
];

const AKSESORIS = [
  { nama: "Lilin Angka",          harga: 5000  },
  { nama: "Topper Kustom",        harga: 10000 },
  { nama: "Edible Flowers",       harga: 15000 },
  { nama: "Ribbon",               harga: 3000  },
  { nama: "Kartu Ucapan",         harga: 5000  },
  { nama: "Chocolate Decoration", harga: 20000 },
  { nama: "Fresh Fruit Topping",  harga: 35000 },
];

// ─── Main ────────────────────────────────────────────────────────
async function seedFullData() {
  const client = await pool.connect();

  try {
    console.log("NurCakePOS — Full Data Seed");
    console.log("=".repeat(45));

    await client.query("BEGIN");

    // ── 0. Optional clear ──────────────────────────────────────
    if (FORCE) {
      console.log("⚠️  --force: menghapus data lama...");
      await client.query("DELETE FROM detail_transaksi");
      await client.query("DELETE FROM transaksi");
      await client.query("DELETE FROM pesanan_kue");
      await client.query("DELETE FROM kue_ready");
      await client.query("DELETE FROM produk");
      await client.query("DELETE FROM kategori_produk");
      await client.query("DELETE FROM jenis_kue");
      await client.query("DELETE FROM variasi_kue");
      await client.query("DELETE FROM ukuran_kue");
      await client.query("DELETE FROM kotak_kue");
      await client.query("DELETE FROM aksesoris_kue");
      console.log("  ✓ Data lama dihapus");
    }

    // ── 1. Kategori Produk ─────────────────────────────────────
    const kategoriIds = {};
    for (const item of KATEGORI) {
      const res = await client.query(
        `INSERT INTO kategori_produk (id, nama, deskripsi)
         VALUES ($1, $2, $3)
         ON CONFLICT (nama) DO UPDATE SET deskripsi = EXCLUDED.deskripsi
         RETURNING id`,
        [uuidv4(), item.nama, item.deskripsi]
      );
      kategoriIds[item.nama] = res.rows[0].id;
    }
    console.log(`\n✅ ${KATEGORI.length} kategori produk`);

    // ── 2. Jenis / Variasi / Ukuran / Kotak / Aksesoris ───────
    const jenisIds = {};
    for (const item of JENIS_KUE) {
      const res = await client.query(
        `INSERT INTO jenis_kue (id, nama, harga_base)
         VALUES ($1, $2, $3)
         ON CONFLICT (nama) DO UPDATE SET harga_base = EXCLUDED.harga_base
         RETURNING id`,
        [uuidv4(), item.nama, item.harga_base]
      );
      jenisIds[item.nama] = res.rows[0].id;
    }

    const variasiIds = {};
    for (const item of VARIASI_KUE) {
      const res = await client.query(
        `INSERT INTO variasi_kue (id, nama, harga_tambahan)
         VALUES ($1, $2, $3)
         ON CONFLICT (nama) DO UPDATE SET harga_tambahan = EXCLUDED.harga_tambahan
         RETURNING id`,
        [uuidv4(), item.nama, item.harga_tambahan]
      );
      variasiIds[item.nama] = res.rows[0].id;
    }

    const ukuranIds = {};
    for (const item of UKURAN_KUE) {
      const res = await client.query(
        `INSERT INTO ukuran_kue (id, nama, multiplier_harga)
         VALUES ($1, $2, $3)
         ON CONFLICT (nama) DO UPDATE SET multiplier_harga = EXCLUDED.multiplier_harga
         RETURNING id`,
        [uuidv4(), item.nama, item.multiplier_harga]
      );
      ukuranIds[item.nama] = res.rows[0].id;
    }

    const kotakIds = {};
    for (const item of KOTAK_KUE) {
      const res = await client.query(
        `INSERT INTO kotak_kue (id, nama, harga_tambahan)
         VALUES ($1, $2, $3)
         ON CONFLICT (nama) DO UPDATE SET harga_tambahan = EXCLUDED.harga_tambahan
         RETURNING id`,
        [uuidv4(), item.nama, item.harga_tambahan]
      );
      kotakIds[item.nama] = res.rows[0].id;
    }

    for (const item of AKSESORIS) {
      await client.query(
        `INSERT INTO aksesoris_kue (id, nama, harga)
         VALUES ($1, $2, $3)
         ON CONFLICT (nama) DO NOTHING`,
        [uuidv4(), item.nama, item.harga]
      );
    }

    console.log(`✅ Master data kue (jenis, variasi, ukuran, kotak, aksesoris)`);

    // ── 3. Produk ──────────────────────────────────────────────
    const produkData = [
      // Kue Basah
      { nama: "Brownies Coklat",   harga: 35000,  stok: 20, kat: "Kue Basah"  },
      { nama: "Bolu Kukus Pandan", harga: 28000,  stok: 15, kat: "Kue Basah"  },
      { nama: "Lemper Ayam",       harga: 12000,  stok: 30, kat: "Kue Basah"  },
      { nama: "Onde-Onde Wijen",   harga: 8000,   stok: 25, kat: "Kue Basah"  },
      { nama: "Klepon Gula Jawa",  harga: 10000,  stok: 20, kat: "Kue Basah"  },
      { nama: "Putu Ayu",          harga: 9000,   stok: 18, kat: "Kue Basah"  },
      // Kue Kering
      { nama: "Nastar Keju",       harga: 65000,  stok: 10, kat: "Kue Kering" },
      { nama: "Putri Salju",       harga: 58000,  stok: 8,  kat: "Kue Kering" },
      { nama: "Lidah Kucing",      harga: 55000,  stok: 12, kat: "Kue Kering" },
      { nama: "Sagu Keju",         harga: 48000,  stok: 14, kat: "Kue Kering" },
      // Roti
      { nama: "Roti Tawar Susu",   harga: 22000,  stok: 10, kat: "Roti"       },
      { nama: "Roti Isi Coklat",   harga: 8000,   stok: 20, kat: "Roti"       },
      { nama: "Croissant Butter",  harga: 18000,  stok: 8,  kat: "Roti"       },
      // Minuman
      { nama: "Es Teh Manis",      harga: 5000,   stok: 50, kat: "Minuman"    },
      { nama: "Es Jeruk Peras",    harga: 8000,   stok: 40, kat: "Minuman"    },
      { nama: "Jus Alpukat",       harga: 18000,  stok: 25, kat: "Minuman"    },
      // Lainnya
      { nama: "Kotak Makan Siang", harga: 35000,  stok: 15, kat: "Lainnya"    },
      { nama: "Hampers Mini",      harga: 120000, stok: 5,  kat: "Lainnya"    },
    ];

    const produkIds = {};
    const deviceId  = "SERVER-SEED-001";
    for (const p of produkData) {
      const id = uuidv4();
      produkIds[p.nama] = id;
      await client.query(
        `INSERT INTO produk (id, client_id, nama, harga, stok, kategori_id, device_id, version)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 1)
         ON CONFLICT (client_id) DO NOTHING`,
        [id, id, p.nama, p.harga, p.stok, kategoriIds[p.kat], deviceId]
      );
    }
    console.log(`✅ ${produkData.length} produk`);

    // ── 4. Kue Ready ───────────────────────────────────────────
    const kueReadyData = [
      { nama: "Red Velvet Medium",     jenis: "Red Velvet",   variasi: "Original",    ukuran: "Medium (18cm)", harga: 280000, status: "tersedia", catatan: "Siap hari ini"    },
      { nama: "Chocolate Cake Large",  jenis: "Sponge Cake",  variasi: "Coklat Chip", ukuran: "Large (22cm)",  harga: 380000, status: "tersedia", catatan: null               },
      { nama: "Black Forest Small",    jenis: "Black Forest", variasi: "Original",    ukuran: "Small (15cm)",  harga: 180000, status: "tersedia", catatan: null               },
      { nama: "Cheese Cake Mini",      jenis: "Cheese Cake",  variasi: "Keju",        ukuran: "Mini (10cm)",   harga: 120000, status: "tersedia", catatan: "Stok terakhir"    },
      { nama: "Vanilla Sponge Medium", jenis: "Sponge Cake",  variasi: "Original",    ukuran: "Medium (18cm)", harga: 220000, status: "tersedia", catatan: null               },
      { nama: "Butter Cake Buah",      jenis: "Butter Cake",  variasi: "Buah-buahan", ukuran: "Medium (18cm)", harga: 260000, status: "tersedia", catatan: "Ready ambil sore" },
      { nama: "Red Velvet Keju Large", jenis: "Red Velvet",   variasi: "Keju",        ukuran: "Large (22cm)",  harga: 420000, status: "tersedia", catatan: null               },
    ];

    for (const k of kueReadyData) {
      const id = uuidv4();
      await client.query(
        `INSERT INTO kue_ready (id, client_id, nama, jenis_kue, variasi_kue, ukuran_kue, harga_jual, status, catatan, device_id, version)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 1)
         ON CONFLICT (client_id) DO NOTHING`,
        [id, id, k.nama, k.jenis, k.variasi, k.ukuran, k.harga, k.status, k.catatan, deviceId]
      );
    }
    console.log(`✅ ${kueReadyData.length} kue ready`);

    // ── 5. Transaksi ───────────────────────────────────────────
    const itemPool = [
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
      "Ibu Sari","Pak Budi","Ibu Dewi","Ibu Hani","Pak Rizal",
      "Ibu Wulan","Bu Yuli","Pak Dani","Ibu Mega","Bu Tika",
      "Ibu Ratna","Pak Agus","Bu Rina","Ibu Fitri","Bu Nita",
    ];

    const metodePembayaran = ["cash","transfer","qris"];
    const statusPool = [
      "selesai","selesai","selesai","selesai","selesai",
      "selesai","selesai","selesai","selesai","dibatalkan",
    ];

    let txCount = 0;
    for (let daysBack = 30; daysBack >= 0; daysBack--) {
      const perDay = daysBack === 0 ? 4 : randInt(1, 3);
      for (let t = 0; t < perDay; t++) {
        txCount++;
        const txId       = uuidv4();
        const tanggal    = daysAgo(daysBack, 9 + t * 2, t * 15);
        const metode     = pick(metodePembayaran);
        const status     = pick(statusPool);
        const nama       = pelanggan[txCount % pelanggan.length];
        const mmdd       = String(tanggal.getMonth()+1).padStart(2,"0")
                         + String(tanggal.getDate()).padStart(2,"0");
        const nomorTx    = `#${mmdd}-${String(t+1).padStart(3,"0")}${txCount}`;
        const catatan    = `Pelanggan: ${nama}\nMetode: ${metode}`;

        // Pick 1-3 items
        const picked = [...itemPool].sort(()=>Math.random()-0.5).slice(0, randInt(1,3));
        const totalHarga = picked.reduce((s,p) => s + p.harga * randInt(1,2), 0);

        await client.query(
          `INSERT INTO transaksi
             (id, client_id, nomor_transaksi, total_harga, jumlah_item,
              metode_pembayaran, status_transaksi, catatan, nama_pelanggan,
              device_id, device_created_at, version)
           VALUES ($1,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,1)
           ON CONFLICT (client_id) DO NOTHING`,
          [txId, nomorTx, totalHarga, picked.length, metode, status,
           catatan, nama, deviceId, tanggal]
        );

        for (const p of picked) {
          const jumlah   = randInt(1, 2);
          const subtotal = p.harga * jumlah;
          const dtId     = uuidv4();
          await client.query(
            `INSERT INTO detail_transaksi
               (id, client_id, transaksi_id, transaksi_client_id,
                nama_produk, harga_satuan, jumlah, subtotal, device_id, version)
             VALUES ($1,$1,$2,$2,$3,$4,$5,$6,$7,1)
             ON CONFLICT (client_id) DO NOTHING`,
            [dtId, txId, p.nama, p.harga, jumlah, subtotal, deviceId]
          );
        }
      }
    }
    console.log(`✅ ${txCount} transaksi + detail`);

    // ── 6. Pesanan Kue ─────────────────────────────────────────
    const pesananData = [
      // PENDING
      { nama:"Ibu Santi",   hp:"0812-1111-2222", jenis:"Red Velvet",   variasi:"Keju",        ukuran:"Large (22cm)", kotak:"Kotak Premium",   tulisan:"Happy Birthday Mama",  warna:"Merah Putih",  total:420000, dp:200000, pesan:daysAgo(7),   ambil:daysAhead(3), status:"pending",       catatan:"Minta dekorasi bunga mawar" },
      { nama:"Pak Hendra",  hp:"0813-2222-3333", jenis:"Black Forest", variasi:"Original",    ukuran:"Medium (18cm)",kotak:"Kotak Eksklusif", tulisan:"Selamat Ulang Tahun",  warna:"Coklat Krem",  total:320000, dp:150000, pesan:daysAgo(3),   ambil:daysAhead(5), status:"pending",       catatan:"Tambahkan lilin angka 40"   },
      { nama:"Ibu Melisa",  hp:"0815-3333-4444", jenis:"Cheese Cake",  variasi:"Buah-buahan", ukuran:"Small (15cm)", kotak:"Kotak Premium",   tulisan:"Happy Anniversary",   warna:"Pastel Pink",  total:240000, dp:100000, pesan:daysAgo(1),   ambil:daysAhead(6), status:"pending",       catatan:""                           },
      // IN PROGRESS
      { nama:"Ibu Putri",   hp:"0817-4444-5555", jenis:"Sponge Cake",  variasi:"Coklat Chip", ukuran:"Large (22cm)", kotak:"Gift Box",         tulisan:"Congrats Wisuda",     warna:"Biru Emas",    total:480000, dp:250000, pesan:daysAgo(5),   ambil:daysAhead(2), status:"in_progress",   catatan:"Foto topper wisuda sudah WA"},
      { nama:"Pak Darmawan",hp:"0819-5555-6666", jenis:"Butter Cake",  variasi:"Keju",        ukuran:"XL (26cm)",    kotak:"Kotak Eksklusif", tulisan:"Happy Wedding",       warna:"Putih Gold",   total:650000, dp:350000, pesan:daysAgo(8),   ambil:daysAhead(1), status:"in_progress",   catatan:"Tier 2 lapisan fondant putih"},
      // SIAP DIAMBIL
      { nama:"Ibu Nadia",   hp:"0821-6666-7777", jenis:"Red Velvet",   variasi:"Original",    ukuran:"Medium (18cm)",kotak:"Kotak Premium",   tulisan:"Sweet 17",            warna:"Merah Pink",   total:320000, dp:160000, pesan:daysAgo(10),  ambil:daysAhead(0), status:"siap_diambil",  catatan:"Ambil jam 16.00 WIB"        },
      { nama:"Bu Lestari",  hp:"0823-7777-8888", jenis:"Black Forest", variasi:"Coklat Chip", ukuran:"Large (22cm)", kotak:"Gift Box",         tulisan:"Happy Birthday Ayah", warna:"Coklat Dark",  total:430000, dp:200000, pesan:daysAgo(12),  ambil:daysAhead(0), status:"siap_diambil",  catatan:"Sudah dikonfirmasi telepon" },
      // SUDAH DIAMBIL
      { nama:"Ibu Rini",    hp:"0825-8888-9999", jenis:"Sponge Cake",  variasi:"Original",    ukuran:"Medium (18cm)",kotak:"Kotak Biasa",     tulisan:"Selamat Ulang Tahun", warna:"Kuning Putih", total:220000, dp:220000, pesan:daysAgo(20),  ambil:daysAgo(8),   status:"sudah_diambil", catatan:""                           },
      { nama:"Pak Wahyu",   hp:"0826-0000-1111", jenis:"Red Velvet",   variasi:"Kombinasi",   ukuran:"Large (22cm)", kotak:"Kotak Eksklusif", tulisan:"Happy Anniversary",   warna:"Merah Gold",   total:480000, dp:480000, pesan:daysAgo(18),  ambil:daysAgo(6),   status:"sudah_diambil", catatan:""                           },
      { nama:"Ibu Citra",   hp:"0827-1111-2222", jenis:"Cheese Cake",  variasi:"Original",    ukuran:"Small (15cm)", kotak:"Kotak Premium",   tulisan:"Congratulations",     warna:"Pastel",       total:200000, dp:200000, pesan:daysAgo(25),  ambil:daysAgo(14),  status:"sudah_diambil", catatan:""                           },
      { nama:"Bu Endang",   hp:"0828-2222-3333", jenis:"Butter Cake",  variasi:"Buah-buahan", ukuran:"Medium (18cm)",kotak:"Kotak Biasa",     tulisan:"Happy Birthday",      warna:"Hijau Mint",   total:260000, dp:260000, pesan:daysAgo(30),  ambil:daysAgo(18),  status:"sudah_diambil", catatan:""                           },
      { nama:"Pak Fajar",   hp:"0829-3333-4444", jenis:"Black Forest", variasi:"Original",    ukuran:"Large (22cm)", kotak:"Gift Box",         tulisan:"Selamat Lulus",       warna:"Hitam Gold",   total:430000, dp:430000, pesan:daysAgo(22),  ambil:daysAgo(10),  status:"sudah_diambil", catatan:""                           },
    ];

    let pkSeq = 1;
    for (const p of pesananData) {
      const id    = uuidv4();
      const tglStr = p.pesan.toISOString().slice(0,10).replace(/-/g,"");
      const nomorPesanan = `ORD-${tglStr}-${String(pkSeq++).padStart(4,"0")}`;
      const sisa  = p.total - p.dp;

      await client.query(
        `INSERT INTO pesanan_kue
           (id, client_id, nomor_pesanan, nama_pelanggan, nomor_telepon,
            jenis_kue, variasi_kue, ukuran_kue, harga_total,
            tanggal_pesan, tanggal_ambil, status_pesanan, catatan,
            device_id, version)
         VALUES ($1,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,1)
         ON CONFLICT (client_id) DO NOTHING`,
        [id, nomorPesanan, p.nama, p.hp,
         p.jenis, p.variasi, p.ukuran, p.total,
         p.pesan, p.ambil, p.status, p.catatan || null, deviceId]
      );
    }
    console.log(`✅ ${pesananData.length} pesanan kue (pending/in_progress/siap_diambil/sudah_diambil)`);

    await client.query("COMMIT");

    console.log("\n" + "=".repeat(45));
    console.log("Full data seed selesai!");
    console.log("=".repeat(45));
    console.log(`
Ringkasan:
  Kategori Produk : ${KATEGORI.length}
  Jenis Kue       : ${JENIS_KUE.length}
  Variasi Kue     : ${VARIASI_KUE.length}
  Ukuran Kue      : ${UKURAN_KUE.length}
  Kotak Kue       : ${KOTAK_KUE.length}
  Aksesoris       : ${AKSESORIS.length}
  Produk          : ${produkData.length}
  Kue Ready       : ${kueReadyData.length}
  Transaksi       : ${txCount}
  Pesanan Kue     : ${pesananData.length}
    `);

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Seed gagal:", err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  seedFullData()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { seedFullData };
