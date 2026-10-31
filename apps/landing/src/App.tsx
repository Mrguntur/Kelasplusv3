import { ArrowRight, BookOpenCheck, Building2, ChartNoAxesCombined, CheckCircle2, ClipboardCheck, GraduationCap, Menu, ShieldCheck, Sparkles, Users, X } from 'lucide-react';
import { useState } from 'react';

const features = [
  { icon: ClipboardCheck, title: 'Administrasi lebih tertata', text: 'Kelola data akademik, kelas, kehadiran, dan jurnal pembelajaran dalam alur kerja yang terhubung.' },
  { icon: ChartNoAxesCombined, title: 'Informasi yang mudah dipahami', text: 'Ringkasan dan laporan membantu sekolah melihat kondisi pembelajaran serta menentukan tindak lanjut.' },
  { icon: Users, title: 'Kolaborasi seluruh peran', text: 'Ruang kerja yang disesuaikan untuk Admin, Pimpinan Sekolah, dan Guru.' },
  { icon: Sparkles, title: 'Pendampingan berbantuan AI', text: 'Fitur AI dirancang untuk membantu menemukan informasi dan mendukung pekerjaan sekolah.' },
];

const steps = [
  { number: '01', title: 'Sekolah terhubung', text: 'Data sekolah dan akun pengguna dikelola dalam satu lingkungan kerja.' },
  { number: '02', title: 'Aktivitas tercatat', text: 'Kegiatan akademik, kehadiran, dan jurnal dicatat melalui modul yang saling terhubung.' },
  { number: '03', title: 'Data menjadi aksi', text: 'Ringkasan dan laporan membantu sekolah menentukan langkah pendampingan.' },
];

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="site-shell">
      <header className="site-header">
        <a className="brand" href="#beranda" onClick={closeMenu} aria-label="KELAS+ beranda">
          <span className="brand-mark">K<span>+</span></span>
          <span className="brand-name">KELAS<span>+</span><small>Platform Manajemen Sekolah</small></span>
        </a>
        <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? 'Tutup menu' : 'Buka menu'}>
          {menuOpen ? <X size={21} /> : <Menu size={21} />}
        </button>
        <nav className={menuOpen ? 'main-nav open' : 'main-nav'}>
          <a href="#fitur" onClick={closeMenu}>Fitur</a>
          <a href="#cara-kerja" onClick={closeMenu}>Cara Kerja</a>
          <a href="#tentang" onClick={closeMenu}>Tentang</a>
          <a className="nav-login" href="/app/" onClick={closeMenu}>Masuk Aplikasi <ArrowRight size={16} /></a>
        </nav>
      </header>

      <main>
        <section className="hero" id="beranda">
          <div className="hero-copy">
            <div className="eyebrow"><span className="eyebrow-dot" /> EKOSISTEM DIGITAL SEKOLAH</div>
            <h1>Satu ruang untuk <em>kemajuan</em> sekolah.</h1>
            <p className="hero-lead">KELAS+ menyatukan administrasi sekolah, aktivitas pembelajaran, dan pendampingan siswa agar setiap informasi lebih mudah dikelola dan ditindaklanjuti.</p>
            <div className="hero-actions">
              <a className="button button-primary" href="/app/">Jelajahi Aplikasi <ArrowRight size={17} /></a>
              <a className="button button-quiet" href="#fitur">Kenali KELAS+ <span>↓</span></a>
            </div>
            <div className="hero-proof"><ShieldCheck size={17} /><span>Dibangun dengan perhatian pada keamanan dan tata kelola data sekolah.</span></div>
          </div>
          <div className="hero-visual" aria-label="Ilustrasi ringkasan dashboard sekolah">
            <div className="visual-glow" />
            <div className="dashboard-card">
              <div className="dashboard-top"><div><span className="mini-label">KELAS+ WORKSPACE</span><strong>Ringkasan Sekolah</strong></div><span className="live-dot">●</span></div>
              <div className="welcome-panel"><div><span>Selamat datang di</span><strong>Ruang kerja sekolah</strong><small>Informasi penting dalam satu tampilan.</small></div><div className="welcome-icon"><GraduationCap size={28}/></div></div>
              <div className="stat-grid">
                <div className="stat-card"><span><Users size={15}/></span><small>Data Siswa</small><b>Terpadu</b><i>Data akademik</i></div>
                <div className="stat-card"><span><BookOpenCheck size={15}/></span><small>Pembelajaran</small><b>Terpantau</b><i>Jurnal & penilaian</i></div>
                <div className="stat-card"><span><ClipboardCheck size={15}/></span><small>Kehadiran</small><b>Tercatat</b><i>Rekap kelas</i></div>
                <div className="stat-card"><span><ChartNoAxesCombined size={15}/></span><small>Laporan</small><b>Terarah</b><i>Ringkasan sekolah</i></div>
              </div>
              <div className="dashboard-foot"><span><span className="foot-check"><CheckCircle2 size={13}/></span> Semua modul dalam satu ekosistem</span><span className="foot-brand">KELAS+</span></div>
            </div>
            <div className="float-note"><span className="float-icon"><Building2 size={18}/></span><span><b>Terhubung</b><small>Antar aktivitas sekolah</small></span></div>
            <div className="float-badge"><Sparkles size={15}/> Data menjadi aksi</div>
          </div>
        </section>

        <section className="trust-strip" aria-label="Peran pengguna">
          <span>DIRANCANG UNTUK KOLABORASI</span>
          <div><span><ShieldCheck size={17}/> Admin</span><span><Building2 size={17}/> Pimpinan Sekolah</span><span><GraduationCap size={17}/> Guru</span></div>
        </section>

        <section className="section features-section" id="fitur">
          <div className="section-heading">
            <div className="eyebrow">LEBIH TERHUBUNG, LEBIH TERARAH</div>
            <h2>Fokus pada hal yang<br/><em>paling penting.</em></h2>
            <p>Kurangi pekerjaan yang tersebar. Bangun alur kerja sekolah yang lebih rapi, kolaboratif, dan mudah dipantau.</p>
          </div>
          <div className="feature-grid">
            {features.map(({ icon: Icon, title, text }) => <article className="feature-card" key={title}><span className="feature-icon"><Icon size={21}/></span><h3>{title}</h3><p>{text}</p><span className="feature-arrow"><ArrowRight size={16}/></span></article>)}
          </div>
        </section>

        <section className="workflow-section" id="cara-kerja">
          <div className="workflow-inner">
            <div className="workflow-intro"><div className="eyebrow eyebrow-light">ALUR KERJA TERINTEGRASI</div><h2>Dari data menjadi<br/><em>aksi nyata.</em></h2><p>Informasi sekolah bukan sekadar disimpan. KELAS+ membantu menghubungkan pencatatan, pemantauan, dan tindak lanjut.</p><a href="/app/" className="text-link">Masuk ke ruang kerja <ArrowRight size={16}/></a></div>
            <div className="steps">{steps.map(step => <div className="step" key={step.number}><span>{step.number}</span><div><h3>{step.title}</h3><p>{step.text}</p></div></div>)}</div>
          </div>
        </section>

        <section className="closing-section" id="tentang">
          <div className="closing-icon"><GraduationCap size={25}/></div>
          <div><div className="eyebrow">KELAS+ PLATFORM SEKOLAH</div><h2>Mulai dari pengelolaan yang lebih baik.</h2><p>Bangun pengalaman kerja sekolah yang lebih terstruktur bersama KELAS+.</p></div>
          <a href="/app/" className="button button-primary">Buka Aplikasi <ArrowRight size={17}/></a>
        </section>
      </main>

      <footer className="site-footer"><a className="footer-brand" href="#beranda">KELAS<span>+</span></a><span>© {new Date().getFullYear()} KELAS+. Ruang kerja digital untuk sekolah.</span><a href="/app/">Masuk aplikasi <ArrowRight size={14}/></a></footer>
    </div>
  );
}
