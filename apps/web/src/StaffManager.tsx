import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api } from './api';

type Staff = { id: string; userId: string; displayName: string; employeeNumber: string | null; status: 'ACTIVE' | 'INACTIVE' };
type SchoolClass = { id: string; name: string; gradeLevel: number; homeroomStaff?: { id: string; displayName: string } | null };
type Subject = { id: string; code: string | null; name: string };
type Assignment = { id: string; classId: string; subjectId: string; staffProfileId: string; schoolClass: { name: string }; subject: { name: string }; staffProfile: { displayName: string } };

export default function StaffManager({ canManage }: { canManage: boolean }) {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [assignmentClassId, setAssignmentClassId] = useState('');
  const [assignmentSubjectId, setAssignmentSubjectId] = useState('');
  const [assignmentStaffId, setAssignmentStaffId] = useState('');
  const [editing, setEditing] = useState<Staff | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [staffRows, classRows, subjectRows, assignmentRows] = await Promise.all([
        api<Staff[]>('/academic/staff'),
        api<SchoolClass[]>('/academic/classes'),
        api<Subject[]>('/academic/subjects'),
        api<Assignment[]>('/academic/teaching-assignments'),
      ]);
      setStaff(staffRows); setClasses(classRows); setSubjects(subjectRows); setAssignments(assignmentRows);
    } catch (e) { setError(e instanceof Error ? e.message : 'Data guru dan kelas gagal dimuat.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!editing) return;
    const form = new FormData(event.currentTarget);
    setSaving(true); setError(''); setNotice('');
    try {
      await api('/academic/staff/' + editing.id, { method: 'PATCH', body: JSON.stringify({
        displayName: String(form.get('displayName')).trim(),
        employeeNumber: String(form.get('employeeNumber')).trim() || null,
        status: String(form.get('status')),
      }) });
      setEditing(null); setNotice('Profil guru/staf berhasil diperbarui.'); await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Profil gagal diperbarui.'); }
    finally { setSaving(false); }
  }

  async function createAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!assignmentClassId || !assignmentSubjectId || !assignmentStaffId) return;
    setSaving(true); setError(''); setNotice('');
    try {
      await api('/academic/teaching-assignments', { method: 'POST', body: JSON.stringify({
        classId: assignmentClassId, subjectId: assignmentSubjectId, staffProfileId: assignmentStaffId,
      }) });
      setAssignmentClassId(''); setAssignmentSubjectId(''); setAssignmentStaffId('');
      setNotice('Penugasan mengajar berhasil ditambahkan.'); await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Penugasan mengajar gagal disimpan.'); }
    finally { setSaving(false); }
  }

  async function setHomeroom(classId: string, staffProfileId: string) {
    setSaving(true); setError(''); setNotice('');
    try {
      await api('/academic/classes/' + classId + '/homeroom', { method: 'PATCH', body: JSON.stringify({ staffProfileId: staffProfileId || null }) });
      setNotice('Wali kelas berhasil diperbarui.'); await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Penetapan wali kelas gagal.'); }
    finally { setSaving(false); }
  }

  return <div className="class-detail">
    {error && <div className="alert error" role="alert">{error}</div>}
    {notice && <div className="alert success" role="status">{notice}</div>}
    {editing && canManage && <form className="academic-form" onSubmit={save}>
      <h3>Edit profil guru/staf</h3>
      <label>Nama tampilan *<input name="displayName" required minLength={2} maxLength={200} defaultValue={editing.displayName}/></label>
      <label>Nomor pegawai<input name="employeeNumber" maxLength={60} defaultValue={editing.employeeNumber ?? ''}/></label>
      <label>Status<select name="status" defaultValue={editing.status}><option value="ACTIVE">Aktif</option><option value="INACTIVE">Nonaktif</option></select></label>
      <div className="form-actions"><button type="button" className="secondary-button" onClick={() => setEditing(null)}>Batal</button><button className="primary-button" disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan perubahan'}</button></div>
    </form>}
    <div className="panel-heading"><div><span className="eyebrow">DATA KEPEGAWAIAN</span><h2>Guru dan staf</h2></div><button className="secondary-button" onClick={() => void load()} disabled={loading}>Perbarui</button></div>
    {!canManage && <p className="muted role-note">Anda hanya dapat melihat profil yang terkait dengan akun sendiri.</p>}
    <div className="table-wrap"><table className="academic-table"><thead><tr><th>Nama guru/staf</th><th>Nomor pegawai</th><th>Status</th><th></th></tr></thead><tbody>
      {staff.map(person => <tr key={person.id}><td><strong>{person.displayName}</strong><span className="table-subtitle">Akun sekolah terhubung</span></td><td>{person.employeeNumber || '—'}</td><td><span className="status-tag">{person.status === 'ACTIVE' ? 'Aktif' : 'Nonaktif'}</span></td><td>{canManage && <button className="table-action" onClick={() => setEditing(person)}>Edit</button>}</td></tr>)}
    </tbody></table>{loading ? <div className="academic-empty">Memuat data guru dan staf…</div> : !staff.length ? <div className="academic-empty">Belum ada profil guru/staf yang terhubung ke akun sekolah.</div> : null}</div>
    {canManage && <>
      <div className="panel-heading" style={{marginTop:24}}><div><span className="eyebrow">PENGELOLAAN KELAS</span><h2>Penetapan wali kelas</h2></div></div>
      <div className="table-wrap"><table className="academic-table"><thead><tr><th>Kelas</th><th>Wali kelas</th><th>Perbarui penugasan</th></tr></thead><tbody>
        {classes.map(item => <tr key={item.id}><td><strong>{item.name}</strong><span className="table-subtitle">Tingkat {item.gradeLevel}</span></td><td>{item.homeroomStaff?.displayName ?? 'Belum ditetapkan'}</td><td><select aria-label={'Wali kelas ' + item.name} disabled={saving} value={item.homeroomStaff?.id ?? ''} onChange={e => void setHomeroom(item.id, e.target.value)}><option value="">Belum ditetapkan</option>{staff.filter(person => person.status === 'ACTIVE').map(person => <option key={person.id} value={person.id}>{person.displayName}</option>)}</select></td></tr>)}
      </tbody></table>{!classes.length && <div className="academic-empty">Belum ada kelas.</div>}</div>
      <div className="panel-heading" style={{marginTop:24}}><div><span className="eyebrow">PEMBAGIAN TUGAS</span><h2>Penugasan mengajar</h2></div></div>
      <form className="enrollment-form" onSubmit={createAssignment}>
        <label>Kelas<select required value={assignmentClassId} onChange={e=>setAssignmentClassId(e.target.value)}><option value="">Pilih kelas</option>{classes.map(item=><option key={item.id} value={item.id}>{item.name} · Tingkat {item.gradeLevel}</option>)}</select></label>
        <label>Mata pelajaran<select required value={assignmentSubjectId} onChange={e=>setAssignmentSubjectId(e.target.value)}><option value="">Pilih mata pelajaran</option>{subjects.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label>Guru<select required value={assignmentStaffId} onChange={e=>setAssignmentStaffId(e.target.value)}><option value="">Pilih guru</option>{staff.filter(person=>person.status==='ACTIVE').map(person=><option key={person.id} value={person.id}>{person.displayName}</option>)}</select></label>
        <button className="primary-button" disabled={saving || !assignmentClassId || !assignmentSubjectId || !assignmentStaffId}>Tambah penugasan</button>
      </form>
      <div className="table-wrap"><table className="academic-table"><thead><tr><th>Guru</th><th>Mata pelajaran</th><th>Kelas</th></tr></thead><tbody>{assignments.map(item=><tr key={item.id}><td><strong>{item.staffProfile.displayName}</strong></td><td>{item.subject.name}</td><td>{item.schoolClass.name}</td></tr>)}</tbody></table>{!assignments.length&&<div className="academic-empty">Belum ada penugasan mengajar.</div>}</div>
    </>}
    <p className="form-hint">Akun guru baru dan proses undangan akan ditambahkan setelah alur onboarding identitas diselesaikan. Modul ini saat ini mengelola profil akun yang sudah menjadi anggota sekolah.</p>
  </div>;
}
