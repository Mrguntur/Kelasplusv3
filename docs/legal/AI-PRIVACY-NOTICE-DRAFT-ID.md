# DRAFT — PEMBERITAHUAN PRIVASI DAN PENGGUNAAN AI KELAS+

> **Status:** DRAFT INTERNAL — belum disahkan atau dipublikasikan. Wajib diverifikasi terhadap implementasi aktual, kontrak penyedia, dan ketentuan hukum Indonesia sebelum ditampilkan kepada pengguna.
>
> **Versi:** 0.1  
> **Tanggal penyusunan:** 5 November 2026  
> **Penyelenggara:** [NAMA BADAN USAHA/PENYELENGGARA KELAS+]  
> **Kontak privasi:** [EMAIL PRIVASI]  
> **Alamat:** [ALAMAT RESMI]

## 1. Ringkasan

KELAS+ adalah platform pengelolaan sekolah yang membantu sekolah mengelola kegiatan administrasi dan pembelajaran. Beberapa fitur menggunakan teknologi kecerdasan buatan (AI) untuk membantu guru dan pimpinan sekolah memahami informasi pendidikan, menyusun pertimbangan, dan memperoleh ringkasan.

Pemberitahuan ini menjelaskan jenis data yang dapat diproses, alasan penggunaannya, bagaimana fitur AI bekerja secara garis besar, batasan penggunaan, pihak yang mungkin menerima data, serta cara mengajukan pertanyaan atau permintaan terkait privasi.

KELAS+ dirancang untuk mendukung keputusan manusia, bukan menggantikan guru atau pimpinan sekolah.

## 2. Siapa yang bertanggung jawab?

KELAS+ dioperasikan oleh **[IDENTITAS HUKUM PENYELENGGARA]**. Sekolah yang berlangganan mengelola akun, menentukan kewenangan pengguna, dan memasukkan data pendidikan sesuai tugas serta kewenangannya.

Pihak yang secara hukum bertindak sebagai pengendali atau prosesor dapat berbeda menurut kegiatan pemrosesan. Pembagian tanggung jawab final akan dijelaskan dalam perjanjian dengan sekolah dan dokumen privasi yang disahkan.

Untuk pertanyaan privasi, hubungi [EMAIL PRIVASI]. Untuk pertanyaan mengenai data sekolah atau koreksi data peserta didik, pengguna juga dapat menghubungi administrator resmi sekolah.

## 3. Data yang dapat diproses

Data yang diproses bergantung pada modul, fitur, dan konfigurasi yang digunakan sekolah. Kategori yang mungkin meliputi:

| Kategori | Contoh | Kegunaan umum |
|---|---|---|
| Akun pengguna | Nama, email, role, status akun | Autentikasi dan pengelolaan akun |
| Organisasi sekolah | Sekolah, kelas, mata pelajaran, jadwal | Menjalankan modul sekolah |
| Data peserta didik | Identitas yang diperlukan sekolah, kelas, status | Administrasi pendidikan |
| Data pembelajaran | Kehadiran, penilaian, jurnal atau catatan yang diinput | Pemantauan pembelajaran |
| Data teknis | Waktu akses, IP, user-agent, request ID | Keamanan, audit, dan pemecahan masalah |
| Data penggunaan AI | Kapabilitas, model, status, metrik token | Menjalankan dan mengawasi fitur AI |

Sekolah harus menghindari memasukkan data yang tidak relevan atau berlebihan. Data khusus atau sensitif harus ditangani dengan dasar dan perlindungan yang sesuai serta tidak boleh dimasukkan ke prompt AI kecuali fitur, tujuan, dan kewenangannya telah dinilai serta disetujui secara khusus.

## 4. Mengapa data digunakan?

Data dapat digunakan untuk:

- menyediakan akun, autentikasi, dan hak akses;
- menjalankan modul administrasi dan pembelajaran yang dipilih sekolah;
- menampilkan informasi kepada pengguna sesuai role dan lingkup sekolah;
- menyediakan bantuan dan analisis AI yang diminta pengguna berwenang;
- menjaga keamanan, mendeteksi penyalahgunaan, dan mencatat aktivitas penting;
- memenuhi kewajiban hukum, menyelesaikan sengketa, dan menangani permintaan pengguna;
- memelihara dan meningkatkan keandalan layanan dengan penggunaan data yang sesuai hukum dan kontrak.

