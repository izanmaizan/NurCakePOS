// server/src/index.js - NurCake Sync Server Entry Point
// Path: NurCakePOS/server/src/index.js

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");

const { initDatabase } = require("./models/database");
const authRoutes = require("./routes/auth");
const syncRoutes = require("./routes/sync");
const masterRoutes = require("./routes/master");
const healthRoutes = require("./routes/health");
const { errorHandler } = require("./middleware/errorHandler");

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// MIDDLEWARE
// ============================================

// Security headers
app.use(helmet());

// CORS - allow all origins for LAN
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "X-Device-ID", "X-API-Key"],
  })
);

// Compression
app.use(compression());

// Body parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Logging
app.use(morgan("combined"));

// ============================================
// ROUTES
// ============================================

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/sync", syncRoutes);
app.use("/api/v1/master", masterRoutes);
app.use("/api/v1", healthRoutes);

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    name: "NurCake Sync Server",
    version: "1.0.0",
    status: "running",
    endpoints: {
      health: "/api/v1/health",
      auth: "/api/v1/auth",
      sync: "/api/v1/sync",
      master: "/api/v1/master",
    },
  });
});

// ============================================
// ERROR HANDLING
// ============================================

app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Endpoint tidak ditemukan",
  });
});

// ============================================
// START SERVER
// ============================================

async function startServer() {
  try {
    // Initialize database connection
    console.log("Connecting to database...");
    await initDatabase();
    console.log("Database connected successfully");

    // Start Express server
    app.listen(PORT, "0.0.0.0", () => {
      console.log("========================================");
      console.log("   NurCake Sync Server");
      console.log("========================================");
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
      console.log(`API Base URL: http://0.0.0.0:${PORT}/api/v1`);
      console.log("========================================");
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received. Shutting down gracefully...");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("SIGINT received. Shutting down gracefully...");
  process.exit(0);
});

startServer();
