// server/src/scripts/seedData.js - Seed Initial Master Data
// Path: NurCakePOS/server/src/scripts/seedData.js

require("dotenv").config();
const { Pool } = require("pg");
const { v4: uuidv4 } = require("uuid");

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || "nurcake_pos",
  user: process.env.DB_USER || "izanm",
  password: process.env.DB_PASSWORD || "zxcv",
});

async function seedData() {
  const client = await pool.connect();

  try {
    console.log("Starting data seeding...");
    console.log("========================================");

    await client.query("BEGIN");

    // Seed Kategori Produk
    console.log("Seeding kategori_produk...");
    const kategoriProduk = [
      { nama: "Kue Basah", deskripsi: "Kue dengan tekstur lembut dan basah" },
      { nama: "Kue Kering", deskripsi: "Kue dengan tekstur renyah dan kering" },
      { nama: "Roti", deskripsi: "Berbagai macam roti" },
      { nama: "Minuman", deskripsi: "Minuman segar" },
      { nama: "Lainnya", deskripsi: "Produk lainnya" },
    ];

    for (const item of kategoriProduk) {
      await client.query(
        `INSERT INTO kategori_produk (id, nama, deskripsi) 
         VALUES ($1, $2, $3) 
         ON CONFLICT (nama) DO NOTHING`,
        [uuidv4(), item.nama, item.deskripsi]
      );
    }
    console.log(`  ✅ ${kategoriProduk.length} kategori produk`);

    // Seed Jenis Kue
    console.log("Seeding jenis_kue...");
    const jenisKue = [
      { nama: "Sponge Cake", harga_base: 80000 },
      { nama: "Butter Cake", harga_base: 90000 },
      { nama: "Red Velvet", harga_base: 120000 },
      { nama: "Chocolate Cake", harga_base: 100000 },
      { nama: "Vanilla Cake", harga_base: 85000 },
      { nama: "Black Forest", harga_base: 110000 },
      { nama: "Cheesecake", harga_base: 130000 },
    ];

    for (const item of jenisKue) {
      await client.query(
        `INSERT INTO jenis_kue (id, nama, harga_base) 
         VALUES ($1, $2, $3) 
         ON CONFLICT (nama) DO NOTHING`,
        [uuidv4(), item.nama, item.harga_base]
      );
    }
    console.log(`  ✅ ${jenisKue.length} jenis kue`);

    // Seed Variasi Kue
    console.log("Seeding variasi_kue...");
    const variasiKue = [
      { nama: "Original", harga_tambahan: 0 },
      { nama: "Coklat Chip", harga_tambahan: 15000 },
      { nama: "Keju", harga_tambahan: 20000 },
      { nama: "Fruit Mix", harga_tambahan: 25000 },
      { nama: "Nuts", harga_tambahan: 30000 },
      { nama: "Oreo", harga_tambahan: 18000 },
      { nama: "Matcha", harga_tambahan: 22000 },
    ];

    for (const item of variasiKue) {
      await client.query(
        `INSERT INTO variasi_kue (id, nama, harga_tambahan) 
         VALUES ($1, $2, $3) 
         ON CONFLICT (nama) DO NOTHING`,
        [uuidv4(), item.nama, item.harga_tambahan]
      );
    }
    console.log(`  ✅ ${variasiKue.length} variasi kue`);

    // Seed Ukuran Kue
    console.log("Seeding ukuran_kue...");
    const ukuranKue = [
      { nama: "Mini (15cm)", multiplier_harga: 0.5 },
      { nama: "Small (20cm)", multiplier_harga: 1.0 },
      { nama: "Medium (25cm)", multiplier_harga: 1.5 },
      { nama: "Large (30cm)", multiplier_harga: 2.0 },
      { nama: "Extra Large (35cm)", multiplier_harga: 2.5 },
    ];

    for (const item of ukuranKue) {
      await client.query(
        `INSERT INTO ukuran_kue (id, nama, multiplier_harga) 
         VALUES ($1, $2, $3) 
         ON CONFLICT (nama) DO NOTHING`,
        [uuidv4(), item.nama, item.multiplier_harga]
      );
    }
    console.log(`  ✅ ${ukuranKue.length} ukuran kue`);

    // Seed Kotak Kue
    console.log("Seeding kotak_kue...");
    const kotakKue = [
      { nama: "Kotak Biasa", harga_tambahan: 5000 },
      { nama: "Kotak Premium", harga_tambahan: 10000 },
      { nama: "Kotak Eksklusif", harga_tambahan: 15000 },
      { nama: "Paper Bag", harga_tambahan: 3000 },
      { nama: "Gift Box", harga_tambahan: 20000 },
    ];

    for (const item of kotakKue) {
      await client.query(
        `INSERT INTO kotak_kue (id, nama, harga_tambahan) 
         VALUES ($1, $2, $3) 
         ON CONFLICT (nama) DO NOTHING`,
        [uuidv4(), item.nama, item.harga_tambahan]
      );
    }
    console.log(`  ✅ ${kotakKue.length} kotak kue`);

    // Seed Aksesoris Kue
    console.log("Seeding aksesoris_kue...");
    const aksesorisKue = [
      { nama: "Lilin Ulang Tahun", harga: 5000 },
      { nama: "Topper Happy Birthday", harga: 10000 },
      { nama: "Edible Flowers", harga: 15000 },
      { nama: "Chocolate Decoration", harga: 20000 },
      { nama: "Custom Message", harga: 25000 },
      { nama: "Fondant Figure", harga: 50000 },
      { nama: "Fresh Fruit Topping", harga: 35000 },
    ];

    for (const item of aksesorisKue) {
      await client.query(
        `INSERT INTO aksesoris_kue (id, nama, harga) 
         VALUES ($1, $2, $3) 
         ON CONFLICT (nama) DO NOTHING`,
        [uuidv4(), item.nama, item.harga]
      );
    }
    console.log(`  ✅ ${aksesorisKue.length} aksesoris kue`);

    await client.query("COMMIT");

    console.log("========================================");
    console.log("Data seeding completed successfully!");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Error seeding data:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run if executed directly
if (require.main === module) {
  seedData()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { seedData };