KELAS+ tidak menjual Data Pribadi pengguna atau peserta didik. Data tidak digunakan untuk iklan perilaku.

## 5. Bagaimana fitur AI menggunakan data?

### 5.1 AI untuk guru

Fitur guru dapat membantu menyusun materi, menjawab pertanyaan pembelajaran, dan menganalisis kasus peserta didik sesuai hak akses dan entitlement paket. Konteks kelas dibatasi pada kelas yang ditugaskan kepada guru atau kelas wali yang menjadi tanggung jawabnya.

Untuk analisis kasus peserta didik, implementasi saat ini mengambil ringkasan kehadiran dalam jangka 90 hari dan nilai penilaian yang telah dipublikasikan, dengan batas jumlah data yang diterapkan di layanan. Cakupan nilai dapat dibatasi pada mata pelajaran yang ditugaskan kepada guru atau mencakup mata pelajaran kelas untuk wali kelas.

### 5.2 AI untuk pimpinan sekolah

Fitur pimpinan sekolah dapat menggunakan ringkasan agregat tingkat sekolah, seperti jumlah, rata-rata, atau ringkasan kelas dan mata pelajaran, sesuai hak akses. Ringkasan agregat ditujukan untuk membantu pemantauan dan perencanaan, bukan menetapkan kesimpulan otomatis tentang individu.

### 5.3 Data yang tidak dimaksudkan untuk dikirim dalam analisis kasus

Desain analisis kasus saat ini mengecualikan kategori seperti nama peserta didik, nomor peserta didik, kontak, alamat, tanggal lahir, profil keluarga, catatan bebas, dan ID internal dari konteks terstruktur yang dikirim ke penyedia AI.

KELAS+ juga melakukan upaya penyamaran terhadap identitas tertentu yang mungkin muncul dalam pertanyaan bebas, misalnya nama peserta didik yang dipilih dan pola email atau nomor. **Penyamaran ini tidak menjamin anonimisasi sempurna.** Pengguna tetap harus menulis pertanyaan secara seperlunya dan tidak menambahkan pengenal atau informasi sensitif yang tidak diperlukan.

### 5.4 Penyedia AI

Untuk menghasilkan jawaban, bagian pertanyaan dan konteks yang dipilih dapat dikirim ke penyedia model AI pihak ketiga. Sebelum fitur AI diaktifkan secara umum, KELAS+ harus melengkapi informasi aktual berikut:

- nama badan dan layanan penyedia AI: [NAMA PENYEDIA];
- lokasi pemrosesan dan kemungkinan transfer lintas negara: [LOKASI];
- apakah input/output disimpan dan untuk berapa lama: [KETENTUAN RETENSI];
- apakah data digunakan untuk melatih atau meningkatkan model: [KETENTUAN PELATIHAN];
- mekanisme penghapusan dan permintaan subjek data: [MEKANISME];
- dasar kontraktual dan pengamanan transfer: [RINCIAN].

Informasi tersebut tidak boleh diasumsikan. KELAS+ harus memverifikasinya dari kontrak, dokumentasi, dan pengaturan akun penyedia sebelum membuat pernyataan final.

## 6. Keterbatasan dan penggunaan hasil AI

AI dapat menghasilkan informasi yang tidak lengkap, keliru, bias, atau tidak sesuai konteks. Hasilnya:

- bukan diagnosis medis, psikologis, atau penilaian profesional lain;
- bukan bukti tunggal untuk menilai karakter, kemampuan, atau masa depan peserta didik;
- tidak boleh menjadi satu-satunya dasar untuk sanksi, pengurangan hak, atau keputusan penting terhadap peserta didik;
- harus diperiksa dan diputuskan oleh guru atau pejabat sekolah yang berwenang.

KELAS+ tidak dimaksudkan untuk memberi label negatif atau membuat keputusan pendidikan berdampak signifikan secara otomatis. Pengguna harus mempertimbangkan konteks, memeriksa sumber data, dan mendokumentasikan pertimbangan manusia sesuai kebijakan sekolah.

## 7. Pembatasan akses

KELAS+ menggunakan role dan lingkup sekolah untuk membatasi informasi yang dapat dilihat dan digunakan. Secara umum:

