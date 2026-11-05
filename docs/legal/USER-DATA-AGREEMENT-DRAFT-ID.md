# DRAFT — PERJANJIAN PENGGUNAAN DATA PENGGUNA KELAS+

> **Status dokumen:** DRAFT INTERNAL — belum menjadi perjanjian yang berlaku. Wajib ditinjau oleh penasihat hukum dan penanggung jawab perlindungan data sebelum dipublikasikan atau diminta untuk disetujui pengguna.
>
> **Versi:** 0.1  
> **Tanggal penyusunan:** 5 November 2026  
> **Pemilik dokumen:** Tim Produk KELAS+  
> **Identitas penyelenggara:** [NAMA BADAN USAHA/PENYELENGGARA], [ALAMAT], [EMAIL PRIVASI], [NOMOR KONTAK]

## 1. Para pihak dan ruang lingkup

Perjanjian ini dimaksudkan untuk mengatur penggunaan data pribadi dan data pendidikan dalam layanan KELAS+ antara:

1. **Penyelenggara KELAS+:** [nama badan hukum atau identitas penyelenggara yang sah], yang menyediakan dan mengoperasikan platform KELAS+; dan
2. **Sekolah/Pelanggan:** satuan pendidikan atau badan/instansi yang berwenang berlangganan dan menggunakan KELAS+ untuk kegiatan pendidikan dan administrasi sekolah.

Guru, pimpinan sekolah, operator, administrator sekolah, dan pengguna lain menggunakan layanan berdasarkan kewenangan yang diberikan oleh Sekolah/Pelanggan serta ketentuan penggunaan KELAS+.

Perjanjian ini berlaku bersama Ketentuan Layanan, Pemberitahuan Privasi, dan kebijakan lain yang secara sah diberitahukan kepada pengguna. Jika terdapat pertentangan, para pihak harus meminta klarifikasi tertulis dan melakukan peninjauan hukum sebelum menerapkan ketentuan yang berdampak pada data pribadi.

## 2. Istilah

- **Data Pribadi:** data tentang orang perseorangan yang teridentifikasi atau dapat diidentifikasi, sesuai hukum yang berlaku.
- **Data Pendidikan:** informasi yang dibuat atau digunakan dalam penyelenggaraan pendidikan, termasuk kelas, kehadiran, penilaian, catatan pembelajaran, dan informasi terkait peserta didik.
- **Data Sekolah:** data yang dimasukkan atau dihasilkan oleh Sekolah/Pelanggan melalui KELAS+.
- **Pengguna:** orang yang memperoleh akun dan hak akses ke KELAS+.
- **Fitur AI:** fitur KELAS+ yang mengirim konteks terbatas dan pertanyaan ke penyedia model AI untuk menghasilkan ringkasan, saran, atau analisis pendukung.
- **Penyedia AI:** pihak ketiga yang menyediakan infrastruktur atau model pemrosesan AI yang digunakan KELAS+.

## 3. Peran dan tanggung jawab para pihak

3.1. Sekolah/Pelanggan bertanggung jawab menentukan tujuan dan dasar kewenangan pemrosesan Data Sekolah yang dimasukkan ke KELAS+, termasuk memastikan bahwa pengumpulan, penggunaan, dan pemberian akses data peserta didik dilakukan secara sah, transparan, proporsional, dan sesuai kewenangan sekolah.

3.2. Penyelenggara KELAS+ bertanggung jawab mengoperasikan layanan sesuai kontrak dan instruksi yang sah dari Sekolah/Pelanggan, menerapkan pengamanan yang wajar, membatasi akses internal, mengelola penyedia layanan pendukung, serta menyediakan mekanisme penanganan permintaan dan insiden data.

3.3. Penetapan apakah Penyelenggara bertindak sebagai pengendali, prosesor, atau memiliki peran berbeda untuk kegiatan pemrosesan tertentu harus ditentukan berdasarkan fakta, tujuan, dan kendali nyata atas pemrosesan, lalu dikonfirmasi dalam kontrak final. Dokumen draft ini tidak menetapkan klasifikasi hukum secara sepihak.

