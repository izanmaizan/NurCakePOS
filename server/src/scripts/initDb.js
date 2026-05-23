// server/src/scripts/initDb.js - Database Initialization Script
// Path: NurCakePOS/server/src/scripts/initDb.js

require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || "nurcake_pos",
  user: process.env.DB_USER || "izanm",
  password: process.env.DB_PASSWORD || "zxcv",
});

const createTablesSQL = `
-- ============================================
-- DEVICES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id VARCHAR(100) NOT NULL UNIQUE,
  device_name VARCHAR(255),
  device_type VARCHAR(50) NOT NULL,
  api_key VARCHAR(255) NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  registered_at TIMESTAMP DEFAULT NOW(),
  last_seen_at TIMESTAMP,
  last_sync_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_devices_device_id ON devices(device_id);
CREATE INDEX IF NOT EXISTS idx_devices_api_key ON devices(api_key);

-- ============================================
-- MASTER DATA TABLES (Read-only from devices)
-- ============================================

CREATE TABLE IF NOT EXISTS kategori_produk (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama VARCHAR(255) NOT NULL UNIQUE,
  deskripsi TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS jenis_kue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama VARCHAR(255) NOT NULL UNIQUE,
  harga_base DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS variasi_kue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama VARCHAR(255) NOT NULL UNIQUE,
  harga_tambahan DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ukuran_kue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama VARCHAR(255) NOT NULL UNIQUE,
  multiplier_harga DECIMAL(5,2) NOT NULL DEFAULT 1.0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kotak_kue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama VARCHAR(255) NOT NULL UNIQUE,
  harga_tambahan DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS aksesoris_kue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama VARCHAR(255) NOT NULL UNIQUE,
  harga DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- TRANSACTIONAL TABLES (Two-way sync)
-- ============================================

CREATE TABLE IF NOT EXISTS produk (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID UNIQUE,
  nama VARCHAR(255) NOT NULL,
  harga DECIMAL(12,2) NOT NULL,
  stok INTEGER NOT NULL DEFAULT 0,
  kategori_id UUID REFERENCES kategori_produk(id),
  gambar_path TEXT,
  device_id VARCHAR(100),
  version INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_produk_client_id ON produk(client_id);
CREATE INDEX IF NOT EXISTS idx_produk_updated_at ON produk(updated_at);
CREATE INDEX IF NOT EXISTS idx_produk_device_id ON produk(device_id);

CREATE TABLE IF NOT EXISTS transaksi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID UNIQUE,
  nomor_transaksi VARCHAR(50) NOT NULL,
  total_harga DECIMAL(12,2) NOT NULL,
  jumlah_item INTEGER NOT NULL DEFAULT 0,
  metode_pembayaran VARCHAR(50) NOT NULL,
  status_transaksi VARCHAR(50) DEFAULT 'selesai',
  catatan TEXT,
  nama_pelanggan VARCHAR(255),
  device_id VARCHAR(100) NOT NULL,
  device_created_at TIMESTAMP,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_transaksi_client_id ON transaksi(client_id);
CREATE INDEX IF NOT EXISTS idx_transaksi_updated_at ON transaksi(updated_at);
CREATE INDEX IF NOT EXISTS idx_transaksi_device_id ON transaksi(device_id);
CREATE INDEX IF NOT EXISTS idx_transaksi_nomor ON transaksi(nomor_transaksi);

CREATE TABLE IF NOT EXISTS detail_transaksi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID UNIQUE,
  transaksi_id UUID REFERENCES transaksi(id),
  transaksi_client_id UUID,
  produk_id UUID,
  nama_produk VARCHAR(255) NOT NULL,
  harga_satuan DECIMAL(12,2) NOT NULL,
  jumlah INTEGER NOT NULL,
  subtotal DECIMAL(12,2) NOT NULL,
  device_id VARCHAR(100),
  version INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_detail_transaksi_transaksi_id ON detail_transaksi(transaksi_id);
CREATE INDEX IF NOT EXISTS idx_detail_transaksi_client_id ON detail_transaksi(client_id);

CREATE TABLE IF NOT EXISTS pesanan_kue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID UNIQUE,
  nomor_pesanan VARCHAR(50) NOT NULL,
  nama_pelanggan VARCHAR(255) NOT NULL,
  nomor_telepon VARCHAR(20),
  jenis_kue VARCHAR(100) NOT NULL,
  variasi_kue VARCHAR(100),
  ukuran_kue VARCHAR(100) NOT NULL,
  aksesoris TEXT,
  harga_total DECIMAL(12,2) NOT NULL,
  tanggal_pesan TIMESTAMP NOT NULL,
  tanggal_ambil TIMESTAMP NOT NULL,
  status_pesanan VARCHAR(50) DEFAULT 'pending',
  catatan TEXT,
  gambar_referensi_path TEXT,
  device_id VARCHAR(100) NOT NULL,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pesanan_kue_client_id ON pesanan_kue(client_id);
CREATE INDEX IF NOT EXISTS idx_pesanan_kue_updated_at ON pesanan_kue(updated_at);
CREATE INDEX IF NOT EXISTS idx_pesanan_kue_device_id ON pesanan_kue(device_id);
CREATE INDEX IF NOT EXISTS idx_pesanan_kue_status ON pesanan_kue(status_pesanan);
CREATE INDEX IF NOT EXISTS idx_pesanan_kue_tanggal_ambil ON pesanan_kue(tanggal_ambil);

CREATE TABLE IF NOT EXISTS kue_ready (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID UNIQUE,
  nama VARCHAR(255) NOT NULL,
  jenis_kue VARCHAR(100) NOT NULL,
  variasi_kue VARCHAR(100),
  ukuran_kue VARCHAR(100) NOT NULL,
  harga_jual DECIMAL(12,2) NOT NULL,
  gambar_path TEXT,
  status VARCHAR(50) DEFAULT 'tersedia',
  catatan TEXT,
  device_id VARCHAR(100),
  version INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_kue_ready_client_id ON kue_ready(client_id);
CREATE INDEX IF NOT EXISTS idx_kue_ready_updated_at ON kue_ready(updated_at);
CREATE INDEX IF NOT EXISTS idx_kue_ready_status ON kue_ready(status);

-- ============================================
-- SYNC TRACKING TABLES
-- ============================================

CREATE TABLE IF NOT EXISTS sync_cursors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id VARCHAR(100) NOT NULL,
  table_name VARCHAR(100) NOT NULL,
  last_sync_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(device_id, table_name)
);

CREATE TABLE IF NOT EXISTS sync_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id VARCHAR(100) NOT NULL,
  table_name VARCHAR(100) NOT NULL,
  record_id UUID NOT NULL,
  operation VARCHAR(20) NOT NULL,
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_audit_device ON sync_audit_log(device_id);
CREATE INDEX IF NOT EXISTS idx_sync_audit_table ON sync_audit_log(table_name);
CREATE INDEX IF NOT EXISTS idx_sync_audit_created ON sync_audit_log(created_at);

CREATE TABLE IF NOT EXISTS processed_batches (
  batch_id VARCHAR(100) PRIMARY KEY,
  device_id VARCHAR(100) NOT NULL,
  processed_at TIMESTAMP DEFAULT NOW(),
  records_count INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_processed_batches_device ON processed_batches(device_id);

-- ============================================
-- BACKUP TRACKING TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS backup_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_type VARCHAR(50) NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  status VARCHAR(50) NOT NULL,
  started_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP,
  error_message TEXT
);

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to all tables with updated_at column
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN 
    SELECT table_name 
    FROM information_schema.columns 
    WHERE column_name = 'updated_at' 
      AND table_schema = 'public'
  LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS update_%s_updated_at ON %s;
      CREATE TRIGGER update_%s_updated_at
        BEFORE UPDATE ON %s
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    ', t, t, t, t);
  END LOOP;
END;
$$;

-- ============================================
-- CLEANUP OLD DATA (Optional scheduled job)
-- ============================================

-- Function to clean old sync audit logs (keep last 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_sync_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM sync_audit_log WHERE created_at < NOW() - INTERVAL '30 days';
  DELETE FROM processed_batches WHERE processed_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;
`;

async function initDatabase() {
  const client = await pool.connect();

  try {
    console.log("Starting database initialization...");
    console.log("========================================");

    await client.query(createTablesSQL);

    console.log("✅ Tables created successfully");
    console.log("========================================");
    console.log("Database initialization completed!");
  } catch (error) {
    console.error("❌ Error initializing database:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run if executed directly
if (require.main === module) {
  initDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { initDatabase };