- guru mengakses data kelas atau peserta didik sesuai penugasan dan kewenangannya;
- wali kelas dapat memperoleh konteks kelas yang menjadi tanggung jawabnya;
- pimpinan sekolah memperoleh ringkasan sekolah sesuai hak akses;
- administrator sekolah mengelola akun dan konfigurasi sesuai kewenangan, bukan otomatis memperoleh hak untuk menggunakan semua data untuk tujuan lain;
- administrator platform memiliki akses operasional yang harus dibatasi, dibenarkan, dan dicatat sesuai kebutuhan.

Pengguna tidak boleh membagikan akun atau mencoba mengakses tenant, kelas, atau data di luar kewenangannya.

## 8. Pencatatan audit dan keamanan

KELAS+ mencatat peristiwa tertentu untuk keamanan dan akuntabilitas, termasuk permintaan analisis AI dan status pemrosesannya. Metadata audit dirancang untuk menghindari penyimpanan prompt mentah atau identitas peserta didik dalam catatan audit.

Catatan audit dapat berisi referensi kasus acak, kapabilitas, model, versi kebijakan, kategori data yang diizinkan/dikecualikan, status, waktu, serta informasi aktor atau sekolah yang diperlukan untuk akuntabilitas. Akses ke catatan audit dibatasi.

KELAS+ menerapkan kontrol keamanan sesuai risiko, termasuk pembatasan akses berbasis role dan sekolah, autentikasi, serta pencatatan aktivitas. Rincian teknis dapat berubah seiring pengembangan dan tidak semua kontrol internal dipublikasikan.

## 9. Penyedia layanan dan penerima data

Data dapat diproses oleh penyedia hosting, basis data, autentikasi, pemantauan, dukungan, dan AI yang diperlukan untuk menyediakan layanan. Daftar penyedia, tujuan, lokasi, dan kategori data yang diproses harus ditambahkan pada daftar subprosesor yang dapat diakses sekolah.

Data juga dapat diungkapkan apabila diperlukan berdasarkan kewajiban hukum atau permintaan sah dari otoritas yang berwenang, dengan tetap memperhatikan hukum dan prosedur yang berlaku.

## 10. Retensi dan penghapusan

KELAS+ sedang menetapkan kebijakan retensi per kategori data. **Jangka waktu retensi final belum ditetapkan dalam dokumen ini dan penghapusan otomatis tidak boleh diaktifkan hanya berdasarkan draft ini.**

Kebijakan final harus membedakan data akun, data pendidikan, log audit, metrik penggunaan AI, backup, dan data yang diproses penyedia AI. Kebijakan juga harus menjelaskan kapan data dapat dikembalikan, dihapus, dianonimkan, atau dipertahankan karena kewajiban hukum, sengketa, atau kebutuhan keamanan.

## 11. Hak dan permintaan terkait data

Subjek data atau pihak yang sah mewakilinya dapat mengajukan permintaan yang tersedia berdasarkan hukum, seperti akses, koreksi, pembaruan, penghapusan, penarikan persetujuan jika pemrosesan didasarkan pada persetujuan, atau keberatan/pembatasan jika berlaku.

Permintaan dapat disampaikan melalui [EMAIL PRIVASI] atau melalui kanal resmi sekolah. Kami dapat meminta informasi yang diperlukan untuk memverifikasi identitas dan kewenangan pemohon. Untuk peserta didik anak, prosedur verifikasi orang tua/wali dan kewenangan sekolah harus ditetapkan secara jelas.

Permintaan akan ditangani sesuai hukum, kontrak, dan kewajiban penyimpanan yang berlaku. Jika permintaan tidak dapat dipenuhi seluruhnya, alasan dan langkah yang tersedia akan dijelaskan.

## 12. Privasi anak dan peserta didik

KELAS+ dapat memproses data peserta didik yang sebagian mungkin merupakan anak. Sekolah harus memastikan kewenangan dan dasar pemrosesan yang sesuai, memberikan informasi yang mudah dipahami kepada pihak yang relevan, dan melibatkan orang tua/wali jika diwajibkan.

Penggunaan AI untuk peserta didik harus dibatasi pada tujuan pendidikan yang sah, data minimum, akses berwenang, dan pengawasan manusia. Data anak tidak boleh digunakan untuk profil iklan atau keputusan otomatis yang tidak sesuai hukum.