3.4. Pengguna wajib menjaga kerahasiaan kredensial, menggunakan akun sesuai peran, tidak mengakses data di luar kewenangan, dan segera melaporkan dugaan akses atau pengungkapan tanpa izin.

## 4. Jenis data dan tujuan penggunaan

Bergantung pada modul yang diaktifkan dan konfigurasi sekolah, KELAS+ dapat memproses:

- data akun dan identitas pengguna, seperti nama, alamat email, peran, dan status akun;
- data organisasi sekolah, kelas, mata pelajaran, jadwal, dan penugasan;
- data peserta didik yang diperlukan untuk administrasi pendidikan, seperti nama atau nomor internal, kelas, status keaktifan, kehadiran, dan hasil penilaian;
- catatan pembelajaran atau informasi lain yang secara sadar dimasukkan pengguna ke modul terkait;
- data teknis dan keamanan, seperti waktu akses, log aktivitas, alamat IP, user-agent, dan ID permintaan;
- data penggunaan fitur AI, seperti kapabilitas, model, status pemrosesan, serta metrik token jika tersedia.

Data hanya boleh digunakan untuk menyediakan, mengamankan, memelihara, mendukung, dan meningkatkan layanan sesuai instruksi dan dasar pemrosesan yang sah. Data tidak boleh dijual atau digunakan untuk iklan perilaku.

## 5. Penggunaan fitur AI

5.1. Fitur AI bersifat pendukung. Hasil AI bukan keputusan resmi sekolah, bukan diagnosis, dan bukan pengganti penilaian profesional guru atau pimpinan sekolah.

5.2. Pengguna wajib memeriksa relevansi, akurasi, konteks, dan kelayakan setiap keluaran AI sebelum menggunakannya. Keputusan terkait peserta didik tetap berada pada pendidik atau pejabat sekolah yang berwenang.

5.3. Akses AI mengikuti role dan entitlement paket. Secara umum, guru hanya dapat menggunakan konteks kelas atau peserta didik yang berada dalam penugasannya; pimpinan sekolah dan administrator yang berwenang dapat memperoleh ringkasan agregat dalam lingkup sekolah sesuai hak akses.

5.4. Untuk analisis kasus peserta didik, KELAS+ dirancang menggunakan data minimum yang diperlukan, seperti ringkasan kehadiran dan nilai penilaian yang telah dipublikasikan. Kategori yang tidak diperlukan—misalnya alamat, tanggal lahir, profil keluarga, catatan bebas, dan pengenal internal—tidak boleh sengaja dimasukkan ke payload analisis tersebut berdasarkan desain saat ini.

5.5. Sebelum pengiriman ke Penyedia AI, KELAS+ menerapkan pembatasan konteks dan upaya penyamaran data tertentu. Penyamaran berbasis pola bukan jaminan anonimisasi sempurna. Pengguna tidak boleh memasukkan data sensitif atau identitas tambahan yang tidak diperlukan dalam pertanyaan AI.

5.6. Data yang dikirim ke Penyedia AI diproses sesuai konfigurasi layanan dan ketentuan penyedia yang berlaku. Nama penyedia, lokasi pemrosesan, retensi, penggunaan untuk pelatihan model, dan mekanisme penghapusan harus dijelaskan secara spesifik dalam Pemberitahuan Privasi final sebelum fitur diaktifkan untuk penggunaan nyata.

5.7. KELAS+ tidak boleh mengklaim bahwa Penyedia AI tidak menyimpan atau tidak menggunakan data untuk pelatihan sebelum ketentuan tersebut diverifikasi secara kontraktual dan teknis.

## 6. Pembatasan penggunaan

Para pihak dan pengguna dilarang:

