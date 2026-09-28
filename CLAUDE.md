# NurCakePOS — Claude Code Guide

Aplikasi Point of Sale (POS) untuk toko kue/bakery. Terdiri dari **mobile app** (Expo React Native) dan **sync server** (Express + PostgreSQL).

## Cara Menjalankan

### Mobile App
```bash
npm install
npm start          # Expo dev server
npm run android    # Android
npm run ios        # iOS
```

### Sync Server
```bash
cd server
npm install
node src/scripts/initDb.js   # Inisialisasi DB PostgreSQL (jalankan sekali)
npm run dev                  # Development (nodemon)
npm start                    # Production
```

### Konfigurasi Server URL (Mobile)
Edit `config/sync.config.ts`, sesuaikan `SERVER_URL` dengan IP device:
- Android Emulator: `http://10.0.2.2:3000/api/v1`
- Physical device: `http://<IP-laptop>:3000/api/v1`
- iOS Simulator: `http://localhost:3000/api/v1`

### Environment Server
Copy `server/env.example` ke `server/.env` dan isi variabel DB.

## Arsitektur

```
Mobile App (Expo/React Native)
├── app/                    ← Layar (Expo Router file-based)
├── components/             ← Komponen UI reusable
├── hooks/                  ← Custom hooks data management
├── repositories/           ← Abstraksi akses data (Repository Pattern)
├── services/               ← SyncManager + SyncApiClient
├── database/SQLiteService  ← SQLite singleton (local database)
├── context/DatabaseProvider← React Context: init DB + sync
├── config/sync.config.ts   ← Konfigurasi URL server dan interval
└── types/sync.ts           ← Type definitions sync

Sync Server (Express + PostgreSQL)
└── server/src/
    ├── controllers/        ← authController, syncController, masterController
    ├── middleware/         ← auth.js (API key), errorHandler.js
    ├── models/database.js  ← PostgreSQL connection pool
    ├── routes/             ← auth, sync, master, health
    └── scripts/            ← initDb.js, seedData.js, backup.sh
```

## Screens (Expo Router)

| File | Rute | Fungsi |
|------|------|--------|
| `app/index.tsx` | `/` | Splash screen → redirect ke `/login` |
| `app/login.tsx` | `/login` | Login (mock: admin/admin123) |
| `app/pos.tsx` | `/pos` | POS utama |
| `app/buku-pesanan.tsx` | `/buku-pesanan` | Manajemen pesanan custom |
| `app/lacak-pesanan.tsx` | `/lacak-pesanan` | Tracking pesanan |
| `app/kelola-produk.tsx` | `/kelola-produk` | CRUD produk |
| `app/kelola-harga.tsx` | `/kelola-harga` | CRUD master pricing |
| `app/transaksi.tsx` | `/transaksi` | Riwayat transaksi |
| `app/laporan.tsx` | `/laporan` | Laporan penjualan |

## Database

### SQLite (local, mobile)
Tabel utama:
- `produk`, `kue_ready` — dengan sync columns (`server_id`, `device_id`, `version`, `sync_status`, `deleted_at`)
- `transaksi`, `detail_transaksi`, `pesanan_kue` — data transaksional
- `jenis_kue`, `variasi_kue`, `ukuran_kue`, `kotak_kue`, `aksesoris_kue`, `kategori_produk` — master data (read-only dari server)
- `sync_queue`, `sync_log`, `device_info` — infrastruktur sync

Schema versi ditrack via `AsyncStorage` key `nurcake_db_version`. Increment `SQLiteService.DB_VERSION` saat ada perubahan schema.

### PostgreSQL (server)
Sama seperti SQLite tapi dengan kolom `client_id` (UUID dari device) sebagai referensi. Tabel `processed_batches` untuk idempotency sync.

## Sistem Sync (Offline-First)

1. Setiap operasi write → data disimpan lokal + masuk `sync_queue`
2. `SyncManager` polling server saat online
3. Push: kirim `sync_queue` ke `/api/v1/sync/push` dalam batch
4. Pull: ambil perubahan dari device lain via `/api/v1/sync/pull?since=<timestamp>`
5. Conflict resolution: server menang (server_wins)

**Prioritas sync** (lihat `config/sync.config.ts`):
- `CRITICAL = 4` — transaksi
- `HIGH = 3`, `NORMAL = 2`, `LOW = 1`

## Konvensi Kode

- **Bahasa**: Semua nama variabel, komentar, UI text dalam **Bahasa Indonesia**
- **Database field naming**: camelCase di SQLite (`nomorTransaksi`), snake_case di PostgreSQL (`nomor_transaksi`)
- **ID**: UUID v4 via `react-native-uuid`
- **Soft delete**: gunakan kolom `deleted_at`, jangan hapus permanen
- **Sync status**: `pending` → `synced` | `conflict`

## Tipe Produk di POS

| Tipe | Keterangan |
|------|------------|
| `kue_custom` | Dipesan lewat modal kalkulator harga, masuk buku pesanan |
| `kue_ready` | Stok fisik — dihapus dari DB saat terjual |
| `produk_lainnya` | Produk reguler dengan stok, dikurangi saat transaksi |

## File Penting

- `database/SQLiteService.ts` — semua operasi SQLite, versi DB: `DB_VERSION = 5`
- `services/SyncManager.ts` — orkestrasi sync (polling, push, pull)
- `services/SyncApiClient.ts` — HTTP client ke sync server
- `context/DatabaseProvider.tsx` — inisialisasi DB + SyncManager saat app launch
- `server/src/controllers/syncController.js` — logika push/pull di server

## Hal yang Perlu Diperhatikan

- `SyncManager` menggunakan **singleton** — jangan instantiate baru
- `sqliteService` juga singleton — diakses langsung, bukan via constructor
- Saat reset DB (`resetDatabase()`), seluruh data lokal hilang — hanya untuk development
- Login saat ini masih mock (`admin` / `admin123`) — belum terintegrasi ke server auth
- Server URL di `sync.config.ts` adalah IP **hardcoded** — sesuaikan dengan environment