## 13. Perubahan pemberitahuan

Pemberitahuan ini dapat diperbarui ketika fitur, penyedia, kategori data, tujuan, atau kewajiban hukum berubah. Perubahan material akan diberitahukan melalui [KANAL PEMBERITAHUAN]. Versi dan tanggal berlaku akan dicantumkan. Jika diwajibkan, persetujuan atau dasar pemrosesan baru akan diminta sebelum perubahan diterapkan.

## 14. Kontak dan pengaduan

- Penyelenggara: [IDENTITAS PENYELENGGARA]
- Kontak privasi: [EMAIL PRIVASI]
- Alamat: [ALAMAT]
- Kontak administrator sekolah: [KANAL RESMI SEKOLAH]
- Prosedur pengaduan: [TAUTAN/PROSEDUR]

## 15. Informasi versi

| Versi | Tanggal | Perubahan |
|---|---|---|
| 0.1 | 5 November 2026 | Draft awal untuk review internal |

---

## Checklist sebelum dokumen ini dipublikasikan

- [ ] Cocokkan semua klaim dengan kode dan konfigurasi produksi.
- [ ] Isi identitas hukum, alamat, dan kontak resmi Penyelenggara.
- [ ] Verifikasi penyedia AI, hosting, database, lokasi, retensi, dan pelatihan model.
- [ ] Tentukan dasar pemrosesan dan pembagian peran pengendali/prosesor.
- [ ] Tinjau perlindungan data anak dan prosedur orang tua/wali.
- [ ] Tetapkan jadwal retensi dan penghapusan yang disetujui.
- [ ] Tetapkan daftar subprosesor dan mekanisme transfer data.
- [ ] Uji alur permintaan hak subjek data dan penanganan insiden.
- [ ] Review penasihat hukum dan penanggung jawab privasi.
- [ ] Publikasikan versi final dan mekanisme bukti penerimaan.

> Dokumen ini adalah rancangan transparansi produk, bukan nasihat hukum dan bukan pernyataan bahwa seluruh kontrol atau prosedur yang disebutkan telah aktif di seluruh lingkungan KELAS+.


## Catatan penting verifikasi penyedia Gemini — DRAFT INTERNAL

Persyaratan resmi Gemini API membedakan layanan tidak berbayar dan berbayar. Untuk layanan tidak berbayar, Google menyatakan prompt dan respons dapat digunakan untuk peningkatan/pengembangan produk dan teknologi machine learning serta dapat ditinjau oleh peninjau manusia; Google memperingatkan agar data pribadi, sensitif, atau rahasia tidak dikirim ke layanan tersebut. Untuk layanan berbayar dengan proyek Gemini API yang memiliki billing aktif, Google menyatakan prompt/respons tidak digunakan untuk peningkatan produk dan diproses berdasarkan Data Processing Addendum, tetapi masih terdapat pencatatan terbatas untuk pemantauan penyalahgunaan dan keselamatan layanan.

Persyaratan tambahan Gemini API juga memuat pembatasan usia untuk penggunaan API dalam aplikasi/layanan yang ditujukan kepada atau kemungkinan diakses oleh individu di bawah 18 tahun. Karena KELAS+ merupakan platform pendidikan yang mungkin diakses peserta didik anak, kelayakan penggunaan produk ini harus memperoleh verifikasi tertulis dari penyedia dan review hukum sebelum pemrosesan data peserta didik. Akun AI yang hanya digunakan guru tidak boleh diasumsikan otomatis menyelesaikan pembatasan tersebut.

**Status KELAS+ saat ini: BELUM TERVERIFIKASI.** Belum ada bukti di dokumen ini mengenai jenis produk Google yang dipakai, status billing project, DPA, lokasi pemrosesan, konfigurasi logging, atau persetujuan untuk skenario platform pendidikan. Jangan menyatakan bahwa data tidak digunakan untuk pelatihan atau tidak disimpan sebelum verifikasi selesai. Jangan mengirim data pribadi peserta didik nyata ke Gemini Developer API sampai pemeriksaan ini dituntaskan; gunakan data sintetis.

Referensi resmi untuk pemeriksaan:
- https://ai.google.dev/gemini-api/terms
- https://ai.google.dev/gemini-api/docs/zdr
- https://ai.google.dev/gemini-api/docs/logs-policy
