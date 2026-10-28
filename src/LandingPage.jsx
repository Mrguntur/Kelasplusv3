import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  FileText,
  GraduationCap,
  Menu,
  ShieldCheck,
  Sparkles,
  UsersRound,
  X,
} from 'lucide-react';

const features = [
  {
    icon: CalendarCheck,
    title: 'Absensi lebih praktis',
    description: 'Catat kehadiran kelas dengan alur yang ringkas dan rekap yang mudah ditinjau.',
    tone: 'blue',
  },
  {
    icon: FileText,
    title: 'Jurnal mengajar terarah',
    description: 'Dokumentasikan materi, metode, dan refleksi pembelajaran dalam satu ruang kerja.',
    tone: 'teal',
  },
  {
    icon: BarChart3,
    title: 'Pemetaan belajar siswa',
    description: 'Bantu guru dan pimpinan melihat indikator kehadiran serta perkembangan belajar.',
    tone: 'violet',
  },
  {
    icon: Sparkles,
    title: 'Asisten AI pembelajaran',
    description: 'Dapatkan dukungan untuk merancang ide kegiatan dan rekomendasi pembelajaran.',
    tone: 'amber',
  },
  {
    icon: ClipboardCheck,
    title: 'Laporan lebih tertata',
    description: 'Siapkan rekap yang konsisten untuk mendukung evaluasi dan tindak lanjut.',
    tone: 'rose',
  },
  {
    icon: ShieldCheck,
    title: 'Akses sesuai peran',
    description: 'Pengalaman kerja dirancang berdasarkan kebutuhan guru, pimpinan, dan admin.',
    tone: 'indigo',
  },
];

const toneClasses = {
  blue: 'bg-blue-50 text-blue-700 ring-blue-100',
  teal: 'bg-teal-50 text-teal-700 ring-teal-100',
  violet: 'bg-violet-50 text-violet-700 ring-violet-100',
  amber: 'bg-amber-50 text-amber-700 ring-amber-100',
  rose: 'bg-rose-50 text-rose-700 ring-rose-100',
  indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-100',
};

function Brand({ light = false }) {
  return (
    <a href="#beranda" className={`inline-flex items-center gap-2.5 rounded-xl focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-300 ${light ? 'text-white' : 'text-slate-950'}`} aria-label="KELAS+ beranda">
      <span className="grid h-10 w-10 place-items-center rounded-[14px] bg-gradient-to-br from-teal-400 to-cyan-500 text-sm font-black text-slate-950 shadow-lg shadow-teal-900/10">K+</span>
      <span className="text-[1.35rem] font-black tracking-tight">KELAS<span className="text-teal-500">+</span></span>
    </a>
  );
}

