// server/src/routes/master.js - Master Data Routes
// Path: NurCakePOS/server/src/routes/master.js

const express = require("express");
const router = express.Router();
const masterController = require("../controllers/masterController");
const { authenticateDevice } = require("../middleware/auth");

// GET /api/v1/master/all - Get all master data
router.get("/all", authenticateDevice, masterController.getAllMasterData);

// Individual master data endpoints
router.get(
  "/kategori-produk",
  authenticateDevice,
  masterController.getKategoriProduk
);
router.get("/jenis-kue", authenticateDevice, masterController.getJenisKue);
router.get("/variasi-kue", authenticateDevice, masterController.getVariasiKue);
router.get("/ukuran-kue", authenticateDevice, masterController.getUkuranKue);
router.get("/kotak-kue", authenticateDevice, masterController.getKotakKue);
router.get(
  "/aksesoris-kue",
  authenticateDevice,
  masterController.getAksesorisKue
);

module.exports = router;
