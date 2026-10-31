import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { CalendarCheck, CheckCircle2, Plus, RefreshCw, Save } from 'lucide-react';
import { api } from './api';

type Student = { id: string; fullName: string; studentNumber: string | null; status: string };
type Enrollment = { id: string; status: string; student: Student };
type AttendanceStatus = 'PRESENT' | 'LATE' | 'SICK' | 'EXCUSED' | 'ABSENT';
type Session = { id: string; date: string; sessionLabel: string; status: string; _count?: { records: number }; records?: { studentId: string; status: AttendanceStatus; note: string | null }[] };

const options: { value: AttendanceStatus; label: string }[] = [
  { value: 'PRESENT', label: 'Hadir' }, { value: 'LATE', label: 'Terlambat' },
  { value: 'SICK', label: 'Sakit' }, { value: 'EXCUSED', label: 'Izin' },
  { value: 'ABSENT', label: 'Alpa' },
];

function sessionDataForSelection(sessions: Session[], id: string) { return sessions.find(session => session.id === id); }

function localDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export default function ClassAttendanceManager({ classId, canManage }: { classId: string; canManage: boolean }) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [selectedSession, setSelectedSession] = useState('');
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [date, setDate] = useState(localDate());
  const [label, setLabel] = useState('REGULAR');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [sessionData, enrollmentData] = await Promise.all([
        api<Session[]>(`/academic/classes/${classId}/attendance-sessions`),
        api<Enrollment[]>(`/academic/classes/${classId}/enrollments`),
      ]);
      setSessions(sessionData);
      setEnrollments(enrollmentData.filter(item => item.status === 'ACTIVE' && item.student.status === 'ACTIVE'));
      setSelectedSession(current => sessionData.some(item => item.id === current) ? current : '');
    } catch (e) { setError(e instanceof Error ? e.message : 'Data presensi gagal dimuat.'); }
    finally { setLoading(false); }
  }, [classId]);

  useEffect(() => { void load(); }, [load]);

  const currentSession = sessions.find(item => item.id === selectedSession);
  const isFinalized = currentSession?.status === 'FINALIZED';

  async function createSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(''); setNotice('');
    try {
      const session = await api<Session>(`/academic/classes/${classId}/attendance-sessions`, {
        method: 'POST', body: JSON.stringify({ date, sessionLabel: label.trim() || 'REGULAR' }),
      });
      await load(); setSelectedSession(session.id);
      setStatuses(Object.fromEntries(enrollments.map(item => [item.student.id, 'PRESENT'])));
      setNotice('Sesi presensi dibuat. Periksa status setiap siswa sebelum menyimpan.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Sesi presensi gagal dibuat.'); }
    finally { setSaving(false); }
  }

  async function saveAttendance() {
    if (!currentSession || !enrollments.length) return;
    setSaving(true); setError(''); setNotice('');
    try {
      await api(`/academic/attendance-sessions/${currentSession.id}/records`, {
        method: 'POST',
        body: JSON.stringify({ records: enrollments.map(item => ({ studentId: item.student.id, status: statuses[item.student.id] ?? 'PRESENT' })) }),
      });
      setNotice('Presensi tersimpan. Anda dapat memfinalisasi setelah memastikan seluruh status benar.');
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Presensi gagal disimpan.'); }
    finally { setSaving(false); }
  }

  async function finalize() {
    if (!currentSession || !window.confirm('Finalisasi presensi? Setelah difinalisasi, status tidak dapat diubah.')) return;
    setSaving(true); setError(''); setNotice('');
    try {
      await api(`/academic/attendance-sessions/${currentSession.id}/finalize`, { method: 'POST' });
      setNotice('Presensi berhasil difinalisasi.'); await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Presensi belum dapat difinalisasi.'); }
    finally { setSaving(false); }
  }

  const totals = options.map(option => ({ ...option, count: enrollments.filter(item => (statuses[item.student.id] ?? 'PRESENT') === option.value).length }));

  return <section className="attendance-manager">
    <div className="attendance-heading"><div><span className="eyebrow">KEHADIRAN SISWA</span><h3><CalendarCheck size={18}/> Presensi kelas</h3><p>Buat sesi, periksa status, simpan, lalu finalisasi presensi.</p></div><button className="secondary-button" onClick={() => void load()} disabled={loading}><RefreshCw size={14}/> Perbarui</button></div>
    {error && <div className="alert error" role="alert">{error}</div>}{notice && <div className="alert success" role="status">{notice}</div>}
    {canManage && <form className="attendance-create-form" onSubmit={createSession}><label>Tanggal<input required type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><label>Jam / label sesi<input maxLength={40} value={label} onChange={e=>setLabel(e.target.value)} placeholder="REGULAR atau Jam 1"/></label><button className="primary-button" disabled={saving || !enrollments.length}><Plus size={15}/>{saving?'Memproses…':'Buat sesi presensi'}</button></form>}
    {!canManage && <p className="muted role-note">Akun ini memiliki akses baca. Pembuatan dan pengisian presensi memerlukan hak pengelolaan.</p>}
    <div className="attendance-session-list"><label>Pilih sesi presensi<select value={selectedSession} onChange={e=>{const id=e.target.value;const session=sessionDataForSelection(sessions,id);setSelectedSession(id);setStatuses(Object.fromEntries(enrollments.map(item=>[item.student.id,session?.records?.find(record=>record.studentId===item.student.id)?.status??'PRESENT'])));setNotice('')}}><option value="">Pilih tanggal dan sesi</option>{sessions.map(session=><option key={session.id} value={session.id}>{new Date(session.date).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'})} · {session.sessionLabel} · {session.status==='FINALIZED'?'Final':'Draft'} ({session._count?.records??0} data)</option>)}</select></label></div>
    {loading ? <div className="academic-empty">Memuat sesi presensi…</div> : !sessions.length ? <div className="academic-empty">Belum ada sesi presensi untuk kelas ini.</div> : currentSession ? <>
      <div className="attendance-summary">{totals.map(item=><div key={item.value}><strong>{item.count}</strong><span>{item.label}</span></div>)}</div>
      <div className="table-wrap"><table className="academic-table attendance-table"><thead><tr><th>Siswa</th><th>Status kehadiran</th></tr></thead><tbody>{enrollments.map(item=><tr key={item.student.id}><td><strong>{item.student.fullName}</strong><span className="table-subtitle">{item.student.studentNumber||'Nomor induk belum diisi'}</span></td><td><select aria-label={`Status kehadiran ${item.student.fullName}`} disabled={!canManage||isFinalized||saving} value={statuses[item.student.id]??'PRESENT'} onChange={e=>setStatuses(current=>({...current,[item.student.id]:e.target.value as AttendanceStatus}))}>{options.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select></td></tr>)}</tbody></table>{!enrollments.length&&<div className="academic-empty">Tempatkan siswa ke kelas sebelum mengisi presensi.</div>}</div>
      <div className="attendance-actions">{!isFinalized && (currentSession?._count?.records??0)>0 && <span className="muted">Status tersimpan telah dimuat. Periksa perubahan sebelum menyimpan ulang.</span>}{isFinalized ? <span className="finalized-note"><CheckCircle2 size={16}/> Presensi sudah final dan terkunci.</span> : canManage ? <><span className="muted">Pastikan status sudah benar sebelum finalisasi.</span><button className="secondary-button" disabled={saving||!enrollments.length||!currentSession?.records} onClick={()=>void saveAttendance()}><Save size={14}/>{saving?'Menyimpan…':'Simpan presensi'}</button><button className="primary-button" disabled={saving||!enrollments.length||(currentSession?._count?.records??0)!==enrollments.length} onClick={()=>void finalize()}><CheckCircle2 size={14}/>{saving?'Memproses…':'Finalisasi'}</button></> : <span className="muted">Mode baca.</span>}</div>
    </> : null}
    <div className="table-footer">Status presensi yang sudah tersimpan akan dimuat saat sesi dipilih. Sesi hanya dapat difinalisasi jika setiap siswa aktif memiliki catatan.</div>
  </section>;
}