function DashboardPreview() {
  return (
    <div className="relative mx-auto w-full max-w-[610px] pb-7 pt-5 sm:pt-8">
      <div className="absolute -left-2 top-16 h-36 w-36 rounded-full bg-teal-300/30 blur-3xl sm:-left-10" />
      <div className="absolute -right-2 bottom-12 h-40 w-40 rounded-full bg-blue-300/40 blur-3xl sm:-right-8" />

      <div className="relative overflow-hidden rounded-[1.6rem] border border-white/80 bg-white shadow-[0_30px_90px_-35px_rgba(15,23,42,0.42)] ring-1 ring-slate-900/5">
        <div className="flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3.5 sm:px-5">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5" aria-hidden="true">
              <span className="h-2 w-2 rounded-full bg-rose-300" />
              <span className="h-2 w-2 rounded-full bg-amber-300" />
              <span className="h-2 w-2 rounded-full bg-emerald-300" />
            </div>
            <span className="ml-2 text-[11px] font-bold text-slate-500 sm:text-xs">Ringkasan sekolah</span>
          </div>
          <span className="rounded-full bg-teal-50 px-2.5 py-1 text-[9px] font-bold text-teal-700 sm:text-[10px]">Pratinjau UI</span>
        </div>

        <div className="grid grid-cols-[76px_1fr] sm:grid-cols-[128px_1fr]">
          <aside className="min-h-[310px] border-r border-slate-100 bg-slate-50/80 p-2.5 sm:p-4">
            <div className="mb-6 hidden items-center gap-2 sm:flex">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-blue-900 text-[10px] font-black text-white">K+</span>
              <span className="text-[10px] font-extrabold text-slate-800">KELAS+</span>
            </div>
            <div className="space-y-2">
              {[
                ['Ringkasan', true],
                ['Kehadiran', false],
                ['Jurnal', false],
                ['Siswa', false],
                ['Laporan', false],
              ].map(([label, active]) => (
                <div key={label} className={`flex items-center gap-2 rounded-lg px-2 py-2 text-[9px] font-semibold sm:px-2.5 sm:text-[10px] ${active ? 'bg-blue-900 text-white shadow-sm' : 'text-slate-500'}`}>
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${active ? 'bg-teal-300' : 'bg-slate-300'}`} />
                  <span className="truncate">{label}</span>
                </div>
              ))}
            </div>
            <div className="mt-8 hidden rounded-xl border border-slate-200 bg-white p-2.5 sm:block">
              <div className="mb-2 h-2 w-12 rounded bg-slate-200" />
              <div className="h-1.5 w-full rounded bg-slate-100" />
              <div className="mt-1.5 h-1.5 w-3/4 rounded bg-slate-100" />
            </div>
          </aside>

          <div className="min-w-0 p-3 sm:p-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[9px] font-semibold text-slate-400 sm:text-[10px]">Selamat datang di KELAS+</p>
                <h3 className="mt-1 text-sm font-black tracking-tight text-slate-900 sm:text-lg">Ringkasan pembelajaran</h3>
              </div>
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-teal-100 to-blue-100 text-[10px] font-black text-blue-900 sm:h-9 sm:w-9">GA</div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:mt-5 sm:grid-cols-3 sm:gap-3">
              {[
                ['Kehadiran', '96%', 'bg-teal-50 text-teal-700'],
                ['Jurnal', '12', 'bg-blue-50 text-blue-700'],
                ['Perlu tindak lanjut', '3', 'bg-amber-50 text-amber-700'],
              ].map(([label, value, style]) => (
                <div key={label} className="rounded-xl border border-slate-100 bg-white p-2.5 sm:p-3">
                  <span className={`mb-2 inline-flex rounded-lg px-2 py-1 text-[8px] font-bold sm:text-[9px] ${style}`}>{label}</span>
                  <p className="text-lg font-black tracking-tight text-slate-900 sm:text-2xl">{value}</p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${label === 'Kehadiran' ? 'w-[96%] bg-teal-400' : label === 'Jurnal' ? 'w-[70%] bg-blue-400' : 'w-[34%] bg-amber-400'}`} />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 rounded-xl border border-slate-100 bg-white p-3 sm:mt-4 sm:p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] font-extrabold text-slate-800 sm:text-xs">Aktivitas pembelajaran</p>
                  <p className="mt-1 text-[8px] text-slate-400 sm:text-[9px]">Ilustrasi tampilan ringkasan</p>
                </div>
                <span className="rounded-lg bg-slate-50 px-2 py-1 text-[8px] font-bold text-slate-500 sm:text-[9px]">Minggu ini</span>
              </div>
              <div className="mt-4 flex h-16 items-end gap-2 sm:h-20 sm:gap-3">
                {[42, 64, 50, 78, 60, 92, 72, 84, 58, 96, 74, 88].map((height, index) => (
                  <div key={index} className="flex h-full flex-1 items-end">
                    <div className={`w-full rounded-t-md ${index === 9 ? 'bg-teal-500' : 'bg-blue-100'}`} style={{ height: `${height}%` }} />
                  </div>
                ))}
              </div>
              <div className="mt-2 flex justify-between text-[8px] font-medium text-slate-400"><span>Sen</span><span>Sel</span><span>Rab</span><span>Kam</span><span>Jum</span><span>Sab</span></div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute -left-1 bottom-0 flex items-center gap-2 rounded-2xl border border-white bg-white/95 p-3 shadow-xl shadow-slate-900/10 backdrop-blur sm:-left-7 sm:p-3.5">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-teal-50 text-teal-700"><CheckCircle2 className="h-4 w-4" /></span>
        <span><span className="block text-[10px] font-extrabold text-slate-800 sm:text-xs">Lebih terorganisasi</span><span className="mt-0.5 block text-[9px] text-slate-500">Data dalam satu alur kerja</span></span>
      </div>
      <div className="absolute right-0 top-0 flex items-center gap-2 rounded-2xl border border-white bg-white/95 p-3 shadow-xl shadow-slate-900/10 backdrop-blur sm:-right-3 sm:p-3.5">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-50 text-blue-700"><Sparkles className="h-4 w-4" /></span>
        <span><span className="block text-[10px] font-extrabold text-slate-800 sm:text-xs">Dukungan AI</span><span className="mt-0.5 block text-[9px] text-slate-500">Bantu siapkan pembelajaran</span></span>
      </div>
    </div>
  );
}

export default function LandingPage({ onLogin }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const handlePointerDown = event => {
      if (menuRef.current && !menuRef.current.contains(event.target)) setMenuOpen(false);
    };
    const handleEscape = event => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);
  const goToDemo = () => {
    closeMenu();
    document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div id="beranda" className="min-h-screen overflow-hidden bg-white font-sans text-slate-900">
      <div className="relative isolate">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[780px] bg-[radial-gradient(ellipse_at_12%_5%,rgba(153,246,228,0.28),transparent_36%),radial-gradient(ellipse_at_90%_20%,rgba(191,219,254,0.42),transparent_35%),linear-gradient(to_bottom,#f8fbff,white)]" />
        <header className="sticky top-0 z-40 border-b border-white/70 bg-white/85 backdrop-blur-xl">
          <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <Brand />
            <nav className="hidden items-center gap-7 md:flex" aria-label="Navigasi utama">
              <a className="text-sm font-semibold text-slate-600 transition hover:text-blue-900" href="#fitur">Fitur</a>
              <a className="text-sm font-semibold text-slate-600 transition hover:text-blue-900" href="#cara-kerja">Cara Kerja</a>
              <a className="text-sm font-semibold text-slate-600 transition hover:text-blue-900" href="#tentang">Tentang</a>
            </nav>
            <div className="hidden items-center gap-3 md:flex">
              <button type="button" onClick={onLogin} className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-100 focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-200">Masuk</button>
              <button type="button" onClick={goToDemo} className="inline-flex items-center gap-2 rounded-xl bg-blue-950 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-950/15 transition hover:-translate-y-0.5 hover:bg-blue-900 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-200">Lihat Demo <ArrowRight className="h-4 w-4" /></button>
            </div>
            <div className="relative md:hidden" ref={menuRef}>
              <button type="button" aria-label={menuOpen ? 'Tutup navigasi' : 'Buka navigasi'} aria-expanded={menuOpen} onClick={() => setMenuOpen(value => !value)} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-200">
                {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-12 z-50 w-60 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl shadow-slate-900/15">
                  {[
                    ['Fitur', '#fitur'],
                    ['Cara Kerja', '#cara-kerja'],
                    ['Tentang', '#tentang'],
                  ].map(([label, href]) => <a key={href} href={href} onClick={closeMenu} className="block rounded-xl px-3 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">{label}</a>)}
                  <button type="button" onClick={() => { closeMenu(); onLogin(); }} className="mt-1 w-full rounded-xl px-3 py-3 text-left text-sm font-bold text-blue-950 hover:bg-blue-50">Masuk ke KELAS+</button>
                  <button type="button" onClick={goToDemo} className="mt-1 flex w-full items-center justify-between rounded-xl bg-blue-950 px-3 py-3 text-sm font-bold text-white">Lihat Demo <ArrowRight className="h-4 w-4" /></button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main>
          <section className="mx-auto grid max-w-7xl items-center gap-5 px-4 pb-16 pt-12 sm:px-6 sm:pb-20 sm:pt-16 lg:grid-cols-[0.92fr_1.08fr] lg:gap-4 lg:px-8 lg:pb-24 lg:pt-20">
            <div className="relative z-10 mx-auto max-w-xl lg:mx-0">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-teal-100 bg-white/85 px-3.5 py-2 text-[11px] font-bold text-teal-800 shadow-sm sm:text-xs">
                <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-teal-500" /></span>
                Platform digital untuk pembelajaran sekolah
              </div>
              <h1 className="max-w-2xl text-[2.65rem] font-black leading-[1.08] tracking-[-0.055em] text-slate-950 sm:text-5xl lg:text-[3.7rem] xl:text-[4.15rem]">
                Administrasi sekolah lebih <span className="bg-gradient-to-r from-blue-950 via-blue-800 to-teal-600 bg-clip-text text-transparent">terarah.</span>
                <br />Pembelajaran lebih bermakna.
              </h1>
              <p className="mt-6 max-w-lg text-sm leading-7 text-slate-600 sm:text-base sm:leading-8">
                Kelola absensi, jurnal mengajar, pemetaan belajar, dan laporan dalam satu alur kerja yang dirancang untuk membantu sekolah bergerak lebih terorganisasi.
              </p>
              <p className="mt-4 text-sm font-extrabold tracking-wide text-blue-950">Dari Data Menjadi Aksi.</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <button type="button" onClick={onLogin} className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-950 px-6 py-3.5 text-sm font-extrabold text-white shadow-xl shadow-blue-950/20 transition hover:-translate-y-0.5 hover:bg-blue-900 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-200">
                  Masuk ke KELAS+ <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </button>
                <button type="button" onClick={goToDemo} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-6 py-3.5 text-sm font-extrabold text-slate-700 shadow-sm transition hover:border-teal-200 hover:bg-teal-50/60 focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-200">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-teal-50 text-teal-700"><ChevronRight className="h-4 w-4" /></span>
                  Lihat Demo
                </button>
              </div>
              <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3 text-xs font-semibold text-slate-500">
                <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-teal-600" /> Satu ruang kerja</span>
                <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-teal-600" /> Alur yang praktis</span>
                <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-teal-600" /> Dukungan AI</span>
              </div>
            </div>
            <div className="relative mt-4 min-w-0 lg:mt-0">
              <DashboardPreview />
            </div>
          </section>
        </main>
      </div>

      <section id="fitur" className="scroll-mt-24 border-t border-slate-100 bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-extrabold uppercase tracking-[0.2em] text-teal-700">Fitur unggulan</span>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Satu platform untuk kerja sekolah yang lebih tertata</h2>
            <p className="mt-4 text-sm leading-7 text-slate-600 sm:text-base">Fokus pada hal yang dibutuhkan guru dan pimpinan: pencatatan yang rapi, informasi yang mudah ditinjau, dan tindak lanjut yang lebih terarah.</p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:mt-14 lg:grid-cols-3 lg:gap-5">
            {features.map(({ icon: Icon, title, description, tone }) => (
              <article key={title} className="group rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-teal-200 hover:shadow-xl hover:shadow-slate-900/5 sm:p-6">
                <span className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ring-1 ${toneClasses[tone]}`}><Icon className="h-5 w-5" /></span>
                <h3 className="mt-5 text-base font-extrabold text-slate-900">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="demo" className="scroll-mt-24 overflow-hidden bg-slate-950 py-16 text-white sm:py-20">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
          <div>
            <span className="text-xs font-extrabold uppercase tracking-[0.2em] text-teal-300">Lihat cara kerjanya</span>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Dari pencatatan menuju tindak lanjut.</h2>
            <p className="mt-4 text-sm leading-7 text-slate-300 sm:text-base">Lihat ilustrasi antarmuka KELAS+ untuk memahami bagaimana informasi pembelajaran dapat dirangkum dalam satu tampilan.</p>
            <div className="mt-6 space-y-3">
              {['Ringkasan informasi yang mudah ditinjau', 'Alur kerja untuk guru dan pimpinan', 'Dukungan AI sebagai alat bantu'].map(item => <div key={item} className="flex items-start gap-2.5 text-sm text-slate-200"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-300" />{item}</div>)}
            </div>
            <button type="button" onClick={onLogin} className="mt-8 inline-flex items-center gap-2 rounded-xl bg-teal-400 px-5 py-3 text-sm font-extrabold text-slate-950 transition hover:bg-teal-300 focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-200">Masuk ke KELAS+ <ArrowRight className="h-4 w-4" /></button>
          </div>
          <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-2 shadow-2xl shadow-black/20 sm:p-4">
            <div className="rounded-[1.15rem] bg-white p-3 sm:p-5">
              <DashboardPreview />
            </div>
          </div>
        </div>
      </section>

      <section id="cara-kerja" className="scroll-mt-24 bg-slate-50 py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-extrabold uppercase tracking-[0.2em] text-teal-700">Cara kerja</span>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Mudah dipahami, bertahap digunakan</h2>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              ['01', 'Masuk sesuai peran', 'Guru, pimpinan, dan admin melihat ruang kerja sesuai tugasnya.'],
              ['02', 'Kelola aktivitas', 'Catat kehadiran, jurnal, dan informasi pembelajaran melalui menu yang tersedia.'],
              ['03', 'Tinjau dan tindak lanjuti', 'Gunakan ringkasan dan laporan untuk membantu menentukan langkah berikutnya.'],
            ].map(([number, title, description]) => (
              <article key={number} className="rounded-2xl border border-slate-200 bg-white p-6">
                <span className="text-sm font-black tracking-widest text-teal-700">{number}</span>
                <h3 className="mt-3 text-lg font-extrabold text-slate-900">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="tentang" className="scroll-mt-24 bg-white py-14 sm:py-16">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-sm font-extrabold text-blue-950"><GraduationCap className="h-5 w-5 text-teal-600" /> Teknologi yang mendukung pendidikan</div>
            <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Lebih banyak waktu untuk hal yang paling penting: pembelajaran.</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">KELAS+ dirancang untuk membantu administrasi pembelajaran menjadi lebih terorganisasi, sehingga guru dan pimpinan dapat lebih mudah meninjau informasi yang diperlukan.</p>
          </div>
          <button type="button" onClick={onLogin} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-950 px-6 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-blue-950/15 transition hover:bg-blue-900 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-200">Masuk ke KELAS+ <ArrowRight className="h-4 w-4" /></button>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-8 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <div>
            <Brand />
            <p className="mt-2 text-xs text-slate-500">Dari Data Menjadi Aksi.</p>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-slate-500">
            <a href="#fitur" className="hover:text-blue-900">Fitur</a>
            <a href="#cara-kerja" className="hover:text-blue-900">Cara Kerja</a>
            <a href="#tentang" className="hover:text-blue-900">Tentang KELAS+</a>
          </div>
          <p className="text-xs text-slate-400">© {new Date().getFullYear()} KELAS+.</p>
        </div>
      </footer>
    </div>
  );
}
