// server/src/middleware/auth.js - Authentication Middleware
// Path: NurCakePOS/server/src/middleware/auth.js

const { query } = require("../models/database");

// Authenticate device using API key
async function authenticateDevice(req, res, next) {
  try {
    const deviceId = req.headers["x-device-id"];
    const apiKey = req.headers["x-api-key"];

    if (!deviceId || !apiKey) {
      return res.status(401).json({
        success: false,
        error:
          "Authentication required. Provide X-Device-ID and X-API-Key headers.",
      });
    }

    // Verify device
    const result = await query(
      "SELECT * FROM devices WHERE device_id = $1 AND api_key = $2 AND is_active = true",
      [deviceId, apiKey]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: "Invalid device credentials or device is inactive.",
      });
    }

    // Attach device info to request
    req.deviceId = deviceId;
    req.device = result.rows[0];

    // Update last seen
    await query(
      "UPDATE devices SET last_seen_at = NOW() WHERE device_id = $1",
      [deviceId]
    );

    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(500).json({
      success: false,
      error: "Authentication failed.",
    });
  }
}

// Optional: Rate limiting middleware
function rateLimit(maxRequests = 100, windowMs = 60000) {
  const requests = new Map();

  return (req, res, next) => {
    const deviceId = req.headers["x-device-id"] || req.ip;
    const now = Date.now();

    if (!requests.has(deviceId)) {
      requests.set(deviceId, []);
    }

    const deviceRequests = requests.get(deviceId);

    // Remove old requests outside window
    const validRequests = deviceRequests.filter(
      (time) => now - time < windowMs
    );
    requests.set(deviceId, validRequests);

    if (validRequests.length >= maxRequests) {
      return res.status(429).json({
        success: false,
        error: "Too many requests. Please try again later.",
      });
    }

    validRequests.push(now);
    next();
  };
}

module.exports = {
  authenticateDevice,
  rateLimit,
};
