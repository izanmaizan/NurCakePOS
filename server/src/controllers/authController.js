// server/src/controllers/authController.js - Device Authentication Controller
// Path: NurCakePOS/server/src/controllers/authController.js

const { query, transaction } = require("../models/database");
const { v4: uuidv4 } = require("uuid");
const crypto = require("crypto");

// Generate API key
function generateApiKey() {
  return "nc_" + crypto.randomBytes(32).toString("hex");
}

// Register new device
async function registerDevice(req, res) {
  try {
    const { device_id, device_name, device_type } = req.body;

    if (!device_id || !device_type) {
      return res.status(400).json({
        success: false,
        error: "device_id dan device_type wajib diisi",
      });
    }

    // Check if device already registered
    const existing = await query("SELECT * FROM devices WHERE device_id = $1", [
      device_id,
    ]);

    if (existing.rows.length > 0) {
      // Device already registered, return existing API key
      return res.json({
        success: true,
        api_key: existing.rows[0].api_key,
        device_id: existing.rows[0].device_id,
        message: "Device sudah terdaftar",
      });
    }

    // Generate new API key
    const apiKey = generateApiKey();
    const serverId = uuidv4();

    // Insert new device
    await query(
      `INSERT INTO devices (
        id, device_id, device_name, device_type, api_key,
        is_active, registered_at, last_seen_at
      ) VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())`,
      [serverId, device_id, device_name || "Device", device_type, apiKey]
    );

    console.log(`Device registered: ${device_id} (${device_type})`);

    res.status(201).json({
      success: true,
      api_key: apiKey,
      device_id: device_id,
      message: "Device berhasil didaftarkan",
    });
  } catch (error) {
    console.error("Error registering device:", error);
    res.status(500).json({
      success: false,
      error: "Gagal mendaftarkan device",
    });
  }
}

// Verify device token
async function verifyDevice(req, res) {
  try {
    const deviceId = req.headers["x-device-id"];
    const apiKey = req.headers["x-api-key"];

    if (!deviceId || !apiKey) {
      return res.status(401).json({
        valid: false,
        error: "Device ID dan API Key diperlukan",
      });
    }

    const result = await query(
      "SELECT * FROM devices WHERE device_id = $1 AND api_key = $2 AND is_active = true",
      [deviceId, apiKey]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        valid: false,
        error: "Device tidak valid atau tidak aktif",
      });
    }

    // Update last seen
    await query(
      "UPDATE devices SET last_seen_at = NOW() WHERE device_id = $1",
      [deviceId]
    );

    res.json({
      valid: true,
      device: {
        id: result.rows[0].device_id,
        name: result.rows[0].device_name,
        type: result.rows[0].device_type,
      },
    });
  } catch (error) {
    console.error("Error verifying device:", error);
    res.status(500).json({
      valid: false,
      error: "Gagal memverifikasi device",
    });
  }
}

module.exports = {
  registerDevice,
  verifyDevice,
};
