// server/src/routes/auth.js - Device Authentication Routes
// Path: NurCakePOS/server/src/routes/auth.js

const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");

// POST /api/v1/auth/register - Register new device
router.post("/register", authController.registerDevice);

// POST /api/v1/auth/verify - Verify device token
router.post("/verify", authController.verifyDevice);

module.exports = router;
