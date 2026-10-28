import 'package:flutter/material.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const KelasPlusApp());
}

class KelasPlusApp extends StatelessWidget {
  const KelasPlusApp({super.key});

  @override
  Widget build(BuildContext context) {
    const navy = Color(0xFF172554);
    return MaterialApp(
      title: 'KELAS+',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: navy),
        scaffoldBackgroundColor: const Color(0xFFF5F7FB),
        useMaterial3: true,
        appBarTheme: const AppBarTheme(
          backgroundColor: navy,
          foregroundColor: Colors.white,
          centerTitle: false,
        ),
        cardTheme: CardThemeData(
          elevation: 0,
          color: Colors.white,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(18),
            side: const BorderSide(color: Color(0xFFE5EAF3)),
          ),
        ),
      ),
      home: const MobileWelcomePage(),
    );
  }
}

class MobileWelcomePage extends StatelessWidget {
  const MobileWelcomePage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('KELAS+'),
        actions: const [
          Padding(
            padding: EdgeInsets.only(right: 16),
            child: Center(
              child: Text('MOBILE • STAGING',
                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700)),
            ),
          ),
        ],
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            Container(
              padding: const EdgeInsets.all(22),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF172554), Color(0xFF1D4ED8)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(24),
              ),
              child: const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.school_rounded, color: Colors.white, size: 36),
                  SizedBox(height: 18),
                  Text(
                    'Dari Data Menjadi Aksi',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 24,
                      height: 1.2,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  SizedBox(height: 8),
                  Text(
                    'Satu aplikasi untuk mendukung administrasi, pembelajaran, dan pendampingan siswa.',
                    style: TextStyle(color: Colors.white, height: 1.45),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            const Text(
              'Pilih area kerja',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 12),
            const _RoleCard(
              icon: Icons.admin_panel_settings_rounded,
              title: 'Admin',
              description: 'Pengguna, kelas, siswa, mata pelajaran, dan konfigurasi.',
              status: 'Tahap integrasi',
            ),
            const _RoleCard(
              icon: Icons.insights_rounded,
              title: 'Pimpinan Sekolah',
              description: 'Pemantauan kehadiran, jurnal, laporan, dan tindak lanjut.',
              status: 'Tahap integrasi',
            ),
            const _RoleCard(
              icon: Icons.menu_book_rounded,
              title: 'Guru',
              description: 'Jadwal, absensi, jurnal mengajar, nilai, dan peta belajar.',
              status: 'Tahap integrasi',
            ),
            const SizedBox(height: 18),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: const Color(0xFFFFF7ED),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFFED7AA)),
              ),
              child: const Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.construction_rounded, color: Color(0xFF9A3412)),
                  SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      'Ini adalah kerangka awal di lingkungan staging. Login dan data belum terhubung ke server. Tidak ada perubahan pada website atau data produksi.',
                      style: TextStyle(color: Color(0xFF7C2D12), height: 1.4),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _RoleCard extends StatelessWidget {
  const _RoleCard({
    required this.icon,
    required this.title,
    required this.description,
    required this.status,
  });

  final IconData icon;
  final String title;
  final String description;
  final String status;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: const Color(0xFFEFF6FF),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Icon(icon, color: const Color(0xFF1D4ED8)),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title,
                      style: const TextStyle(fontWeight: FontWeight.w800)),
                  const SizedBox(height: 4),
                  Text(description,
                      style: const TextStyle(color: Color(0xFF64748B), height: 1.35)),
                  const SizedBox(height: 8),
                  Text(status,
                      style: const TextStyle(
                        color: Color(0xFF1D4ED8),
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                      )),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
