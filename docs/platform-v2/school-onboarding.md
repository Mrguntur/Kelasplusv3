# KELAS+ V2 — Onboarding Sekolah oleh Super Admin

## Alur kerja

1. Super Admin membuat sekolah manual atau menyetujui permohonan pendaftaran publik.
2. Sistem membuat sekolah dengan status `PENDING` dan mencatat registration request sebagai `APPROVED`.
3. Super Admin menetapkan paket yang dipublikasikan dan masa trial.
4. Backend memeriksa subscription/trial serta kuota kursi pengguna sebelum membuat undangan administrator.
5. Administrator menerima email undangan dan membuat akun melalui tautan satu kali pakai.
6. Saat undangan diterima, backend memeriksa kembali trial/langganan dan kuota pengguna di dalam transaksi yang sama, lalu membuat membership serta mengaktifkan sekolah.

Daftar onboarding disimpan di database dan dapat dimuat kembali setelah dashboard ditutup atau direfresh.

## Endpoint platform-admin

- `POST /schools/admin/schools` — membuat sekolah manual dan registration record yang disetujui.
- `GET /schools/admin/onboarding` — menampilkan semua registration record yang disetujui beserta status sekolah, subscription terakhir, dan undangan terakhir.
- `POST /schools/admin/registration-requests/:id/invite-admin` — membuat dan mengirim undangan administrator.

Semua endpoint di atas memerlukan session autentikasi dan `PlatformAdminGuard`.

## Entitlement dan keamanan

- Sekolah tetap `PENDING` sampai administrator menerima undangan.
- Akses pending school hanya diizinkan untuk pemeriksaan kuota pengguna onboarding ketika opsi `allowPendingSchool` diberikan secara eksplisit.
- Undangan administrator hanya dapat dibuat jika trial/langganan masih valid dan kuota pengguna tersedia.
- Pemeriksaan entitlement diulang saat undangan diterima. Pemeriksaan dan pembuatan membership berada dalam transaksi yang mengunci baris sekolah agar dua penerimaan bersamaan tidak melampaui kuota.
- Token undangan mentah tidak disimpan; database menyimpan hash token. Tautan berlaku 24 jam dan hanya dapat dipakai satu kali.
- Jika pengiriman email gagal, undangan yang baru dibuat akan dicabut dan kegagalan dicatat di audit log. Trial yang sudah berhasil dibuat tetap tersimpan; Super Admin dapat mengirim ulang setelah email dikonfigurasi.

## Konfigurasi email

API memerlukan konfigurasi environment berikut:

- `PUBLIC_APP_URL`: base URL frontend aplikasi, termasuk base path `/app/` (contoh lokal: `http://localhost:5173/app/`; contoh produksi: `https://kelasplus.my.id/app/`).
- `RESEND_API_KEY`
- `INVITATION_EMAIL_FROM`

Tautan undangan administrator dibangun relatif terhadap `PUBLIC_APP_URL` dan menggunakan route frontend `/app/invite/accept`.

Gunakan API key khusus environment development/staging. Jangan menaruh key di variabel `VITE_*`, browser, repository, atau percakapan. Jika belum dikonfigurasi, sekolah tetap dapat dibuat dan trial dapat diberikan, tetapi email undangan tidak akan terkirim.

## Pengujian lokal

Gunakan data sintetis dan database lokal. Uji minimal:
- Membuat sekolah dengan slug baru.
- Menolak slug duplikat.
- Menetapkan trial dan mengirim undangan.
- Mencoba undangan tanpa trial valid (harus ditolak).
- Mencoba menerima undangan setelah trial kedaluwarsa (harus ditolak).
- Memastikan kuota pengguna satu kursi tidak dapat dilampaui.
- Memastikan daftar onboarding tetap tampil setelah dashboard direfresh.
