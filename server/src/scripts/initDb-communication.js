// src/scripts/initDb-communication.js
const { query } = require("../models/database");

async function initCommDb() {
  console.log("Starting communication database initialization...");
  try {
    await query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
    await query(`
      CREATE TABLE IF NOT EXISTS messages (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("✅ Communication tables created successfully");
  } catch (error) {
    console.error("Error initializing comm DB:", error);
    throw error;
  }
}

initCommDb()
  .then(() => console.log("Communication DB initialization completed!"))
  .catch(() => process.exit(1));
