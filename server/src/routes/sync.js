// server/src/routes/sync.js - Sync API Routes
// Path: NurCakePOS/server/src/routes/sync.js

const express = require("express");
const router = express.Router();
const syncController = require("../controllers/syncController");
const { authenticateDevice } = require("../middleware/auth");

// All sync routes require device authentication
router.use(authenticateDevice);

// POST /api/v1/sync/push - Push changes from device
router.post("/push", syncController.pushChanges);

// GET /api/v1/sync/pull - Pull changes from server
router.get("/pull", syncController.pullChanges);

// GET /api/v1/sync/status - Get sync status
router.get("/status", syncController.getStatus);

// POST /api/v1/sync/resolve - Resolve conflict
router.post("/resolve", syncController.resolveConflict);

module.exports = router;
