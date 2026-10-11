# KELAS+ Backend

## Setup lokal
1. Gunakan Node.js 20 LTS atau lebih baru.
2. Jalankan `npm install`.
3. Salin `.env.example` menjadi `.env`.
4. Ganti `INITIAL_ADMIN_USERNAME` dan `INITIAL_ADMIN_PASSWORD` dengan kredensial unik; password awal minimal 12 karakter. Lakukan sebelum menjalankan server pertama kali.
5. Jalankan `npm run dev`.
6. API health check: http://localhost:5000/api/health; frontend: http://localhost:5173.

Akun admin hanya dibuat saat tabel users masih kosong dan variabel awal valid. Jangan commit `.env` atau file SQLite.

## Keamanan
Password di-hash menggunakan Node scrypt. Sesi memakai token acak HttpOnly dengan hash token disimpan di SQLite. Endpoint bootstrap dan mutasi data membutuhkan sesi; rute manajemen admin memeriksa peran di server. Kunci Gemini hanya dibaca dari `GEMINI_API_KEY` pada server. Produksi wajib memakai HTTPS, FRONTEND_ORIGIN harus origin deployment yang tepat, gunakan password unik, backup database, dan monitoring.

SQLite cocok untuk satu instance aplikasi. Deployment multi-instance sebaiknya memakai database dan session store bersama. Endpoint backend awal mencakup autentikasi, bootstrap, pembuatan guru/kelas/siswa, presensi, jurnal, AI server-side, dan sebagian rute ubah/nonaktifkan data. Integrasi penuh UI dan pengujian deployment tetap perlu diverifikasi.
