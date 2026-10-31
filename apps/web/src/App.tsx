import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, ArrowRight, BookOpenCheck, Building2, CalendarDays, CheckCircle2, GraduationCap, LogOut, RefreshCw, ShieldCheck, Users, UserRound, BookOpen, ClipboardCheck, Menu, X } from 'lucide-react';
import { api, ApiError, type DashboardSummary, type School, type User } from './api';
import AcademicWorkspace from './AcademicWorkspace';

type ViewState = 'loading' | 'login' | 'school' | 'dashboard';
const roleNames: Record<string, string> = {
  SCHOOL_ADMIN: 'Administrator Sekolah',
  SCHOOL_LEADER: 'Pimpinan Sekolah',
  TEACHER: 'Guru',
  SCHOOL_OPERATOR: 'Operator Sekolah',
};
const roleDescriptions: Record<string, string> = {
  SCHOOL_ADMIN: 'Kelola data inti sekolah dan pantau administrasi akademik.',
  SCHOOL_LEADER: 'Pantau aktivitas pembelajaran dan tindak lanjut sekolah.',
  TEACHER: 'Pantau kelas, presensi, jurnal mengajar, dan penilaian.',
  SCHOOL_OPERATOR: 'Bantu menjaga data dan administrasi sekolah tetap tertata.',
};
const metricLabels: Record<string, string> = {
  activeStudents: 'Siswa aktif', activeClasses: 'Kelas aktif', activeStaff: 'Guru & staf aktif',
  finalizedSessionsThisMonth: 'Presensi selesai bulan ini', submittedJournalsThisMonth: 'Jurnal terkirim bulan ini',
  publishedAssessments: 'Penilaian dipublikasikan', assignedClasses: 'Kelas diampu',
  assignedStudents: 'Siswa dalam kelas', attendanceRate: 'Kehadiran tercatat',
};
const metricIcons = [Users, GraduationCap, UserRound, ClipboardCheck, BookOpenCheck, CheckCircle2];

