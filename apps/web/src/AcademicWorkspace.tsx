import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Plus, Search, Users, GraduationCap, RefreshCw } from 'lucide-react';
import { api, ApiError } from './api';

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
type AcademicYear = { id: string; name: string; status: string };
type Tab = 'students' | 'classes';

export default function AcademicWorkspace({ role }: { role: string }) {
  const canManage = role === 'SCHOOL_ADMIN' || role === 'SCHOOL_LEADER';
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

  return <section className="academic-workspace">
    <div className="page-heading academic-page-heading"><div><span className="eyebrow">PENGELOLAAN AKADEMIK</span><h1>Data siswa & kelas</h1><p>Kelola data akademik sekolah aktif dengan akses sesuai peran.</p></div><button className="secondary-button refresh-data" onClick={() => void load()} disabled={loading}><RefreshCw size={16}/> Perbarui</button></div>
    {error && <div className="alert error" role="alert">{error}</div>}{notice && <div className="alert success" role="status">{notice}</div>}
    <div className="academic-stats"><article className="academic-stat"><span className="metric-icon"><GraduationCap size={20}/></span><div><strong>{students.length}</strong><span>Siswa termuat</span></div></article><article className="academic-stat"><span className="metric-icon"><Users size={20}/></span><div><strong>{classes.length}</strong><span>Kelas termuat</span></div></article></div>
    <div className="panel academic-panel">
      <div className="academic-toolbar"><div className="academic-tabs"><button className={tab==='students'?'selected':''} onClick={()=>{setTab('students');setSearch('');setShowForm(false)}}>Siswa</button><button className={tab==='classes'?'selected':''} onClick={()=>{setTab('classes');setSearch('');setShowForm(false)}}>Kelas</button></div><label className="academic-search"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder={tab==='students'?'Cari nama atau NIS…':'Cari nama kelas…'}/></label><button className="primary-button compact-button" disabled={!canManage || loading} onClick={()=>setShowForm(v=>!v)}><Plus size={16}/>{tab==='students'?'Tambah siswa':'Tambah kelas'}</button></div>
      {!canManage && <p className="muted role-note">Akun Anda memiliki akses baca. Penambahan data hanya tersedia bagi administrator atau pimpinan sekolah.</p>}
      {showForm && canManage && tab==='students' && <form className="academic-form" onSubmit={createStudent}><h3>Tambah siswa</h3><label>Nama lengkap *<input required minLength={2} maxLength={200} value={fullName} onChange={e=>setFullName(e.target.value)} placeholder="Nama lengkap siswa"/></label><label>Nomor induk siswa<input maxLength={60} value={studentNumber} onChange={e=>setStudentNumber(e.target.value)} placeholder="Opsional"/></label><label>Nama panggilan<input maxLength={100} value={preferredName} onChange={e=>setPreferredName(e.target.value)} placeholder="Opsional"/></label><div className="form-actions"><button type="button" className="secondary-button" onClick={()=>setShowForm(false)}>Batal</button><button className="primary-button" disabled={saving}>{saving?'Menyimpan…':'Simpan siswa'}</button></div></form>}
      {showForm && canManage && tab==='classes' && <form className="academic-form" onSubmit={createClass}><h3>Tambah kelas</h3><label>Nama kelas *<input required maxLength={80} value={className} onChange={e=>setClassName(e.target.value)} placeholder="Contoh: VII A"/></label><label>Tingkat kelas<select value={gradeLevel} onChange={e=>setGradeLevel(e.target.value)}>{Array.from({length:12},(_,i)=>i+1).map(n=><option key={n} value={n}>Tingkat {n}</option>)}</select></label><label>Tahun ajaran *<select required value={academicYearId} onChange={e=>setAcademicYearId(e.target.value)}><option value="">Pilih tahun ajaran</option>{years.map(y=><option key={y.id} value={y.id}>{y.name}{y.status==='ACTIVE'?' · Aktif':''}</option>)}</select></label>{!years.length&&<p className="form-hint">Belum ada tahun ajaran. Buat tahun ajaran terlebih dahulu melalui modul tahun ajaran.</p>}<div className="form-actions"><button type="button" className="secondary-button" onClick={()=>setShowForm(false)}>Batal</button><button className="primary-button" disabled={saving||!academicYearId}>{saving?'Menyimpan…':'Simpan kelas'}</button></div></form>}
      {loading ? <div className="academic-empty">Memuat data akademik…</div> : tab==='students' ? <div className="table-wrap"><table className="academic-table"><thead><tr><th>Nama siswa</th><th>NIS</th><th>Status</th></tr></thead><tbody>{filteredStudents.map(s=><tr key={s.id}><td><strong>{s.fullName}</strong>{s.preferredName&&<span className="table-subtitle">Nama panggilan: {s.preferredName}</span>}</td><td>{s.studentNumber||'—'}</td><td><span className="status-tag">{s.status==='ACTIVE'?'Aktif':s.status}</span></td></tr>)}</tbody></table>{!filteredStudents.length&&<div className="academic-empty">{search?'Tidak ada siswa yang cocok dengan pencarian.':'Belum ada data siswa.'}</div>}</div> : <div className="table-wrap"><table className="academic-table"><thead><tr><th>Nama kelas</th><th>Tingkat</th><th>Tahun ajaran</th><th>Jumlah siswa</th></tr></thead><tbody>{filteredClasses.map(c=><tr key={c.id}><td><strong>{c.name}</strong><span className="table-subtitle">{c.homeroomStaff?.displayName??'Wali kelas belum ditetapkan'}</span></td><td>{c.gradeLevel}</td><td>{c.academicYear?.name??'—'}</td><td>{c._count?.enrollments??0}</td></tr>)}</tbody></table>{!filteredClasses.length&&<div className="academic-empty">{search?'Tidak ada kelas yang cocok dengan pencarian.':'Belum ada data kelas.'}</div>}</div>}
      <div className="table-footer">Data dibatasi sesuai respons API sekolah aktif. {tab==='students'?'Maksimal 200 siswa ditampilkan.':'Maksimal 200 kelas ditampilkan.'}</div>
    </div>
  </section>;
}
