import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, Plus, RefreshCw, Users } from 'lucide-react';
import { api } from './api';

type Student = { id: string; studentNumber: string | null; fullName: string; preferredName: string | null; status: string };
type SchoolClass = { id: string; name: string; gradeLevel: number; academicYear?: { name: string } };
type AvailableClass = { id: string; name: string; gradeLevel: number; status?: string; academicYear?: { name: string } };
type Enrollment = { id: string; status: string; student: Student };

export default function ClassEnrollmentManager({ schoolClass, students, canManage, onBack, onRefresh }: {
  schoolClass: SchoolClass;
  students: Student[];
  classes: AvailableClass[];
  canManage: boolean;
  onBack: () => void;
  onRefresh: () => Promise<void>;
}) {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [studentId, setStudentId] = useState('');
  const [targetClassByEnrollment, setTargetClassByEnrollment] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setEnrollments(await api<Enrollment[]>(`/academic/classes/${schoolClass.id}/enrollments`)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Daftar siswa kelas gagal dimuat.'); }
    finally { setLoading(false); }
  }, [schoolClass.id]);

  useEffect(() => { void load(); }, [load]);

  async function addStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!studentId) return;
    setSaving(true); setError(''); setNotice('');
    try {
      await api(`/academic/classes/${schoolClass.id}/enrollments`, { method: 'POST', body: JSON.stringify({ studentId }) });
      setStudentId(''); setNotice('Siswa berhasil ditempatkan di kelas.'); await load(); await onRefresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Penempatan siswa gagal.'); }
    finally { setSaving(false); }
  }

  async function endEnrollment(enrollmentId: string) {
    if (!window.confirm('Keluarkan siswa dari kelas ini? Data siswa dan riwayat akademiknya tetap tersimpan.')) return;
    setSaving(true); setError(''); setNotice('');
    try { await api(`/academic/enrollments/${enrollmentId}/end`, { method: 'PATCH' }); setNotice('Siswa berhasil dikeluarkan dari kelas.'); await load(); await onRefresh(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Penempatan siswa gagal diakhiri.'); }
    finally { setSaving(false); }
  }

  async function transferEnrollment(enrollmentId: string) {
    const targetClassId = targetClassByEnrollment[enrollmentId]; if (!targetClassId) return;
    if (!window.confirm('Pindahkan siswa ke kelas tujuan? Penempatan kelas lama akan disimpan sebagai riwayat.')) return;
    setSaving(true); setError(''); setNotice('');
    try { await api(`/academic/enrollments/${enrollmentId}/transfer`, { method: 'PATCH', body: JSON.stringify({ targetClassId }) }); setNotice('Siswa berhasil dipindahkan ke kelas tujuan.'); await load(); await onRefresh(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Pemindahan siswa gagal.'); }
    finally { setSaving(false); }
  }

  const enrolledIds = new Set(enrollments.map(item => item.student.id));
  const availableStudents = students.filter(student => student.status === 'ACTIVE' && !enrolledIds.has(student.id));

  return <div className="class-detail">
    <div className="class-detail-heading"><div><button className="back-link" onClick={onBack}><ArrowLeft size={15}/> Kembali ke daftar kelas</button><h3>{schoolClass.name}</h3><p>Tingkat {schoolClass.gradeLevel} · {schoolClass.academicYear?.name ?? 'Tahun ajaran belum ditentukan'}</p></div><div className="class-count"><Users size={17}/><strong>{enrollments.length}</strong><span>siswa</span></div></div>
    {error && <div className="alert error" role="alert">{error}</div>}{notice && <div className="alert success" role="status">{notice}</div>}
    {canManage && <form className="enrollment-form" onSubmit={addStudent}><label>Tambahkan siswa ke kelas<select required value={studentId} onChange={e=>setStudentId(e.target.value)}><option value="">Pilih siswa yang belum terdaftar</option>{availableStudents.map(student=><option key={student.id} value={student.id}>{student.fullName}{student.studentNumber ? ` · ${student.studentNumber}` : ''}</option>)}</select></label><button className="primary-button" disabled={saving || !studentId}><Plus size={15}/>{saving ? 'Menyimpan…' : 'Tempatkan siswa'}</button></form>}
    {!canManage && <p className="muted role-note">Akun Anda memiliki akses baca untuk daftar siswa kelas ini.</p>}
    <div className="table-wrap"><table className="academic-table"><thead><tr><th>Nama siswa</th><th>Nomor induk</th><th>Status</th><th>Pengelolaan</th></tr></thead><tbody>{enrollments.map(item=><tr key={item.id}><td><strong>{item.student.fullName}</strong>{item.student.preferredName && <span className="table-subtitle">Nama panggilan: {item.student.preferredName}</span>}</td><td>{item.student.studentNumber || '—'}</td><td><span className="status-tag">{item.status === 'ACTIVE' ? 'Aktif' : item.status}</span></td><td>{canManage && <div className="enrollment-actions"><select aria-label={`Kelas tujuan untuk ${item.student.fullName}`} value={targetClassByEnrollment[item.id] ?? ''} onChange={e=>setTargetClassByEnrollment(current=>({...current,[item.id]:e.target.value}))}><option value="">Pindahkan ke…</option>{classes.filter(c=>c.id!==schoolClass.id && c.status!=='ARCHIVED').map(c=><option key={c.id} value={c.id}>{c.name} · {c.academicYear?.name ?? 'Tahun ajaran'}</option>)}</select><button type="button" className="table-action" disabled={saving||!targetClassByEnrollment[item.id]} onClick={()=>void transferEnrollment(item.id)}>Pindah</button><button type="button" className="table-action" disabled={saving} onClick={()=>void endEnrollment(item.id)}>Keluarkan</button></div>}</td></tr>)}</tbody></table>{loading ? <div className="academic-empty">Memuat daftar siswa…</div> : !enrollments.length ? <div className="academic-empty">Belum ada siswa yang ditempatkan di kelas ini.</div> : null}</div>
    <div className="table-footer"><button className="back-link" onClick={() => void load()} disabled={loading}><RefreshCw size={13}/> Perbarui daftar</button></div>
  </div>;
}
