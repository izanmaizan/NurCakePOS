// server/src/models/database.js - PostgreSQL Connection Pool
// Path: NurCakePOS/server/src/models/database.js

const { Pool } = require("pg");

// Create connection pool
const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || "nurcake_pos",
  user: process.env.DB_USER || "izanm",
  password: process.env.DB_PASSWORD || "zxcv",
  max: 20, // Max connections
  idleTimeoutMillis: 30000, // Close idle clients after 30s
  connectionTimeoutMillis: 5000,
});

// Test connection
async function initDatabase() {
  try {
    const client = await pool.connect();
    const result = await client.query("SELECT NOW()");
    console.log("Database time:", result.rows[0].now);
    client.release();
    return true;
  } catch (error) {
    console.error("Database connection error:", error);
    throw error;
  }
}

// Query helper
async function query(text, params) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;

    // Log slow queries
    if (duration > 1000) {
      console.warn("Slow query:", { text, duration, rows: result.rowCount });
    }

    return result;
  } catch (error) {
    console.error("Query error:", { text, error: error.message });
    throw error;
  }
}

// Get client for transactions
async function getClient() {
  const client = await pool.connect();
  return client;
}

// Transaction helper
async function transaction(callback) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  query,
  getClient,
  transaction,
  initDatabase,
};
