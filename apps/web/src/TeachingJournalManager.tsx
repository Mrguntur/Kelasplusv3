import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { BookOpen, CheckCircle2, Plus, RefreshCw, Send } from 'lucide-react';
import { api } from './api';

type Assignment = {
  id: string;
  schoolClass: { id: string; name: string; gradeLevel: number };
  subject: { id: string; name: string; code: string | null };
  staffProfile: { id: string; displayName: string };
  term?: { id: string; name: string; sequence: number } | null;
};
type Journal = {
  id: string; teachingAssignmentId: string; journalDate: string; topic: string;
  learningActivity: string; reflection: string | null; status: 'DRAFT' | 'SUBMITTED';
  submittedAt?: string | null; assignment?: Assignment;
};

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function TeachingJournalManager({ role }: { role: string }) {
  const canReviewAll = role === 'SCHOOL_ADMIN' || role === 'SCHOOL_LEADER';
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [assignmentId, setAssignmentId] = useState('');
  const [journalDate, setJournalDate] = useState(today());
  const [topic, setTopic] = useState('');
  const [learningActivity, setLearningActivity] = useState('');
  const [reflection, setReflection] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [assignmentData, journalData] = await Promise.all([
        api<Assignment[]>('/academic/teaching-assignments'),
        api<Journal[]>('/academic/journals'),
      ]);
      setAssignments(assignmentData);
      setJournals(journalData);
      setAssignmentId(current => assignmentData.some(a => a.id === current) ? current : (assignmentData[0]?.id ?? ''));
    } catch (e) { setError(e instanceof Error ? e.message : 'Data jurnal gagal dimuat.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function createJournal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!assignmentId) return;
    setSaving(true); setError(''); setNotice('');
    try {
      await api('/academic/journals', {
        method: 'POST',
        body: JSON.stringify({ teachingAssignmentId: assignmentId, journalDate, topic: topic.trim(), learningActivity: learningActivity.trim(), reflection: reflection.trim() || undefined }),
      });
      setTopic(''); setLearningActivity(''); setReflection('');
      setNotice('Jurnal disimpan sebagai draf.');
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Jurnal gagal disimpan.'); }
    finally { setSaving(false); }
  }

  async function submitJournal(id: string) {
    if (!window.confirm('Kirim jurnal ini? Jurnal yang sudah dikirim tidak dapat diedit.')) return;
    setSaving(true); setError(''); setNotice('');
    try {
      await api(`/academic/journals/${id}/submit`, { method: 'POST' });
      setNotice('Jurnal berhasil dikirim.');
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Jurnal gagal dikirim.'); }
    finally { setSaving(false); }
  }

  return <section className="academic-section">
    <div className="attendance-heading"><div><span className="eyebrow">ADMINISTRASI PEMBELAJARAN</span><h3><BookOpen size={18}/> Jurnal mengajar</h3><p>Catat materi, aktivitas pembelajaran, dan refleksi. Jurnal baru tersimpan sebagai draf sampai dikirim.</p></div><button className="secondary-button" onClick={() => void load()} disabled={loading}><RefreshCw size={14}/> Perbarui</button></div>
    {error && <div className="alert error" role="alert">{error}</div>}{notice && <div className="alert success" role="status">{notice}</div>}
    {!canReviewAll && <form className="academic-form" onSubmit={createJournal}>
      <h3><Plus size={16}/> Buat jurnal baru</h3>
      <label>Penugasan mengajar *<select required value={assignmentId} onChange={e=>setAssignmentId(e.target.value)}><option value="">Pilih kelas dan mata pelajaran</option>{assignments.map(a=><option key={a.id} value={a.id}>{a.schoolClass.name} · {a.subject.name}{a.term ? ` · ${a.term.name}` : ''}</option>)}</select></label>
      <label>Tanggal pembelajaran *<input required type="date" value={journalDate} onChange={e=>setJournalDate(e.target.value)}/></label>
      <label>Materi / topik *<input required minLength={2} maxLength={250} value={topic} onChange={e=>setTopic(e.target.value)} placeholder="Contoh: Descriptive text"/></label>
      <label>Aktivitas pembelajaran *<textarea required minLength={2} maxLength={10000} rows={4} value={learningActivity} onChange={e=>setLearningActivity(e.target.value)} placeholder="Tuliskan kegiatan pembelajaran yang dilakukan…"/></label>
      <label>Refleksi (opsional)<textarea maxLength={10000} rows={3} value={reflection} onChange={e=>setReflection(e.target.value)} placeholder="Apa yang berjalan baik dan apa yang perlu diperbaiki?"/></label>
      <div className="form-actions"><button className="primary-button" disabled={saving||!assignmentId||!topic.trim()||!learningActivity.trim()}><Plus size={14}/>{saving?'Menyimpan…':'Simpan sebagai draf'}</button></div>
      {!assignments.length && !loading && <p className="form-hint">Belum ada penugasan mengajar untuk akun ini. Hubungi administrator sekolah untuk memeriksa penugasan.</p>}
    </form>}
    <div className="table-wrap"><table className="academic-table"><thead><tr><th>Tanggal</th><th>Kelas / Mapel</th><th>Materi</th><th>Status</th><th>Aksi</th></tr></thead><tbody>{journals.map(j=><tr key={j.id}><td>{new Date(j.journalDate).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'})}</td><td><strong>{j.assignment?.schoolClass.name ?? assignments.find(a=>a.id===j.teachingAssignmentId)?.schoolClass.name ?? '—'}</strong><span className="table-subtitle">{j.assignment?.subject.name ?? assignments.find(a=>a.id===j.teachingAssignmentId)?.subject.name ?? 'Mata pelajaran'}</span></td><td><strong>{j.topic}</strong><span className="table-subtitle">{j.learningActivity}</span></td><td><span className="status-tag">{j.status==='SUBMITTED'?'Terkirim':'Draf'}</span></td><td>{j.status==='DRAFT' && !canReviewAll ? <button className="table-action" disabled={saving} onClick={()=>void submitJournal(j.id)}><Send size={13}/> Kirim</button> : j.status==='SUBMITTED' ? <span className="finalized-note"><CheckCircle2 size={14}/> Terkirim</span> : <span className="muted">Pantauan</span>}</td></tr>)}</tbody></table>{!loading&&!journals.length&&<div className="academic-empty">Belum ada jurnal mengajar.</div>}{loading&&<div className="academic-empty">Memuat jurnal…</div>}</div>
    <div className="table-footer">{canReviewAll?'Menampilkan jurnal sekolah aktif untuk pemantauan.':'Menampilkan jurnal milik akun ini. Jurnal yang sudah dikirim terkunci dari perubahan.'}</div>
  </section>;
}
