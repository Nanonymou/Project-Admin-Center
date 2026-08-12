# Project Admin Center

Dashboard admin multi-site (Next.js 15 App Router · React 19 · TypeScript · Tailwind · Drizzle ORM + PostgreSQL). Arsitektur **frontend-first / config-driven**: setiap halaman dan endpoint API punya *fallback* ke data konfigurasi, sehingga aplikasi tetap merespons **meski tanpa database**.

## Menjalankan lokal

```bash
npm install
npm run dev        # http://localhost:3000
```

Aplikasi langsung jalan dengan data tiruan — tanpa perlu database.

## Deploy ke Vercel

Aplikasi ini bisa **langsung di-deploy ke Vercel tanpa perubahan** — akan build dan hidup dengan data tiruan.

1. **Import** repository ini di Vercel dan pilih branch `main`. Framework preset **Next.js** terdeteksi otomatis (build command `next build`, tidak perlu `vercel.json`).
2. **Deploy.** Selesai.

DB client bersifat *lazy*, jadi `next build` tidak menyentuh database dan tidak butuh env apa pun saat build.

### Mengaktifkan Neon (opsional, untuk data asli)

Saat di-deploy ke Vercel, database production memakai **[Neon](https://neon.tech)** (PostgreSQL serverless). Koneksi dikonfigurasi otomatis dari URL — **tidak perlu utak-atik kode**:

- **SSL** dinyalakan otomatis untuk host non-localhost (Neon mewajibkan TLS).
- **Connection pooled** (host Neon mengandung `-pooler`, di belakang PgBouncer) terdeteksi otomatis dan *prepared statements* dimatikan, agar tidak muncul error `prepared statement ... does not exist`.

Langkah:

1. Buat project di Neon, salin **connection string pooled** dari dashboard (formatnya di `.env.example`).
2. Set Environment Variable di Vercel: `DATABASE_URL` = connection string pooled tadi (mengandung `-pooler` dan `?sslmode=require`).
3. Terapkan migrasi & seed sekali (lokal/CI, dengan `DATABASE_URL` mengarah ke Neon):

   ```bash
   npx drizzle-kit migrate    # menerapkan drizzle/0001–00xx
   npm run db:seed            # roles, master data, master locks, contoh transaksi
   ```

Selama `DATABASE_URL` belum diset, aplikasi tetap hidup dengan data tiruan (tidak ada error koneksi).

### Mengubah data tiruan

Data tiruan (dummy) bisa langsung diubah tanpa database:

- **Persona / akun demo** → `src/lib/personas.ts` (edit `PERSONA_SEEDS`).
- **Data master & KPI lainnya** → file-file di `src/lib/mock/` (workspace, site KPI, customer/vendor, dll.).

Ubah nilainya, simpan, dan aplikasi langsung memakai data baru. Saat Neon aktif, data asli dari database menggantikan data tiruan ini.

## Catatan sebelum production

| Hal | Kondisi sekarang | Untuk production |
|-----|------------------|------------------|
| **Autentikasi** | Simulasi persona lewat header `x-persona-id` (bukan login sungguhan) | Pasang auth asli (mis. NextAuth) — logika RBAC & scope sudah siap |
| **`DATABASE_URL`** | Fallback ke `localhost` bila tak diset (aman saat build karena lazy) | Set connection string DB yang sebenarnya |

## Skema database

Skema Drizzle ada di `src/db/schema/`, migrasi ter-generate di `drizzle/`. Perintah berguna:

```bash
npm run db:generate   # generate migrasi dari perubahan skema
npm run db:migrate    # terapkan migrasi
npm run db:push       # push skema langsung (dev)
npm run db:seed       # isi data awal
```

## Struktur singkat

- `src/app/` — halaman (App Router) + route handler API (`src/app/api/`)
- `src/components/` — komponen UI
- `src/lib/mock/` — konfigurasi/data tiruan (sumber *fallback*)
- `src/lib/server/` — service, RBAC, guard
- `src/db/` — skema, repository, seed
