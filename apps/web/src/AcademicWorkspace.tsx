import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Plus, Search, Users, GraduationCap, RefreshCw } from 'lucide-react';
import { api } from './api';
import ClassEnrollmentManager from './ClassEnrollmentManager';
import ClassAttendanceManager from './ClassAttendanceManager';
import AcademicTermManager from './AcademicTermManager';
import TeachingJournalManager from './TeachingJournalManager';
import AssessmentManager from './AssessmentManager';
import AcademicReportManager from './AcademicReportManager';

type Student = {
  id: string; studentNumber: string | null; fullName: string;
  preferredName: string | null; status: string; createdAt: string;
};
type AcademicClass = {
  id: string; name: string; gradeLevel: number; status: string;
  academicYear?: { id: string; name: string; status: string };
  homeroomStaff?: { displayName: string } | null;
  _count?: { enrollments: number };
};
type AcademicYear = { id: string; name: string; status: string; startDate?: string; endDate?: string };
type Tab = 'students' | 'classes' | 'years' | 'journals' | 'assessments' | 'reports';

export default function AcademicWorkspace({ role }: { role: string }) {
  const canManage = role === 'SCHOOL_ADMIN' || role === 'SCHOOL_LEADER';
  const canViewReports = canManage || role === 'TEACHER';
  const [tab, setTab] = useState<Tab>('students');
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<AcademicClass[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [studentNumber, setStudentNumber] = useState('');
  const [fullName, setFullName] = useState('');
  const [preferredName, setPreferredName] = useState('');
  const [className, setClassName] = useState('');
  const [gradeLevel, setGradeLevel] = useState('7');
  const [academicYearId, setAcademicYearId] = useState('');
  const [yearName, setYearName] = useState('');
  const [yearStart, setYearStart] = useState('2026-07-01');
  const [yearEnd, setYearEnd] = useState('2027-06-30');
  const [yearStatus, setYearStatus] = useState<'PLANNED' | 'ACTIVE' | 'COMPLETED'>('PLANNED');
  const [selectedClass, setSelectedClass] = useState<AcademicClass | null>(null);
  const [selectedYear, setSelectedYear] = useState<AcademicYear | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [studentData, classData, yearData] = await Promise.all([
        api<Student[]>('/academic/students'),
        api<AcademicClass[]>('/academic/classes'),
        api<AcademicYear[]>('/academic/years'),
      ]);
      setStudents(studentData); setClasses(classData); setYears(yearData);
      const active = yearData.find(y => y.status === 'ACTIVE');
      if (active) setAcademicYearId(current => current || active.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Data akademik belum dapat dimuat.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function createYear(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(''); setNotice('');
    try {
      await api<AcademicYear>('/academic/years', { method: 'POST', body: JSON.stringify({ name: yearName.trim(), startDate: yearStart, endDate: yearEnd, status: yearStatus }) });
      setYearName(''); setShowForm(false); setNotice('Tahun ajaran berhasil ditambahkan.'); await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Tahun ajaran belum dapat disimpan.'); }
    finally { setSaving(false); }
  }

  async function createStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(''); setNotice('');
    try {
      await api<Student>('/academic/students', {
        method: 'POST',
        body: JSON.stringify({
          fullName: fullName.trim(),
          ...(studentNumber.trim() ? { studentNumber: studentNumber.trim() } : {}),
          ...(preferredName.trim() ? { preferredName: preferredName.trim() } : {}),
        }),
      });
      setFullName(''); setStudentNumber(''); setPreferredName(''); setShowForm(false);
      setNotice('Data siswa berhasil ditambahkan.'); await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Siswa belum dapat disimpan.'); }
    finally { setSaving(false); }
  }

  async function createClass(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(''); setNotice('');
    try {
      await api<AcademicClass>('/academic/classes', {
        method: 'POST',
        body: JSON.stringify({ name: className.trim(), gradeLevel: Number(gradeLevel), academicYearId }),
      });
      setClassName(''); setShowForm(false); setNotice('Kelas berhasil ditambahkan.'); await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Kelas belum dapat disimpan.'); }
    finally { setSaving(false); }
  }

  const filteredStudents = students.filter(s => [s.fullName, s.preferredName ?? '', s.studentNumber ?? ''].some(v => v.toLowerCase().includes(search.toLowerCase())));
  const filteredClasses = classes.filter(c => [c.name, c.academicYear?.name ?? '', String(c.gradeLevel)].some(v => v.toLowerCase().includes(search.toLowerCase())));
  const filteredYears = years.filter(y => [y.name, y.status].some(v => v.toLowerCase().includes(search.toLowerCase())));

  return <section className="academic-workspace">
    <div className="page-heading academic-page-heading"><div><span className="eyebrow">PENGELOLAAN AKADEMIK</span><h1>{tab==='journals'?'Jurnal mengajar':tab==='assessments'?'Penilaian akademik':tab==='reports'?'Laporan akademik':'Data siswa & kelas'}</h1><p>{tab==='journals'?'Catat kegiatan pembelajaran dan pantau pengiriman jurnal sesuai peran.':tab==='assessments'?'Kelola penilaian dan nilai siswa berdasarkan penugasan mengajar.':tab==='reports'?'Cetak rekap presensi dan hasil penilaian untuk kelas yang dapat Anda akses.':'Kelola data akademik sekolah aktif dengan akses sesuai peran.'}</p></div><button className="secondary-button refresh-data" onClick={() => void load()} disabled={loading}><RefreshCw size={16}/> Perbarui</button></div>
    {error && <div className="alert error" role="alert">{error}</div>}{notice && <div className="alert success" role="status">{notice}</div>}
    <div className="academic-stats"><article className="academic-stat"><span className="metric-icon"><GraduationCap size={20}/></span><div><strong>{students.length}</strong><span>Siswa termuat</span></div></article><article className="academic-stat"><span className="metric-icon"><Users size={20}/></span><div><strong>{classes.length}</strong><span>Kelas termuat</span></div></article></div>
    <div className="panel academic-panel">
      <div className="academic-toolbar"><div className="academic-tabs"><button className={tab==='students'?'selected':''} onClick={()=>{setTab('students');setSearch('');setShowForm(false)}}>Siswa</button><button className={tab==='classes'?'selected':''} onClick={()=>{setTab('classes');setSearch('');setShowForm(false);setSelectedClass(null)}}>Kelas</button><button className={tab==='years'?'selected':''} onClick={()=>{setTab('years');setSearch('');setShowForm(false);setSelectedYear(null)}}>Tahun ajaran</button><button className={tab==='journals'?'selected':''} onClick={()=>{setTab('journals');setSearch('');setShowForm(false)}}>Jurnal mengajar</button><button className={tab==='assessments'?'selected':''} onClick={()=>{setTab('assessments');setSearch('');setShowForm(false)}}>Penilaian</button>{canViewReports && <button className={tab==='reports'?'selected':''} onClick={()=>{setTab('reports');setSearch('');setShowForm(false)}}>Laporan</button>}</div>{tab !== 'journals' && tab !== 'assessments' && tab !== 'reports' && <label className="academic-search"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder={tab==='students'?'Cari nama atau NIS…':tab==='classes'?'Cari nama kelas…':'Cari tahun ajaran…'}/></label>}{tab !== 'journals' && tab !== 'assessments' && tab !== 'reports' && <button className="primary-button compact-button" disabled={!canManage || loading} onClick={()=>setShowForm(v=>!v)}><Plus size={16}/>{tab==='students'?'Tambah siswa':tab==='classes'?'Tambah kelas':'Tambah tahun ajaran'}</button>}</div>
      {!canManage && <p className="muted role-note">Akun Anda memiliki akses baca. Penambahan data hanya tersedia bagi administrator atau pimpinan sekolah.</p>}
      {showForm && canManage && tab==='students' && <form className="academic-form" onSubmit={createStudent}><h3>Tambah siswa</h3><label>Nama lengkap *<input required minLength={2} maxLength={200} value={fullName} onChange={e=>setFullName(e.target.value)} placeholder="Nama lengkap siswa"/></label><label>Nomor induk siswa<input maxLength={60} value={studentNumber} onChange={e=>setStudentNumber(e.target.value)} placeholder="Opsional"/></label><label>Nama panggilan<input maxLength={100} value={preferredName} onChange={e=>setPreferredName(e.target.value)} placeholder="Opsional"/></label><div className="form-actions"><button type="button" className="secondary-button" onClick={()=>setShowForm(false)}>Batal</button><button className="primary-button" disabled={saving}>{saving?'Menyimpan…':'Simpan siswa'}</button></div></form>}
      {showForm && canManage && tab==='years' && <form className="academic-form" onSubmit={createYear}><h3>Tambah tahun ajaran</h3><label>Nama tahun ajaran *<input required minLength={4} maxLength={40} value={yearName} onChange={e=>setYearName(e.target.value)} placeholder="Contoh: 2026/2027"/></label><label>Status awal<select value={yearStatus} onChange={e=>setYearStatus(e.target.value as 'PLANNED'|'ACTIVE'|'COMPLETED')}><option value="PLANNED">Direncanakan</option><option value="ACTIVE">Aktif</option><option value="COMPLETED">Selesai</option></select></label><label>Tanggal mulai *<input required type="date" value={yearStart} onChange={e=>setYearStart(e.target.value)}/></label><label>Tanggal berakhir *<input required type="date" min={yearStart} value={yearEnd} onChange={e=>setYearEnd(e.target.value)}/></label><div className="form-actions"><button type="button" className="secondary-button" onClick={()=>setShowForm(false)}>Batal</button><button className="primary-button" disabled={saving||yearEnd<yearStart}>{saving?'Menyimpan…':'Simpan tahun ajaran'}</button></div></form>}
      {showForm && canManage && tab==='classes' && <form className="academic-form" onSubmit={createClass}><h3>Tambah kelas</h3><label>Nama kelas *<input required maxLength={80} value={className} onChange={e=>setClassName(e.target.value)} placeholder="Contoh: VII A"/></label><label>Tingkat kelas<select value={gradeLevel} onChange={e=>setGradeLevel(e.target.value)}>{Array.from({length:12},(_,i)=>i+1).map(n=><option key={n} value={n}>Tingkat {n}</option>)}</select></label><label>Tahun ajaran *<select required value={academicYearId} onChange={e=>setAcademicYearId(e.target.value)}><option value="">Pilih tahun ajaran</option>{years.map(y=><option key={y.id} value={y.id}>{y.name}{y.status==='ACTIVE'?' · Aktif':''}</option>)}</select></label>{!years.length&&<p className="form-hint">Belum ada tahun ajaran. Buat tahun ajaran terlebih dahulu melalui modul tahun ajaran.</p>}<div className="form-actions"><button type="button" className="secondary-button" onClick={()=>setShowForm(false)}>Batal</button><button className="primary-button" disabled={saving||!academicYearId}>{saving?'Menyimpan…':'Simpan kelas'}</button></div></form>}
      {loading ? <div className="academic-empty">Memuat data akademik…</div> : tab==='students' ? <div className="table-wrap"><table className="academic-table"><thead><tr><th>Nama siswa</th><th>NIS</th><th>Status</th></tr></thead><tbody>{filteredStudents.map(s=><tr key={s.id}><td><strong>{s.fullName}</strong>{s.preferredName&&<span className="table-subtitle">Nama panggilan: {s.preferredName}</span>}</td><td>{s.studentNumber||'—'}</td><td><span className="status-tag">{s.status==='ACTIVE'?'Aktif':s.status}</span></td></tr>)}</tbody></table>{!filteredStudents.length&&<div className="academic-empty">{search?'Tidak ada siswa yang cocok dengan pencarian.':'Belum ada data siswa.'}</div>}</div> : tab==='classes' ? selectedClass ? <><ClassEnrollmentManager schoolClass={selectedClass} students={students} canManage={canManage} onBack={()=>setSelectedClass(null)} onRefresh={load}/><ClassAttendanceManager classId={selectedClass.id} canManage={canManage}/></> : <div className="table-wrap"><table className="academic-table"><thead><tr><th>Nama kelas</th><th>Tingkat</th><th>Tahun ajaran</th><th>Jumlah siswa</th><th></th></tr></thead><tbody>{filteredClasses.map(c=><tr key={c.id}><td><strong>{c.name}</strong><span className="table-subtitle">{c.homeroomStaff?.displayName??'Wali kelas belum ditetapkan'}</span></td><td>{c.gradeLevel}</td><td>{c.academicYear?.name??'—'}</td><td>{c._count?.enrollments??0}</td><td><button className="table-action" onClick={()=>{setSelectedClass(c);setError('')}}>Kelola siswa</button></td></tr>)}</tbody></table>{!filteredClasses.length&&<div className="academic-empty">{search?'Tidak ada kelas yang cocok dengan pencarian.':'Belum ada data kelas.'}</div>}</div> : tab==='journals' ? <TeachingJournalManager role={role}/>  : tab==='assessments' ? <AssessmentManager role={role}/> : tab==='reports' ? <AcademicReportManager/> : selectedYear ? <AcademicTermManager year={selectedYear} canManage={canManage} onBack={()=>setSelectedYear(null)}/> : <div className="table-wrap"><table className="academic-table"><thead><tr><th>Tahun ajaran</th><th>Status</th><th></th></tr></thead><tbody>{filteredYears.map(y=><tr key={y.id}><td><strong>{y.name}</strong></td><td><span className="status-tag">{y.status==='ACTIVE'?'Aktif':y.status==='PLANNED'?'Direncanakan':'Selesai'}</span></td><td><button className="table-action" onClick={()=>setSelectedYear(y)}>Kelola semester</button></td></tr>)}</tbody></table>{!filteredYears.length&&<div className="academic-empty">{search?'Tidak ada tahun ajaran yang cocok.':'Belum ada tahun ajaran.'}</div>}</div>}
      <div className="table-footer">Data dibatasi sesuai respons API sekolah aktif. {tab==='students'?'Maksimal 200 siswa ditampilkan.':tab==='classes'?'Maksimal 200 kelas ditampilkan.':tab==='years'?'Daftar tahun ajaran sekolah aktif.'  :tab==='journals'?'Jurnal mengajar.':tab==='assessments'?'Penilaian akademik.':'Laporan akademik.'}</div>
    </div>
  </section>;
}
