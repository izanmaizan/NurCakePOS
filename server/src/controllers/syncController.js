// server/src/controllers/syncController.js - Sync Controller
// Path: NurCakePOS/server/src/controllers/syncController.js

const { query, getClient } = require("../models/database");
const { v4: uuidv4 } = require("uuid");

// Store processed batch IDs for idempotency (simple in-memory, use Redis in production)
const processedBatches = new Map();

// Clean old batch IDs (older than 24 hours)
setInterval(() => {
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  for (const [batchId, timestamp] of processedBatches) {
    if (timestamp < oneDayAgo) {
      processedBatches.delete(batchId);
    }
  }
}, 60 * 60 * 1000); // Run every hour

// ============================================
// PUSH CHANGES
// ============================================

async function pushChanges(req, res) {
  const { batch_id, device_id, changes } = req.body;

  // Validate request
  if (!batch_id || !device_id || !Array.isArray(changes)) {
    return res.status(400).json({
      success: false,
      error: "batch_id, device_id, dan changes wajib diisi",
    });
  }

  // Check idempotency
  if (processedBatches.has(batch_id)) {
    console.log(`Batch ${batch_id} already processed, returning cached result`);
    return res.json({
      success: true,
      batch_id,
      processed_at: new Date(processedBatches.get(batch_id)).toISOString(),
      results: [],
      conflicts: [],
      message: "Batch sudah diproses sebelumnya",
    });
  }

  const results = [];
  const conflicts = [];
  const client = await getClient();

  try {
    await client.query("BEGIN");

    for (const change of changes) {
      const { table, operation, client_id, data, version } = change;

      try {
        let result;

        switch (table) {
          case "transaksi":
            result = await processTransaksi(
              client,
              operation,
              client_id,
              data,
              version,
              device_id
            );
            break;
          case "detail_transaksi":
            result = await processDetailTransaksi(
              client,
              operation,
              client_id,
              data,
              version,
              device_id
            );
            break;
          case "pesanan_kue":
            result = await processPesananKue(
              client,
              operation,
              client_id,
              data,
              version,
              device_id
            );
            break;
          case "produk":
            result = await processProduk(
              client,
              operation,
              client_id,
              data,
              version,
              device_id
            );
            break;
          case "kue_ready":
            result = await processKueReady(
              client,
              operation,
              client_id,
              data,
              version,
              device_id
            );
            break;
          default:
            result = { status: "skipped", reason: "Unknown table" };
        }

        if (result.conflict) {
          conflicts.push({
            client_id,
            reason: result.reason,
            server_version: result.server_version,
            client_version: version,
            resolution: "server_wins",
          });
        } else {
          results.push({
            client_id,
            server_id: result.server_id,
            status: result.status,
            server_version: result.version,
          });
        }
      } catch (error) {
        console.error(`Error processing ${table}/${client_id}:`, error);
        conflicts.push({
          client_id,
          reason: "validation_error",
          message: error.message,
          resolution: "manual",
        });
      }
    }

    await client.query("COMMIT");

    // Mark batch as processed
    processedBatches.set(batch_id, Date.now());

    // Update device last sync
    await query(
      "UPDATE devices SET last_sync_at = NOW() WHERE device_id = $1",
      [device_id]
    );

    console.log(
      `Push completed: ${results.length} processed, ${conflicts.length} conflicts`
    );

    res.json({
      success: true,
      batch_id,
      processed_at: new Date().toISOString(),
      results,
      conflicts,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Push error:", error);
    res.status(500).json({
      success: false,
      error: "Gagal memproses push sync",
    });
  } finally {
    client.release();
  }
}

// ============================================
// PROCESS FUNCTIONS
// ============================================

async function processTransaksi(
  client,
  operation,
  clientId,
  data,
  version,
  deviceId
) {
  const existing = await client.query(
    "SELECT * FROM transaksi WHERE client_id = $1",
    [clientId]
  );

  if (operation === "INSERT") {
    if (existing.rows.length > 0) {
      return {
        status: "skipped",
        server_id: existing.rows[0].id,
        version: existing.rows[0].version,
      };
    }

    const serverId = uuidv4();
    await client.query(
      `INSERT INTO transaksi (
        id, client_id, nomor_transaksi, total_harga, jumlah_item,
        metode_pembayaran, status_transaksi, catatan, nama_pelanggan,
        device_id, version, device_created_at, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())`,
      [
        serverId,
        clientId,
        data.nomor_transaksi || data.nomorTransaksi,
        data.total_harga || data.totalHarga,
        data.jumlah_item || data.items?.length || 0,
        data.metode_pembayaran || data.metodePembayaran,
        data.status_transaksi || data.statusPembayaran || "selesai",
        data.catatan || "",
        data.nama_pelanggan || "",
        deviceId,
        1,
        data.device_created_at || data.dibuat || new Date().toISOString(),
      ]
    );

    return { status: "inserted", server_id: serverId, version: 1 };
  } else if (operation === "UPDATE") {
    if (existing.rows.length === 0) {
      return { conflict: true, reason: "deleted_on_server" };
    }

    const serverVersion = existing.rows[0].version;
    if (version <= serverVersion) {
      return {
        conflict: true,
        reason: "version_mismatch",
        server_version: serverVersion,
      };
    }

    const newVersion = serverVersion + 1;
    await client.query(
      `UPDATE transaksi SET
        status_transaksi = COALESCE($1, status_transaksi),
        catatan = COALESCE($2, catatan),
        version = $3,
        updated_at = NOW()
      WHERE client_id = $4`,
      [
        data.status_transaksi || data.statusPembayaran,
        data.catatan,
        newVersion,
        clientId,
      ]
    );

    return {
      status: "updated",
      server_id: existing.rows[0].id,
      version: newVersion,
    };
  } else if (operation === "DELETE") {
    if (existing.rows.length === 0) {
      return { status: "skipped", reason: "already_deleted" };
    }

    await client.query(
      `UPDATE transaksi SET 
        deleted_at = NOW(), 
        version = version + 1,
        updated_at = NOW()
      WHERE client_id = $1`,
      [clientId]
    );

    return {
      status: "deleted",
      server_id: existing.rows[0].id,
      version: existing.rows[0].version + 1,
    };
  }

  return { status: "skipped" };
}

async function processDetailTransaksi(
  client,
  operation,
  clientId,
  data,
  version,
  deviceId
) {
  const existing = await client.query(
    "SELECT * FROM detail_transaksi WHERE client_id = $1",
    [clientId]
  );

  if (operation === "INSERT") {
    if (existing.rows.length > 0) {
      return {
        status: "skipped",
        server_id: existing.rows[0].id,
        version: existing.rows[0].version,
      };
    }

    // Find transaksi_id from transaksi_client_id
    let transaksiId = data.transaksi_id;
    if (data.transaksi_client_id || data.transaksiId) {
      const transaksiResult = await client.query(
        "SELECT id FROM transaksi WHERE client_id = $1",
        [data.transaksi_client_id || data.transaksiId]
      );
      if (transaksiResult.rows.length > 0) {
        transaksiId = transaksiResult.rows[0].id;
      }
    }

    const serverId = uuidv4();
    await client.query(
      `INSERT INTO detail_transaksi (
        id, client_id, transaksi_id, transaksi_client_id, produk_id,
        nama_produk, harga_satuan, jumlah, subtotal,
        device_id, version, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())`,
      [
        serverId,
        clientId,
        transaksiId,
        data.transaksi_client_id || data.transaksiId,
        data.produk_id || data.itemId,
        data.nama_produk || data.namaItem,
        data.harga_satuan || data.hargaSatuan,
        data.jumlah,
        data.subtotal,
        deviceId,
        1,
      ]
    );

    return { status: "inserted", server_id: serverId, version: 1 };
  } else if (operation === "UPDATE") {
    if (existing.rows.length === 0) {
      return { conflict: true, reason: "deleted_on_server" };
    }

    const serverVersion = existing.rows[0].version;
    const newVersion = serverVersion + 1;

    await client.query(
      `UPDATE detail_transaksi SET
        jumlah = COALESCE($1, jumlah),
        subtotal = COALESCE($2, subtotal),
        version = $3,
        updated_at = NOW()
      WHERE client_id = $4`,
      [data.jumlah, data.subtotal, newVersion, clientId]
    );

    return {
      status: "updated",
      server_id: existing.rows[0].id,
      version: newVersion,
    };
  } else if (operation === "DELETE") {
    if (existing.rows.length === 0) {
      return { status: "skipped", reason: "already_deleted" };
    }

    await client.query(
      `UPDATE detail_transaksi SET 
        deleted_at = NOW(), 
        version = version + 1,
        updated_at = NOW()
      WHERE client_id = $1`,
      [clientId]
    );

    return {
      status: "deleted",
      server_id: existing.rows[0].id,
      version: existing.rows[0].version + 1,
    };
  }

  return { status: "skipped" };
}

async function processPesananKue(
  client,
  operation,
  clientId,
  data,
  version,
  deviceId
) {
  const existing = await client.query(
    "SELECT * FROM pesanan_kue WHERE client_id = $1",
    [clientId]
  );

  if (operation === "INSERT") {
    if (existing.rows.length > 0) {
      return {
        status: "skipped",
        server_id: existing.rows[0].id,
        version: existing.rows[0].version,
      };
    }

    const serverId = uuidv4();
    await client.query(
      `INSERT INTO pesanan_kue (
        id, client_id, nomor_pesanan, nama_pelanggan, nomor_telepon,
        jenis_kue, variasi_kue, ukuran_kue, aksesoris,
        harga_total, tanggal_pesan, tanggal_ambil,
        status_pesanan, catatan, gambar_referensi_path,
        device_id, version, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW(), NOW())`,
      [
        serverId,
        clientId,
        data.nomor_pesanan || data.nomorPesanan,
        data.nama_pelanggan || data.namaPelanggan,
        data.nomor_telepon || data.noHp || "",
        data.jenis_kue || data.jenisKue,
        data.variasi_kue || data.variasiKue || "",
        data.ukuran_kue || data.ukuranKue,
        data.aksesoris || data.aksesorisKue || "",
        data.harga_total || data.totalHarga,
        data.tanggal_pesan || data.tanggalPesan || new Date().toISOString(),
        data.tanggal_ambil || data.tanggalAmbil,
        data.status_pesanan || data.statusPesanan || "pending",
        data.catatan || "",
        data.gambar_referensi_path || data.gambarReferensi || "",
        deviceId,
        1,
      ]
    );

    return { status: "inserted", server_id: serverId, version: 1 };
  } else if (operation === "UPDATE") {
    if (existing.rows.length === 0) {
      return { conflict: true, reason: "deleted_on_server" };
    }

    const serverVersion = existing.rows[0].version;
    if (version <= serverVersion) {
      return {
        conflict: true,
        reason: "version_mismatch",
        server_version: serverVersion,
      };
    }

    const newVersion = serverVersion + 1;
    await client.query(
      `UPDATE pesanan_kue SET
        status_pesanan = COALESCE($1, status_pesanan),
        catatan = COALESCE($2, catatan),
        tanggal_ambil = COALESCE($3, tanggal_ambil),
        harga_total = COALESCE($4, harga_total),
        version = $5,
        updated_at = NOW()
      WHERE client_id = $6`,
      [
        data.status_pesanan || data.statusPesanan,
        data.catatan,
        data.tanggal_ambil || data.tanggalAmbil,
        data.harga_total || data.totalHarga,
        newVersion,
        clientId,
      ]
    );

    return {
      status: "updated",
      server_id: existing.rows[0].id,
      version: newVersion,
    };
  } else if (operation === "DELETE") {
    if (existing.rows.length === 0) {
      return { status: "skipped", reason: "already_deleted" };
    }

    await client.query(
      `UPDATE pesanan_kue SET 
        deleted_at = NOW(), 
        version = version + 1,
        updated_at = NOW()
      WHERE client_id = $1`,
      [clientId]
    );

    return {
      status: "deleted",
      server_id: existing.rows[0].id,
      version: existing.rows[0].version + 1,
    };
  }

  return { status: "skipped" };
}

async function processProduk(
  client,
  operation,
  clientId,
  data,
  version,
  deviceId
) {
  const existing = await client.query(
    "SELECT * FROM produk WHERE client_id = $1",
    [clientId]
  );

  if (operation === "INSERT") {
    if (existing.rows.length > 0) {
      return {
        status: "skipped",
        server_id: existing.rows[0].id,
        version: existing.rows[0].version,
      };
    }

    const serverId = uuidv4();
    await client.query(
      `INSERT INTO produk (
        id, client_id, nama, harga, stok, kategori_id,
        device_id, version, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
      [
        serverId,
        clientId,
        data.nama,
        data.harga,
        data.stok,
        data.kategori_id || data.kategoriId,
        deviceId,
        1,
      ]
    );

    return { status: "inserted", server_id: serverId, version: 1 };
  } else if (operation === "UPDATE") {
    if (existing.rows.length === 0) {
      return { conflict: true, reason: "deleted_on_server" };
    }

    const serverVersion = existing.rows[0].version;
    const newVersion = serverVersion + 1;

    // For stock updates, we need special handling
    if (data.stok_reduced) {
      await client.query(
        `UPDATE produk SET
          stok = stok - $1,
          version = $2,
          updated_at = NOW()
        WHERE client_id = $3 AND stok >= $1`,
        [data.stok_reduced, newVersion, clientId]
      );
    } else {
      await client.query(
        `UPDATE produk SET
          nama = COALESCE($1, nama),
          harga = COALESCE($2, harga),
          stok = COALESCE($3, stok),
          version = $4,
          updated_at = NOW()
        WHERE client_id = $5`,
        [data.nama, data.harga, data.stok, newVersion, clientId]
      );
    }

    return {
      status: "updated",
      server_id: existing.rows[0].id,
      version: newVersion,
    };
  } else if (operation === "DELETE") {
    if (existing.rows.length === 0) {
      return { status: "skipped", reason: "already_deleted" };
    }

    await client.query(
      `UPDATE produk SET 
        deleted_at = NOW(), 
        version = version + 1,
        updated_at = NOW()
      WHERE client_id = $1`,
      [clientId]
    );

    return {
      status: "deleted",
      server_id: existing.rows[0].id,
      version: existing.rows[0].version + 1,
    };
  }

  return { status: "skipped" };
}

async function processKueReady(
  client,
  operation,
  clientId,
  data,
  version,
  deviceId
) {
  const existing = await client.query(
    "SELECT * FROM kue_ready WHERE client_id = $1",
    [clientId]
  );

  if (operation === "INSERT") {
    if (existing.rows.length > 0) {
      return {
        status: "skipped",
        server_id: existing.rows[0].id,
        version: existing.rows[0].version,
      };
    }

    const serverId = uuidv4();
    await client.query(
      `INSERT INTO kue_ready (
        id, client_id, nama, jenis_kue, variasi_kue, ukuran_kue,
        harga_jual, status, catatan, device_id, version, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())`,
      [
        serverId,
        clientId,
        data.nama,
        data.jenis_kue || data.jenisKue,
        data.variasi_kue || data.variasiKue || "",
        data.ukuran_kue || data.ukuranKue,
        data.harga_jual || data.hargaJual,
        data.status || "tersedia",
        data.catatan || "",
        deviceId,
        1,
      ]
    );

    return { status: "inserted", server_id: serverId, version: 1 };
  } else if (operation === "UPDATE") {
    if (existing.rows.length === 0) {
      return { conflict: true, reason: "deleted_on_server" };
    }

    const serverVersion = existing.rows[0].version;
    const newVersion = serverVersion + 1;

    await client.query(
      `UPDATE kue_ready SET
        nama = COALESCE($1, nama),
        status = COALESCE($2, status),
        catatan = COALESCE($3, catatan),
        harga_jual = COALESCE($4, harga_jual),
        version = $5,
        updated_at = NOW()
      WHERE client_id = $6`,
      [
        data.nama,
        data.status,
        data.catatan,
        data.harga_jual || data.hargaJual,
        newVersion,
        clientId,
      ]
    );

    return {
      status: "updated",
      server_id: existing.rows[0].id,
      version: newVersion,
    };
  } else if (operation === "DELETE") {
    if (existing.rows.length === 0) {
      return { status: "skipped" };
    }

    await client.query(
      `UPDATE kue_ready SET deleted_at = NOW(), version = version + 1, updated_at = NOW() WHERE client_id = $1`,
      [clientId]
    );

    return {
      status: "deleted",
      server_id: existing.rows[0].id,
      version: existing.rows[0].version + 1,
    };
  }

  return { status: "skipped" };
}

// ============================================
// PULL CHANGES
// ============================================

async function pullChanges(req, res) {
  try {
    const { since, tables, limit = 100, exclude_device } = req.query;
    const deviceId = req.deviceId;

    if (!since) {
      return res.status(400).json({
        success: false,
        error: 'Parameter "since" wajib diisi',
      });
    }

    const sinceDate = new Date(since);
    const maxLimit = Math.min(parseInt(limit), 500);

    const changes = {};
    let hasMore = false;

    // Tables to pull
    const tablesToPull = tables
      ? tables.split(",")
      : ["transaksi", "pesanan_kue", "produk", "kue_ready"];

    // Validate table names
    const validTables = [
      "transaksi",
      "detail_transaksi",
      "pesanan_kue",
      "produk",
      "kue_ready",
    ];

    for (const table of tablesToPull) {
      if (!validTables.includes(table)) {
        continue;
      }

      const result = await query(
        `SELECT * FROM ${table} 
         WHERE updated_at > $1 
           AND ($2::text IS NULL OR device_id != $2)
         ORDER BY updated_at ASC
         LIMIT $3`,
        [sinceDate, exclude_device || null, maxLimit + 1]
      );

      if (result.rows.length > maxLimit) {
        hasMore = true;
        result.rows.pop();
      }

      changes[table] = result.rows.map((row) => ({
        server_id: row.id,
        client_id: row.client_id,
        operation: row.deleted_at ? "DELETE" : "UPSERT",
        data: row,
        version: row.version,
        updated_at: row.updated_at,
        source_device: row.device_id,
      }));
    }

    // Get server time
    const serverTimeResult = await query("SELECT NOW() as server_time");

    res.json({
      success: true,
      server_time: serverTimeResult.rows[0].server_time,
      has_more: hasMore,
      changes,
    });
  } catch (error) {
    console.error("Pull error:", error);
    res.status(500).json({
      success: false,
      error: "Gagal memproses pull sync",
    });
  }
}

// ============================================
// GET STATUS
// ============================================

async function getStatus(req, res) {
  try {
    const deviceId = req.deviceId;

    const [serverTimeResult, deviceResult] = await Promise.all([
      query("SELECT NOW() as server_time"),
      query("SELECT last_sync_at FROM devices WHERE device_id = $1", [
        deviceId,
      ]),
    ]);

    const lastSyncAt = deviceResult.rows[0]?.last_sync_at;

    const pendingResult = await query(
      `
        SELECT 
          (SELECT COUNT(*) FROM transaksi WHERE device_id != $1 AND updated_at > COALESCE($2, '1970-01-01')) +
          (SELECT COUNT(*) FROM pesanan_kue WHERE device_id != $1 AND updated_at > COALESCE($2, '1970-01-01')) +
          (SELECT COUNT(*) FROM produk WHERE device_id != $1 AND updated_at > COALESCE($2, '1970-01-01')) +
          (SELECT COUNT(*) FROM kue_ready WHERE device_id != $1 AND updated_at > COALESCE($2, '1970-01-01'))
        as pending_count
      `,
      [deviceId, lastSyncAt]
    );

    res.json({
      success: true,
      serverTime: serverTimeResult.rows[0].server_time,
      deviceLastSync: lastSyncAt || null,
      pendingOnServer: parseInt(pendingResult.rows[0]?.pending_count || 0),
    });
  } catch (error) {
    console.error("Status error:", error);
    res.status(500).json({
      success: false,
      error: "Gagal mengambil status sync",
    });
  }
}

// ============================================
// RESOLVE CONFLICT
// ============================================

async function resolveConflict(req, res) {
  try {
    const { table_name, client_id, resolution, merged_data } = req.body;

    if (!table_name || !client_id || !resolution) {
      return res.status(400).json({
        success: false,
        error: "table_name, client_id, dan resolution wajib diisi",
      });
    }

    // Validate table name
    const validTables = [
      "transaksi",
      "detail_transaksi",
      "pesanan_kue",
      "produk",
      "kue_ready",
    ];
    if (!validTables.includes(table_name)) {
      return res.status(400).json({
        success: false,
        error: "Invalid table name",
      });
    }

    if (resolution === "accept_client" && merged_data) {
      const currentVersion = await query(
        `SELECT version FROM ${table_name} WHERE client_id = $1`,
        [client_id]
      );

      const newVersion = (currentVersion.rows[0]?.version || 0) + 1;

      await query(
        `UPDATE ${table_name} SET version = $1, updated_at = NOW() WHERE client_id = $2`,
        [newVersion, client_id]
      );

      res.json({
        success: true,
        version: newVersion,
        message: "Conflict resolved with client data",
      });
    } else if (resolution === "accept_server") {
      const serverData = await query(
        `SELECT * FROM ${table_name} WHERE client_id = $1`,
        [client_id]
      );

      res.json({
        success: true,
        version: serverData.rows[0]?.version || 1,
        data: serverData.rows[0],
        message: "Use server data",
      });
    } else {
      res.json({
        success: true,
        version: 1,
        message: "Conflict marked for manual resolution",
      });
    }
  } catch (error) {
    console.error("Resolve conflict error:", error);
    res.status(500).json({
      success: false,
      error: "Gagal menyelesaikan konflik",
    });
  }
}

module.exports = {
  pushChanges,
  pullChanges,
  getStatus,
  resolveConflict,
};
