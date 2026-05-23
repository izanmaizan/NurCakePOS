// server/src/controllers/masterController.js - Master Data Controller
// Path: NurCakePOS/server/src/controllers/masterController.js

const { query } = require("../models/database");

// Get all master data
async function getAllMasterData(req, res) {
  try {
    const [
      kategoriProduk,
      jenisKue,
      variasiKue,
      ukuranKue,
      kotakKue,
      aksesorisKue,
    ] = await Promise.all([
      query("SELECT * FROM kategori_produk ORDER BY nama"),
      query("SELECT * FROM jenis_kue ORDER BY nama"),
      query("SELECT * FROM variasi_kue ORDER BY nama"),
      query("SELECT * FROM ukuran_kue ORDER BY multiplier_harga"),
      query("SELECT * FROM kotak_kue ORDER BY nama"),
      query("SELECT * FROM aksesoris_kue ORDER BY nama"),
    ]);

    res.json({
      success: true,
      data: {
        kategoriProduk: kategoriProduk.rows,
        jenisKue: jenisKue.rows,
        variasiKue: variasiKue.rows,
        ukuranKue: ukuranKue.rows,
        kotakKue: kotakKue.rows,
        aksesorisKue: aksesorisKue.rows,
      },
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error getting master data:", error);
    res.status(500).json({
      success: false,
      error: "Gagal mengambil master data",
    });
  }
}

// Individual master data getters
async function getKategoriProduk(req, res) {
  try {
    const result = await query("SELECT * FROM kategori_produk ORDER BY nama");
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

async function getJenisKue(req, res) {
  try {
    const result = await query("SELECT * FROM jenis_kue ORDER BY nama");
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

async function getVariasiKue(req, res) {
  try {
    const result = await query("SELECT * FROM variasi_kue ORDER BY nama");
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

async function getUkuranKue(req, res) {
  try {
    const result = await query(
      "SELECT * FROM ukuran_kue ORDER BY multiplier_harga"
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

async function getKotakKue(req, res) {
  try {
    const result = await query("SELECT * FROM kotak_kue ORDER BY nama");
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

async function getAksesorisKue(req, res) {
  try {
    const result = await query("SELECT * FROM aksesoris_kue ORDER BY nama");
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = {
  getAllMasterData,
  getKategoriProduk,
  getJenisKue,
  getVariasiKue,
  getUkuranKue,
  getKotakKue,
  getAksesorisKue,
};