export default function App() {
  const [view, setView] = useState<ViewState>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [schools, setSchools] = useState<School[]>([]);
  const [school, setSchool] = useState<School | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [activePage, setActivePage] = useState<'dashboard' | 'academic'>('dashboard');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const loadSchools = useCallback(async (activeSchoolId?: string | null) => {
    const items = await api<School[]>('/auth/schools');
    setSchools(items);
    if (!items.length) {
      setSchool(null);
      setView('school');
      setError('Akun ini belum memiliki keanggotaan sekolah aktif. Hubungi administrator platform.');
      return;
    }

    const activeSchool = activeSchoolId ? items.find(item => item.id === activeSchoolId) : undefined;
    if (activeSchool) {
      setSelectedSchoolId(activeSchool.id);
      setSchool(activeSchool);
      const data = await api<DashboardSummary>('/academic/dashboard/summary');
      setSummary(data);
      setView('dashboard');
      return;
    }

    setSchool(null);
    setSummary(null);
    const current = items[0];
    setSelectedSchoolId(current.id);
    setView('school');
  }, []);

  const bootstrap = useCallback(async () => {
    try {
      const response = await api<{ user: User }>('/auth/me');
      setUser(response.user);
      await loadSchools(response.user.activeSchoolId);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setUser(null);
        setView('login');
      } else {
        setError(e instanceof Error ? e.message : 'Sesi belum dapat dipulihkan.');
        setView('login');
      }
    }
  }, [loadSchools]);

  useEffect(() => { void bootstrap(); }, [bootstrap]);

  const activeRole = school?.role ?? '';
  const isTeacher = activeRole === 'TEACHER';
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    return hour < 11 ? 'Selamat pagi' : hour < 15 ? 'Selamat siang' : hour < 18 ? 'Selamat sore' : 'Selamat malam';
  }, []);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const result = await api<{ user: User }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      setUser(result.user);
      await loadSchools(result.user.activeSchoolId);
    } catch (e) { setError(e instanceof Error ? e.message : 'Login gagal.'); }
    finally { setBusy(false); }
  }

  async function chooseSchool(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selectedSchoolId) return;
    setBusy(true); setError('');
    try {
      const selected = await api<School>('/auth/select-school', { method: 'POST', body: JSON.stringify({ schoolId: selectedSchoolId }) });
      setSchool(selected);
      const data = await api<DashboardSummary>('/academic/dashboard/summary');
      setSummary(data);
      setView('dashboard');
    } catch (e) { setError(e instanceof Error ? e.message : 'Sekolah belum dapat dibuka.'); }
    finally { setBusy(false); }
  }

  async function refreshDashboard() {
    setBusy(true); setError('');
    try { setSummary(await api<DashboardSummary>('/academic/dashboard/summary')); setNotice('Data dashboard berhasil diperbarui.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Gagal memperbarui data.'); }
    finally { setBusy(false); }
  }

  async function logout() {
    setBusy(true);
    try { await api<void>('/auth/logout', { method: 'POST' }); }
    catch { /* local session state is cleared even if the network is unavailable */ }
    setUser(null); setSchool(null); setSummary(null); setPassword(''); setError(''); setNotice(''); setView('login'); setBusy(false);
  }

  if (view === 'loading') return <main className="loading-screen"><div className="brand-mark">K+</div><p>Menyiapkan ruang kerja KELAS+…</p></main>;

  if (view === 'login') return <main className="login-layout">
    <section className="login-story">
      <div className="brand-lockup"><div className="brand-mark">K+</div><div><strong>KELAS+</strong><span>PLATFORM V2</span></div></div>
      <div className="story-copy"><span className="eyebrow">RUANG KERJA SEKOLAH TERPADU</span><h1>Data yang tertata.<br/><em>Pembelajaran lebih bermakna.</em></h1><p>Satu ruang kerja untuk mendukung administrasi, memantau proses belajar, dan membantu sekolah mengambil langkah yang tepat.</p></div>
      <div className="story-foot"><ShieldCheck size={17}/> Sistem akses berbasis peran dan sekolah</div>
    </section>
    <section className="login-panel"><div className="login-card">
      <div className="mobile-brand"><div className="brand-mark">K+</div><strong>KELAS+</strong></div>
      <span className="eyebrow">SELAMAT DATANG KEMBALI</span><h2>Masuk ke akun Anda</h2><p className="muted">Gunakan akun Platform V2 untuk melanjutkan.</p>
      {error && <div className="alert error" role="alert">{error}</div>}
      <form onSubmit={handleLogin} className="form-stack">
        <label>Email<div className="input-wrap"><UserRound size={18}/><input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="nama@sekolah.sch.id"/></div></label>
        <label>Kata sandi<div className="input-wrap"><ShieldCheck size={18}/><input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Masukkan kata sandi"/></div></label>
        <button className="primary-button" type="submit" disabled={busy}>{busy ? 'Memeriksa akun…' : 'Masuk ke KELAS+'}<ArrowRight size={18}/></button>
      </form>
      <div className="security-note"><ShieldCheck size={16}/><span>Sesi dilindungi cookie HttpOnly. Jangan bagikan kata sandi Anda.</span></div>
      <p className="version-note">Platform V2 · Lingkungan pengembangan</p>
    </div></section>
  </main>;

  if (view === 'school') return <main className="school-layout">
    <div className="school-card"><div className="brand-lockup"><div className="brand-mark">K+</div><div><strong>KELAS+</strong><span>PLATFORM V2</span></div></div>
      <div className="school-icon"><Building2 size={25}/></div><span className="eyebrow">SATU AKUN, SEKOLAH PILIHAN</span><h1>Pilih sekolah Anda</h1><p className="muted">Hai{user?.displayName ? `, ${user.displayName}` : ''}. Pilih ruang kerja sekolah yang ingin dibuka.</p>
      {error && <div className="alert error" role="alert">{error}</div>}
      {schools.length > 0 ? <form onSubmit={chooseSchool} className="form-stack">
        <label>Sekolah terdaftar<select value={selectedSchoolId} onChange={e=>setSelectedSchoolId(e.target.value)} required>{schools.map(item=><option key={item.id} value={item.id}>{item.name} · {roleNames[item.role] ?? item.role}</option>)}</select></label>
        <button className="primary-button" disabled={busy || !selectedSchoolId}>{busy ? 'Membuka ruang kerja…' : 'Lanjutkan'}<ArrowRight size={18}/></button>
      </form> : <button className="secondary-button" onClick={logout}>Keluar dan kembali</button>}
      <button className="text-button" onClick={logout}>Gunakan akun lain</button>
    </div>
  </main>;

  const metrics = Object.entries(summary?.metrics ?? {});
  const title = roleNames[activeRole] ?? roleNames[summary?.role ?? ''] ?? 'Ruang Kerja Sekolah';
  const subtitle = roleDescriptions[activeRole] ?? 'Ringkasan aktivitas akademik sekolah Anda.';
  return <div className="app-shell">
    <button className={`sidebar-backdrop ${mobileNavOpen ? 'visible' : ''}`} onClick={() => setMobileNavOpen(false)} aria-label="Tutup navigasi" tabIndex={mobileNavOpen ? 0 : -1} /><aside className={`sidebar ${mobileNavOpen ? 'mobile-open' : ''}`}><div className="brand-lockup"><div className="brand-mark">K+</div><div><strong>KELAS+</strong><span>PLATFORM V2</span></div></div>
      <div className="workspace-label">RUANG KERJA</div><button className={`nav-item ${activePage === 'dashboard' ? 'active' : ''}`} onClick={() => { setActivePage('dashboard'); setMobileNavOpen(false); }}><Activity size={18}/> Ringkasan</button><button className={`nav-item ${activePage === 'academic' ? 'active' : ''}`} onClick={() => { setActivePage('academic'); setMobileNavOpen(false); }}><BookOpen size={18}/> Data akademik</button><div className="nav-item disabled-nav" aria-disabled="true"><CalendarDays size={18}/> Aktivitas <span className="soon">SEGERA</span></div>
      <div className="sidebar-bottom"><div className="school-avatar">{(school?.name ?? 'S').slice(0,1).toUpperCase()}</div><div className="school-mini"><strong>{school?.name ?? 'Sekolah aktif'}</strong><span>{roleNames[activeRole] ?? activeRole}</span></div></div>
    </aside>
    <main className="main-content"><header className="topbar"><div><span className="topbar-label">KELAS+ / RINGKASAN</span><div className="topbar-school"><Building2 size={16}/>{school?.name}</div></div><div className="topbar-actions"><button className="mobile-nav-toggle" onClick={() => setMobileNavOpen(open => !open)} aria-label={mobileNavOpen ? 'Tutup navigasi' : 'Buka navigasi'}>{mobileNavOpen ? <X size={19}/> : <Menu size={19}/>}</button><button className="icon-button" onClick={()=>void refreshDashboard()} disabled={busy} aria-label="Perbarui data"><RefreshCw size={17}/></button><div className="user-chip"><div className="user-avatar">{(user?.displayName ?? 'U').slice(0,1).toUpperCase()}</div><div><strong>{user?.displayName}</strong><span>{title}</span></div></div><button className="icon-button" onClick={()=>void logout()} disabled={busy} aria-label="Keluar"><LogOut size={17}/></button></div></header>
      {activePage === 'academic' ? <AcademicWorkspace role={activeRole} /> : <><section className="page-heading"><div><span className="eyebrow">{greeting.toUpperCase()}</span><h1>{isTeacher ? 'Halo, Bapak/Ibu Guru' : 'Ringkasan sekolah'}</h1><p>{subtitle}</p></div><div className="period-pill"><CalendarDays size={16}/>{new Date().toLocaleDateString('id-ID',{month:'long',year:'numeric'})}</div></section>
      {error && <div className="alert error" role="alert">{error}</div>}{notice && <div className="alert success" role="status">{notice}</div>}
      {summary?.activeAcademicYear && <div className="academic-banner"><div className="academic-icon"><BookOpenCheck size={21}/></div><div><span>Tahun ajaran aktif</span><strong>{summary.activeAcademicYear.name}</strong></div><span className="status-badge"><span/>Aktif</span></div>}
      <section className="metrics-grid">{metrics.map(([key,value],index)=>{const Icon=metricIcons[index%metricIcons.length]; const isRate=key==='attendanceRate'; return <article className="metric-card" key={key}><div className="metric-top"><span>{metricLabels[key] ?? key}</span><div className="metric-icon"><Icon size={19}/></div></div><div className="metric-value">{value===null?'—':isRate?`${value}%`:Number(value).toLocaleString('id-ID')}</div><div className="metric-foot">{isRate?'Dari presensi yang tercatat':'Data dari sekolah aktif'}</div></article>})}</section>
      <section className="content-grid"><article className="panel journal-panel"><div className="panel-heading"><div><span className="eyebrow">AKTIVITAS TERBARU</span><h2>Jurnal pembelajaran</h2></div><span className="count-pill">{summary?.recentJournals.length ?? 0} terbaru</span></div>
        {summary?.recentJournals.length ? <div className="journal-list">{summary.recentJournals.map(j=><div className="journal-row" key={j.id}><div className="journal-date">{new Date(j.journalDate).toLocaleDateString('id-ID',{day:'2-digit',month:'short'})}</div><div className="journal-copy"><strong>{j.topic}</strong><span>{j.className} · {j.subjectName}{j.teacherName ? ` · ${j.teacherName}` : ''}</span></div><CheckCircle2 size={18} className="journal-check"/></div>)}</div> : <div className="empty-state"><div className="empty-icon"><BookOpenCheck size={24}/></div><strong>Belum ada jurnal terkirim</strong><p>Jurnal yang sudah dikirim akan muncul di sini.</p></div>}
      </article><article className="panel attendance-panel"><div className="panel-heading"><div><span className="eyebrow">KEHADIRAN</span><h2>Ringkasan presensi</h2></div><div className="attendance-symbol"><Users size={19}/></div></div>
        {summary?.attendance ? <><div className="attendance-total">{Object.values(summary.attendance).reduce((a,b)=>a+b,0).toLocaleString('id-ID')}<span> catatan</span></div><div className="attendance-list">{Object.entries({PRESENT:'Hadir',LATE:'Terlambat',SICK:'Sakit',EXCUSED:'Izin',ABSENT:'Alpa'}).map(([key,label])=><div className="attendance-line" key={key}><span>{label}</span><strong>{summary.attendance?.[key] ?? 0}</strong></div>)}</div><p className="panel-footnote">Menghitung sesi presensi yang telah difinalisasi bulan ini.</p></> : <div className="empty-state compact"><div className="empty-icon"><ClipboardCheck size={22}/></div><strong>Ringkasan khusus guru</strong><p>Gunakan angka kehadiran dan kelas yang ditugaskan pada kartu ringkasan.</p></div>}
      </article></section>
      </>}<footer className="footer"><span>KELAS+ · Platform V2</span><span>Ruang kerja akademik terpadu</span></footer>
    </main>
  </div>;
}