# KELAS+ Platform V2 — Docker Local Stack

Panduan ini menjalankan database, API, authenticated web workspace, dan public landing page V2 secara lokal menggunakan Docker Desktop. Stack ini terpisah dari aplikasi legacy Firebase di root repository dan tidak mengubah YoHost maupun data produksi.

## Persyaratan

- Windows 10/11 dengan WSL2
- Docker Desktop dengan Linux containers aktif
- Git
- RAM disarankan minimal 8 GB pada PC agar Docker, browser, dan editor dapat berjalan bersamaan
- Node.js lokal tidak wajib untuk menjalankan stack ini; dependency Node dipasang di container

## 1. Ambil branch pengembangan

Dari PowerShell:

```powershell
git fetch origin
git switch feat/platform-v2-docker-local-stack
git pull
```

Jika branch belum ada di PC, clone repository lalu checkout branch tersebut.

## 2. Siapkan environment lokal

Dari root repository:

```powershell
Copy-Item infra/local/.env.example infra/local/.env
```

File `infra/local/.env` diabaikan Git. Biarkan `GEMINI_API_KEY` kosong jika belum ingin menguji AI. Untuk pengujian AI, isi dengan key khusus development/staging, bukan key produksi. Jangan kirim key melalui chat atau commit ke Git.

## 3. Jalankan seluruh stack

Dari root repository:

```powershell
docker compose --env-file infra/local/.env -f infra/local/docker-compose.full.yml up -d
docker compose --env-file infra/local/.env -f infra/local/docker-compose.full.yml ps
```

Pada startup pertama, container API akan memasang dependency, membuat Prisma Client, menjalankan migrasi ke PostgreSQL lokal, lalu menjalankan NestJS. Container web dan landing memasang dependency masing-masing lalu menjalankan Vite.

## 4. Buka aplikasi

| Komponen | Alamat lokal |
| --- | --- |
| Public landing page | http://localhost:5174/ |
| KELAS+ V2 workspace | http://localhost:5173/app/ |
| API health check | http://localhost:3000/api/v1/health |
| PostgreSQL dari PC | localhost:5433 |

Database hanya dipublikasikan pada loopback PC. API, web, dan landing juga hanya dipublikasikan pada loopback PC, bukan ke jaringan publik.

## 5. Lihat log dan status

```powershell
docker compose --env-file infra/local/.env -f infra/local/docker-compose.full.yml ps
docker compose --env-file infra/local/.env -f infra/local/docker-compose.full.yml logs -f api
docker compose --env-file infra/local/.env -f infra/local/docker-compose.full.yml logs -f web
```

Untuk memulai ulang layanan setelah mengubah environment:

```powershell
docker compose --env-file infra/local/.env -f infra/local/docker-compose.full.yml up -d --force-recreate api
```

## 6. Hentikan stack

Perintah ini menghentikan container tetapi mempertahankan volume database:

```powershell
docker compose --env-file infra/local/.env -f infra/local/docker-compose.full.yml down
```

**Jangan gunakan `down -v` kecuali memang ingin menghapus seluruh database dan data uji lokal.** Penghapusan volume bersifat permanen.

## Catatan penting

- Compose ini adalah lingkungan development, bukan konfigurasi produksi.
- Jangan gunakan data siswa sungguhan atau salinan database produksi.
- Jangan expose port database/API ke internet.
- Gemini dan Midtrans tidak diperlukan untuk menyalakan stack; integrasi tersebut hanya aktif jika secret development yang sesuai disediakan.
- Pengiriman undangan email tetap memerlukan konfigurasi provider email yang sesuai. Jangan menganggap email benar-benar terkirim hanya karena endpoint berhasil dijalankan.
- Docker tidak menggantikan pengujian browser lintas perangkat, pengujian keamanan, atau staging publik. Setelah UI dan API stabil, kita tetap perlu staging sebelum rilis.