- menggunakan data untuk tujuan yang tidak berkaitan dengan layanan atau kewenangan pendidikan;
- mencoba mengidentifikasi kembali data yang telah disamarkan atau mengakali pembatasan tenant dan role;
- mengunggah data pribadi yang tidak diperlukan, termasuk data kesehatan, biometrik, keuangan, atau data keluarga, ke prompt AI;
- menggunakan keluaran AI untuk memberi label merendahkan, mendiskriminasi, menghukum otomatis, atau membuat keputusan berdampak signifikan tanpa pemeriksaan manusia dan dasar yang sah;
- membagikan akun atau mengekspor data kepada pihak yang tidak berwenang.

## 7. Keamanan dan kerahasiaan

Penyelenggara menerapkan pengamanan teknis dan organisasi yang sesuai dengan risiko, yang dapat mencakup kontrol akses berbasis peran dan sekolah, autentikasi, pembatasan akses tenant, pencatatan audit, pengamanan komunikasi, pengelolaan kredensial, pemantauan, dan prosedur penanganan insiden.

Sekolah/Pelanggan wajib mengelola daftar pengguna dan hak akses secara berkala, menonaktifkan akun yang tidak lagi berwenang, dan melaporkan dugaan kompromi akun atau insiden.

Rincian kontrol keamanan internal tidak dimaksudkan untuk dipublikasikan apabila pengungkapannya dapat meningkatkan risiko keamanan.

## 8. Penyedia layanan dan pengungkapan

Penyelenggara dapat menggunakan penyedia infrastruktur, hosting, basis data, pemantauan, dukungan, dan AI yang diperlukan untuk menyediakan layanan. Daftar kategori dan identitas penyedia yang relevan, tujuan, lokasi pemrosesan, serta mekanisme perlindungan harus dicantumkan dalam lampiran atau Pemberitahuan Privasi final.

Pengungkapan kepada pihak lain hanya dilakukan berdasarkan instruksi yang sah, kebutuhan operasional yang dijelaskan, kewajiban hukum, atau dasar lain yang diizinkan hukum. Penyelenggara harus mengatur kewajiban kerahasiaan dan keamanan dengan penyedia yang memproses data atas namanya.

## 9. Hak subjek data dan permintaan

Permintaan akses, koreksi, pembaruan, penarikan persetujuan jika relevan, penghapusan, pembatasan, atau hak lain yang tersedia berdasarkan hukum dapat disampaikan melalui:

- Kontak privasi KELAS+: [EMAIL PRIVASI]
- Kontak resmi Sekolah/Pelanggan: [EMAIL/UNIT SEKOLAH]

Sekolah dan Penyelenggara akan berkoordinasi untuk memverifikasi identitas dan kewenangan pemohon, menentukan pihak yang bertanggung jawab atas permintaan, serta menindaklanjuti sesuai hukum dan kontrak. Tidak semua data dapat langsung dihapus apabila terdapat kewajiban penyimpanan, kebutuhan pembuktian, sengketa, atau dasar hukum lain yang sah; alasan dan batasannya harus dijelaskan kepada pemohon.

## 10. Retensi, pengembalian, dan penghapusan

Masa simpan setiap kategori data harus ditetapkan dalam kebijakan retensi terpisah yang disetujui setelah penilaian kebutuhan pendidikan, kewajiban hukum, keamanan, dan kontrak.

**Tidak ada jangka waktu retensi atau penghapusan otomatis yang ditetapkan oleh draft ini.** Sebelum kebijakan disahkan, Penyelenggara tidak boleh mengaktifkan pekerjaan penghapusan massal berdasarkan asumsi durasi.

Pada berakhirnya layanan, mekanisme ekspor, pengembalian, pembatasan akses, dan penghapusan Data Sekolah harus diatur dalam kontrak final, termasuk pengecualian untuk backup, log keamanan, kewajiban hukum, dan legal hold.

## 11. Insiden keamanan

