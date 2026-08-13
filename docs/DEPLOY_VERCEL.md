# Panduan Deploy ke Vercel + Neon (Langkah demi Langkah)

Panduan lengkap men-deploy **Project Admin Center** ke [Vercel](https://vercel.com) dan
menyambungkannya ke database **[Neon](https://neon.tech)** (PostgreSQL serverless).

> **Ringkas:** Aplikasi bisa langsung deploy dengan data tiruan (tanpa database).
> Neon hanya diperlukan bila ingin memakai data asli. Ikuti **Bagian A** untuk deploy
> cepat, lalu **Bagian B** untuk mengaktifkan Neon.
>
> 🖼️ **Versi bergambar (screenshot tiap langkah):** [`DEPLOY_VERCEL_SCREENSHOTS.md`](DEPLOY_VERCEL_SCREENSHOTS.md).

---

## Daftar Isi

- [Prasyarat](#prasyarat)
- [Bagian A — Deploy cepat (data tiruan)](#bagian-a--deploy-cepat-data-tiruan)
- [Bagian B — Sambungkan ke Neon](#bagian-b--sambungkan-ke-neon)
- [Bagian C — Migrasi & seed database](#bagian-c--migrasi--seed-database)
- [Environment Variables (rangkuman)](#environment-variables-rangkuman)
- [Cara kerja koneksi (kenapa anti-bug)](#cara-kerja-koneksi-kenapa-anti-bug)
- [Verifikasi setelah deploy](#verifikasi-setelah-deploy)
- [Troubleshooting](#troubleshooting)
- [Login demo](#login-demo)

---

## Prasyarat

| Kebutuhan | Keterangan |
|-----------|------------|
| Akun **Vercel** | Login dengan GitHub agar bisa import repo langsung |
| Akun **Neon** | Gratis untuk mulai — hanya perlu untuk data asli |
| Repo di GitHub | `Nanonymou/Project-Admin-Center` (branch `main`) |
| Node.js 18+ lokal | Untuk menjalankan migrasi & seed (Bagian C) |

---

## Bagian A — Deploy cepat (data tiruan)

Aplikasi *frontend-first*: setiap halaman & endpoint punya fallback ke data konfigurasi,
jadi bisa hidup tanpa database. `next build` tidak menyentuh database (DB client bersifat
*lazy*), sehingga build tidak butuh env apa pun.

### Langkah

1. **Buka Vercel → Add New… → Project.**
2. **Import** repository `Nanonymou/Project-Admin-Center`.
3. Pada layar konfigurasi:
   - **Framework Preset:** `Next.js` (terdeteksi otomatis).
   - **Build Command:** `next build` (default, biarkan).
   - **Output / Install Command:** biarkan default.
   - **Root Directory:** `./` (biarkan).
4. Buka **Environment Variables** dan tambahkan **satu** variabel wajib:

   | Key | Value |
   |-----|-------|
   | `AUTH_SECRET` | hasil dari `npx auth secret` atau `openssl rand -base64 32` |

   > `AUTH_SECRET` dibutuhkan NextAuth di production. Tanpa ini, login akan error di
   > runtime (walaupun build tetap sukses).

5. Klik **Deploy**. Tunggu hingga selesai.
6. Buka URL production → halaman **login** muncul. Lihat [Login demo](#login-demo).

Selesai. Pada tahap ini aplikasi memakai **data tiruan** dan **login demo** (persona).

---

## Bagian B — Sambungkan ke Neon

### B.1 Buat project & database di Neon

1. Masuk ke [neon.tech](https://neon.tech) → **New Project**.
2. Beri nama (mis. `project-admin-center`), pilih region terdekat (mis. `Singapore`).
3. Neon otomatis membuat database (default `neondb`) dan sebuah *branch* `main`.

### B.2 Ambil connection string **pooled**

1. Di dashboard Neon → **Connection Details** (atau tombol **Connect**).
2. **PENTING:** pilih opsi **Pooled connection** (bukan direct). Host-nya mengandung
   `-pooler`, contoh:

   ```
   postgresql://USER:PASSWORD@ep-cool-name-123456-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```

   > Runtime Vercel bersifat *serverless* (banyak instance singkat). Connection string
   > **pooled** (di belakang PgBouncer) wajib dipakai agar tidak kehabisan koneksi.
   > Aplikasi ini mendeteksi host `-pooler` secara otomatis dan mematikan *prepared
   > statements* supaya tidak muncul error `prepared statement ... does not exist`.

3. Salin string lengkapnya (pastikan ada `?sslmode=require` di ujung).

### B.3 Set `DATABASE_URL` di Vercel

1. Vercel → **Project → Settings → Environment Variables**.
2. Tambahkan:

   | Key | Value | Environment |
   |-----|-------|-------------|
   | `DATABASE_URL` | connection string **pooled** dari B.2 | Production (dan Preview bila perlu) |

3. **Redeploy** agar variabel terbaca: **Deployments → titik tiga → Redeploy**
   (atau push commit baru).

> Aplikasi tidak akan langsung menampilkan data asli sebelum skema & data diisi — lanjut
> ke **Bagian C**.

---

## Bagian C — Migrasi & seed database

Migrasi (membuat tabel) dan seed (mengisi data awal) dijalankan **sekali dari komputer
lokal atau CI**, dengan `DATABASE_URL` mengarah ke Neon.

### C.1 Siapkan lokal

```bash
git clone https://github.com/Nanonymou/Project-Admin-Center.git
cd Project-Admin-Center
npm install
```

Buat file `.env` (jangan di-commit — sudah di-`.gitignore`):

```bash
# .env
DATABASE_URL="postgresql://USER:PASSWORD@ep-...-pooler.REGION.aws.neon.tech/neondb?sslmode=require"
```

> Untuk migrasi, string **pooled** maupun **direct** (tanpa `-pooler`) sama-sama bisa.
> String *direct* sedikit lebih cepat untuk DDL. Untuk runtime Vercel tetap pakai
> **pooled**.

### C.2 Terapkan migrasi

```bash
npx drizzle-kit migrate     # membuat seluruh tabel dari drizzle/0001–00xx
```

### C.3 Isi data awal (seed)

```bash
npm run db:seed             # roles, master data, master locks, contoh transaksi
```

### C.4 Verifikasi

```bash
npx drizzle-kit studio      # buka GUI untuk melihat isi tabel (opsional)
```

Setelah ini, refresh aplikasi di Vercel — endpoint yang punya data DB akan memakai data
asli; sisanya tetap memakai fallback konfigurasi.

---

## Environment Variables (rangkuman)

| Key | Wajib? | Dipakai untuk | Contoh / cara buat |
|-----|--------|---------------|--------------------|
| `AUTH_SECRET` | ✅ di production | Enkripsi sesi NextAuth | `npx auth secret` |
| `DATABASE_URL` | Opsional | Koneksi Neon (data asli). Tanpa ini → data tiruan | string **pooled** dari Neon |
| `DEMO_PASSWORD` | Opsional | Ganti kata sandi login demo (default `demo123`) | `DEMO_PASSWORD="rahasia"` |

> `next build` **tidak** memerlukan satu pun variabel di atas — semua hanya dipakai saat
> runtime. Jadi build tidak akan gagal walau env belum diset.

---

## Cara kerja koneksi (kenapa anti-bug)

Konfigurasi ada di `src/db/index.ts` dan dibaca **otomatis** dari `DATABASE_URL`:

1. **Lazy client** — `postgres()` tidak membuka koneksi sampai query pertama. Maka
   `next build` dan halaman yang tak pernah query tidak menyentuh database.
2. **SSL otomatis** — untuk host non-localhost (seperti Neon) TLS dinyalakan. Neon
   mewajibkan SSL.
3. **Pooled aware** — bila host mengandung `-pooler` (PgBouncer transaction mode),
   *prepared statements* dimatikan. Ini mencegah error umum di serverless:
   `prepared statement "s1" does not exist`.
4. **`max: 1`** — membatasi jumlah koneksi per invocation, cocok dengan model serverless
   Vercel.

Artinya: cukup tempel `DATABASE_URL` pooled dari Neon — tidak perlu mengubah kode.

---

## Verifikasi setelah deploy

- [ ] URL production terbuka dan menampilkan halaman **login**.
- [ ] Bisa login dengan persona demo + kata sandi `demo123`.
- [ ] Setelah login, dashboard tampil; ganti persona di kanan atas mengubah menu & akses.
- [ ] (Jika Neon aktif) data di halaman master sesuai isi database Neon.
- [ ] Logout mengembalikan ke halaman login.

---

## Troubleshooting

| Gejala | Penyebab | Solusi |
|--------|----------|--------|
| Login gagal / error 500 saat submit | `AUTH_SECRET` belum diset di Vercel | Set `AUTH_SECRET`, lalu **Redeploy** |
| `prepared statement ... does not exist` | Pakai connection string **direct** untuk runtime | Ganti `DATABASE_URL` ke string **pooled** (`-pooler`) dan redeploy |
| `no pg_hba.conf entry ... SSL off` / error SSL | SSL tidak aktif | Pastikan URL diakhiri `?sslmode=require` (SSL juga auto-aktif untuk host non-localhost) |
| `too many connections` | Pakai direct connection di serverless | Gunakan string **pooled** dari Neon |
| Data tidak muncul walau Neon aktif | Migrasi/seed belum dijalankan | Jalankan **Bagian C** (migrate + seed) |
| Build gagal karena env | Seharusnya tidak terjadi — build tak butuh env | Cek log build; env hanya dipakai saat runtime |
| Perubahan env tidak berpengaruh | Env dibaca saat build/boot | **Redeploy** setelah mengubah env |

---

## Login demo

Autentikasi memakai **NextAuth (Auth.js)** dengan data pengguna dummy (roster persona).
Di halaman login, pilih persona (email terisi otomatis) dan gunakan kata sandi `demo123`.

| Email | Peran | Akses |
|-------|-------|-------|
| `andi@tpb.co.id` | Super Admin | Semua project & lokasi, semua aksi |
| `randi@tpb.co.id` | Leader Admin | Semua project, kelola & approve |
| `bagas@tpb.co.id` | Site Admin — KM22 | Terbatas ke lokasi KM22 |
| `ika@tpb.co.id` | Site Admin — Pomala | Terbatas ke lokasi Pomala |
| `fajar@tpb.co.id` | Site Admin — Muara Badak | Terbatas ke lokasi Muara Badak |
| `dinda@tpb.co.id` | Viewer | Read-only lintas project |

> Roster ini dummy dan bisa diubah di `src/lib/personas.ts` (`PERSONA_SEEDS`). Untuk
> production sesungguhnya, ganti provider credentials di `src/auth.ts` dengan user +
> password ter-hash dari database.

---

## Ringkasan alur

```
Import repo di Vercel
        │
        ▼
Set AUTH_SECRET  ──►  Deploy  ──►  App hidup (data tiruan) ✅
        │
        ▼ (opsional, untuk data asli)
Buat DB Neon  ──►  Salin string POOLED  ──►  Set DATABASE_URL di Vercel  ──►  Redeploy
        │
        ▼
Lokal: drizzle-kit migrate + npm run db:seed  ──►  Data asli tampil ✅
```
