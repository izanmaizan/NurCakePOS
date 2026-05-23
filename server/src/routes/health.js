// server/src/routes/health.js - Health Check Routes
// Path: NurCakePOS/server/src/routes/health.js

const express = require("express");
const router = express.Router();
const { query } = require("../models/database");

// GET /api/v1/health - Server health check
router.get("/health", async (req, res) => {
  try {
    // Check database connection
    const dbResult = await query("SELECT NOW() as server_time");

    res.json({
      status: "healthy",
      serverTime: dbResult.rows[0].server_time,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
    });
  } catch (error) {
    res.status(503).json({
      status: "unhealthy",
      error: error.message,
    });
  }
});

// GET /api/v1/stats - Server statistics
router.get("/stats", async (req, res) => {
  try {
    const [devicesResult, recordsResult] = await Promise.all([
      query("SELECT COUNT(*) as count FROM devices WHERE is_active = true"),
      query(`
        SELECT 
          (SELECT COUNT(*) FROM transaksi WHERE deleted_at IS NULL) as transaksi,
          (SELECT COUNT(*) FROM pesanan_kue WHERE deleted_at IS NULL) as pesanan,
          (SELECT COUNT(*) FROM produk WHERE deleted_at IS NULL) as produk,
          (SELECT COUNT(*) FROM kue_ready WHERE deleted_at IS NULL) as kue_ready
      `),
    ]);

    res.json({
      success: true,
      totalDevices: parseInt(devicesResult.rows[0].count),
      totalRecords: {
        transaksi: parseInt(recordsResult.rows[0].transaksi),
        pesanan_kue: parseInt(recordsResult.rows[0].pesanan),
        produk: parseInt(recordsResult.rows[0].produk),
        kue_ready: parseInt(recordsResult.rows[0].kue_ready),
      },
      lastActivityAt: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
