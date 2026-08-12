# Panduan Bergambar — Deploy ke Vercel + Neon

Versi bergambar dari [`DEPLOY_VERCEL.md`](DEPLOY_VERCEL.md). Screenshot **aplikasi** di
bawah diambil langsung dari build ini (halaman login, dashboard, menu per-peran).

> **Catatan:** Screenshot dashboard **Vercel** dan **Neon** tidak disertakan karena
> keduanya layanan pihak ketiga di luar aplikasi ini. Untuk langkah tersebut, ikuti
> deskripsi teks + "yang harus dicari di layar" — UI kedua layanan itu jarang berubah.

---

## Langkah 1 — Import repo di Vercel

*(Dashboard Vercel — lakukan di [vercel.com](https://vercel.com))*

1. **Add New… → Project.**
2. Pilih repo `Nanonymou/Project-Admin-Center` → **Import**.
3. **Yang harus dicari di layar:** panel *Configure Project* dengan **Framework Preset**
   otomatis terisi **`Next.js`**. Build Command `next build`. Biarkan default.

---

## Langkah 2 — Set `AUTH_SECRET`

*(Masih di layar Configure Project → bagian **Environment Variables**)*

Buat secret dulu di terminal:

```bash
npx auth secret        # atau: openssl rand -base64 32
```

Tambahkan di Vercel:

| Key | Value |
|-----|-------|
| `AUTH_SECRET` | hasil perintah di atas |

Lalu klik **Deploy** dan tunggu selesai.

---

## Langkah 3 — Halaman login muncul

Setelah deploy sukses, buka URL production. Inilah tampilan pertama — **halaman login
NextAuth** dengan pemilih persona:

![Halaman login](screenshots/01-login.png)

Yang perlu diperhatikan:
- Kolom **Email** & **Kata Sandi** (sudah terisi otomatis untuk demo).
- Grid **"Masuk sebagai (demo)"** — enam persona dengan peran masing-masing.
- Kata sandi semua akun demo: **`demo123`** (tertera di bawah tombol).

---

## Langkah 4 — Pilih persona & masuk

Klik salah satu kartu persona; **email otomatis terisi** sesuai persona yang dipilih.
Kartu terpilih ditandai centang & border biru:

![Pilih persona](screenshots/02-pick-persona.png)

Klik **Masuk**. Karena login sungguhan (NextAuth), kredensial divalidasi dan sesi cookie
diterbitkan, lalu diarahkan ke dashboard.

---

## Langkah 5 — Dashboard (Super Admin)

Login sebagai **Super Admin** (Andi Prasetya) menampilkan menu penuh dan **Executive
Dashboard** lintas semua project & lokasi:

![Dashboard Super Admin](screenshots/03-dashboard-superadmin.png)

Perhatikan banner **"Super Admin — Akses penuh"** dan menu kiri yang lengkap
(Executive Dashboard, Dashboard Leader, Dashboard Margin, dst.).

---

## Langkah 6 — Ganti persona / Logout

Klik nama pengguna di kanan atas untuk membuka menu **"Simulasikan sebagai"** (ganti
peran untuk pratinjau) dan tombol **Keluar** (logout NextAuth):

![Menu pengguna](screenshots/04-user-menu.png)

- **Simulasikan sebagai** — mengganti peran yang sedang ditampilkan tanpa logout.
- **Keluar** — mengakhiri sesi dan kembali ke halaman login.

---

## Langkah 7 — Akses per-peran (Site Admin)

Login sebagai **Site Admin — KM22** (Bagas) menunjukkan **menu terbatas** dan hanya data
site-nya sendiri — halaman manajemen/eksekutif otomatis disembunyikan oleh RouteGuard:

![Menu Site Admin](screenshots/05-site-admin-menu.png)

Bandingkan dengan Langkah 5: tidak ada Executive Dashboard, tidak ada grup Master Data —
banner **"Site Admin — hanya melihat data site Anda"** dan scope **1 site**.

---

## Langkah 8 — (Opsional) Sambungkan Neon

*(Dashboard Neon — lakukan di [neon.tech](https://neon.tech))*

1. **New Project** → beri nama, pilih region terdekat.
2. **Yang harus dicari di layar:** panel **Connection Details / Connect**. **Aktifkan
   opsi "Pooled connection"** — host akan mengandung `-pooler`, contoh:

   ```
   postgresql://USER:PASSWORD@ep-xxxx-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```

3. Salin string tersebut (pastikan berakhiran `?sslmode=require`).

---

## Langkah 9 — Set `DATABASE_URL` di Vercel

*(Vercel → Settings → Environment Variables)*

| Key | Value |
|-----|-------|
| `DATABASE_URL` | connection string **pooled** dari Neon |

Lalu **Redeploy** (Deployments → ⋯ → Redeploy).

---

## Langkah 10 — Migrasi & seed (dari lokal)

```bash
git clone https://github.com/Nanonymou/Project-Admin-Center.git
cd Project-Admin-Center && npm install

# buat .env berisi DATABASE_URL Neon, lalu:
npx drizzle-kit migrate     # buat semua tabel
npm run db:seed             # isi data awal
```

Setelah ini, refresh aplikasi — data asli dari Neon tampil menggantikan data tiruan.

---

## Selesai ✅

| Langkah | Hasil |
|---------|-------|
| 1–2 | Repo terimport + `AUTH_SECRET` terpasang |
| 3–7 | App hidup, login nyata, akses per-peran bekerja (data tiruan) |
| 8–10 | Neon tersambung, migrasi + seed, data asli tampil |

Rincian lengkap env, cara kerja koneksi anti-bug, dan troubleshooting ada di
[`DEPLOY_VERCEL.md`](DEPLOY_VERCEL.md).