Pihak yang mengetahui dugaan insiden yang berdampak pada Data Sekolah harus segera memberitahu pihak lain melalui kontak insiden yang ditetapkan, menyampaikan informasi yang tersedia, dan bekerja sama dalam investigasi, mitigasi, dokumentasi, serta pemberitahuan kepada pihak berwenang atau subjek data jika diwajibkan hukum.

Prosedur final harus menetapkan jalur eskalasi, penanggung jawab, tenggat pemberitahuan, dan format laporan. Tenggat yang diwajibkan hukum tidak boleh diganti dengan tenggat internal yang lebih longgar.

## 12. Perubahan dokumen

Perubahan material pada tujuan pemrosesan, kategori data, penyedia AI, lokasi pemrosesan, retensi, atau hak pengguna harus diberitahukan dengan cara yang sesuai dan, jika diwajibkan, memerlukan persetujuan atau dasar pemrosesan baru sebelum diberlakukan.

Versi dokumen, tanggal berlaku, ringkasan perubahan, dan bukti penerimaan pengguna harus dikelola secara konsisten.

## 13. Jangka waktu dan pengakhiran

Perjanjian berlaku setelah ditandatangani atau disetujui secara sah oleh para pihak dan selama layanan digunakan, kecuali ditentukan lain dalam kontrak. Pengakhiran layanan tidak menghapus kewajiban kerahasiaan, keamanan, penyelesaian permintaan subjek data, atau kewajiban penyimpanan yang masih berlaku.

## 14. Hukum dan penyelesaian sengketa

Perjanjian final harus menyebutkan hukum yang berlaku dan mekanisme penyelesaian sengketa yang disepakati para pihak, dengan memperhatikan peraturan Indonesia yang relevan. Klausul ini harus diperiksa oleh penasihat hukum sebelum ditandatangani.

## 15. Persetujuan dan otorisasi

**Untuk Sekolah/Pelanggan**

- Nama sekolah/instansi: [NAMA SEKOLAH]
- Nama pejabat berwenang: [NAMA]
- Jabatan: [JABATAN]
- Dasar kewenangan: [DOKUMEN/KEWENANGAN]
- Tanggal: [TANGGAL]
- Tanda tangan: [TANDA TANGAN]

**Untuk Penyelenggara KELAS+**

- Nama badan/penyelenggara: [IDENTITAS PENYELENGGARA]
- Nama pejabat berwenang: [NAMA]
- Jabatan: [JABATAN]
- Tanggal: [TANGGAL]
- Tanda tangan: [TANDA TANGAN]

---

## Lampiran A — Hal yang wajib dilengkapi sebelum publikasi

- [ ] Identitas hukum dan alamat Penyelenggara KELAS+.
- [ ] Penetapan peran pengendali/prosesor untuk setiap tujuan pemrosesan.
- [ ] Dasar pemrosesan yang sah per kategori data dan kelompok subjek data, termasuk peserta didik anak.
- [ ] Daftar penyedia dan subprosesor, lokasi pemrosesan, serta kontrak pemrosesan.
- [ ] Ketentuan penyedia AI: retensi input/output, pelatihan model, lokasi, transfer lintas negara, dan penghapusan.
- [ ] Jadwal retensi dan prosedur penghapusan yang disetujui.
- [ ] Prosedur permintaan hak subjek data dan verifikasi wali/orang tua bila relevan.
- [ ] Prosedur insiden dan penanggung jawab pemberitahuan.
- [ ] Kontak privasi dan kanal pengaduan.
- [ ] Review hukum, keamanan, dan perwakilan sekolah.
- [ ] Mekanisme versi, persetujuan, dan pencatatan bukti penerimaan.

## Lampiran B — Catatan batas dokumen

Dokumen ini merupakan rancangan operasional untuk pembahasan, bukan nasihat hukum, bukan bukti bahwa semua kontrol telah diimplementasikan, dan bukan pengganti kontrak pemrosesan data atau pemberitahuan privasi yang telah disahkan.
