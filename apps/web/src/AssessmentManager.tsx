import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ClipboardCheck, Plus, RefreshCw, Save, Send } from 'lucide-react';
import { api } from './api';

type Assignment = {
  id: string;
  schoolClass: { id: string; name: string; gradeLevel: number };
  subject: { id: string; name: string; code: string | null };
  staffProfile: { id: string; displayName: string };
  term?: { id: string; name: string; sequence: number } | null;
};
type Assessment = {
  id: string;
  teachingAssignmentId: string;
  title: string;
  assessmentType: string;
  maxScore: number | string;
  weight: number | string;
  dueDate: string | null;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  assignment?: Assignment;
  _count?: { scores: number };
};
type Enrollment = {
  studentId: string;
  student: { id: string; studentNumber: string | null; fullName: string; preferredName: string | null };
};
type Score = { studentId: string; score: number | string; feedback: string | null; student?: Enrollment['student'] };

const assessmentTypes = [
  ['QUIZ', 'Kuis'], ['TASK', 'Tugas'], ['MIDTERM', 'Ujian tengah semester'],
  ['FINAL', 'Ujian akhir'], ['PROJECT', 'Proyek'], ['PRACTICE', 'Praktik'], ['OTHER', 'Lainnya'],
] as const;
const typeLabel = (value: string) => assessmentTypes.find(([key]) => key === value)?.[1] ?? value;

export default function AssessmentManager({ role }: { role: string }) {
  const isPrivileged = role === 'SCHOOL_ADMIN' || role === 'SCHOOL_LEADER';
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [scores, setScores] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [assignmentId, setAssignmentId] = useState('');
  const [title, setTitle] = useState('');
  const [assessmentType, setAssessmentType] = useState('TASK');
  const [maxScore, setMaxScore] = useState('100');
  const [weight, setWeight] = useState('0');
  const [dueDate, setDueDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [assignmentData, assessmentData] = await Promise.all([
        api<Assignment[]>('/academic/teaching-assignments'),
        api<Assessment[]>('/academic/assessments'),
      ]);
      setAssignments(assignmentData);
      setAssessments(assessmentData);
      setAssignmentId(current => assignmentData.some(a => a.id === current) ? current : (assignmentData[0]?.id ?? ''));
      setSelectedId(current => assessmentData.some(a => a.id === current) ? current : (assessmentData[0]?.id ?? ''));
    } catch (e) { setError(e instanceof Error ? e.message : 'Data penilaian gagal dimuat.'); }
    finally { setLoading(false); }
  }, []);

  const loadScores = useCallback(async (assessmentId: string) => {
    if (!assessmentId) { setEnrollments([]); setScores({}); setFeedback({}); return; }
    setError('');
    try {
      const assessment = assessments.find(item => item.id === assessmentId);
      const [scoreData, enrollmentData] = await Promise.all([
        api<Score[]>(`/academic/assessments/${assessmentId}/scores`),
        assessment?.assignment?.schoolClass?.id
          ? api<Enrollment[]>(`/academic/classes/${assessment.assignment.schoolClass.id}/enrollments`)
          : Promise.resolve([] as Enrollment[]),
      ]);
      setEnrollments(enrollmentData);
      const scoreMap: Record<string, string> = {};
      const feedbackMap: Record<string, string> = {};
      scoreData.forEach(item => { scoreMap[item.studentId] = String(item.score); feedbackMap[item.studentId] = item.feedback ?? ''; });
      setScores(scoreMap); setFeedback(feedbackMap);
    } catch (e) { setError(e instanceof Error ? e.message : 'Nilai siswa gagal dimuat.'); }
  }, [assessments]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (selectedId && assessments.some(a => a.id === selectedId)) void loadScores(selectedId); }, [selectedId, assessments, loadScores]);

  async function createAssessment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!assignmentId) return;
    setSaving(true); setError(''); setNotice('');
    try {
      const created = await api<Assessment>('/academic/assessments', {
        method: 'POST',
        body: JSON.stringify({
          teachingAssignmentId: assignmentId, title: title.trim(), assessmentType,
          maxScore: Number(maxScore), weight: Number(weight), ...(dueDate ? { dueDate } : {}),
        }),
      });
      setTitle(''); setNotice('Penilaian berhasil dibuat. Silakan masukkan nilai siswa.');
      await load();
      setSelectedId(created.id);
    } catch (e) { setError(e instanceof Error ? e.message : 'Penilaian gagal dibuat.'); }
    finally { setSaving(false); }
  }

  async function saveScores(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const assessment = assessments.find(item => item.id === selectedId);
    if (!assessment || assessment.status !== 'DRAFT') return;
    const entries = enrollments.filter(item => scores[item.studentId] !== undefined && scores[item.studentId].trim() !== '').map(item => ({
      studentId: item.studentId, score: Number(scores[item.studentId]), ...(feedback[item.studentId]?.trim() ? { feedback: feedback[item.studentId].trim() } : {}),
    }));
    if (!entries.length) { setError('Masukkan minimal satu nilai sebelum menyimpan.'); return; }
    if (entries.some(item => !Number.isFinite(item.score) || item.score < 0 || item.score > Number(assessment.maxScore))) {
      setError(`Nilai harus berupa angka antara 0 dan ${assessment.maxScore}.`); return;
    }
    setSaving(true); setError(''); setNotice('');
    try {
      const result = await api<{ savedScores: number; enrolledStudents: number }>(`/academic/assessments/${selectedId}/scores`, {
        method: 'POST', body: JSON.stringify({ scores: entries }),
      });
      setNotice(`Berhasil menyimpan ${result.savedScores} nilai dari ${result.enrolledStudents} siswa aktif.`);
      await load();
      await loadScores(selectedId);
    } catch (e) { setError(e instanceof Error ? e.message : 'Nilai gagal disimpan.'); }
    finally { setSaving(false); }
  }

  async function publishAssessment() {
    const assessment = assessments.find(item => item.id === selectedId);
    if (!assessment) return;
    const missing = enrollments.filter(item => scores[item.studentId] === undefined || scores[item.studentId].trim() === '').length;
    if (missing > 0) { setError(`Masih ada ${missing} siswa tanpa nilai. Lengkapi nilai sebelum publikasi.`); return; }
    if (!window.confirm('Publikasikan penilaian ini? Nilai tidak dapat diubah setelah dipublikasikan.')) return;
    const entries = enrollments.map(item => ({
      studentId: item.studentId,
      score: Number(scores[item.studentId]),
      ...(feedback[item.studentId]?.trim() ? { feedback: feedback[item.studentId].trim() } : {}),
    }));
    if (entries.some(item => !Number.isFinite(item.score) || item.score < 0 || item.score > Number(assessment.maxScore))) {
      setError('Pastikan semua nilai berupa angka antara 0 dan ' + assessment.maxScore + '.'); return;
    }
    setSaving(true); setError(''); setNotice('');
    try {
      await api('/academic/assessments/' + selectedId + '/scores', {
        method: 'POST', body: JSON.stringify({ scores: entries }),
      });
      await api('/academic/assessments/' + selectedId + '/publish', { method: 'POST' });
      setNotice('Nilai berhasil disimpan dan penilaian dipublikasikan.');
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Penilaian gagal dipublikasikan.'); }
    finally { setSaving(false); }
  }

  const selected = assessments.find(item => item.id === selectedId);
  const selectedAssignment = selected?.assignment ?? assignments.find(item => item.id === selected?.teachingAssignmentId);
  const canEditSelected = !isPrivileged && selected?.status === 'DRAFT';

  return <section className="academic-section">
    <div className="attendance-heading"><div><span className="eyebrow">EVALUASI PEMBELAJARAN</span><h3><ClipboardCheck size={18}/> Penilaian & nilai siswa</h3><p>Buat penilaian, catat nilai per siswa, lalu publikasikan setelah seluruh nilai lengkap.</p></div><button className="secondary-button" onClick={() => void load()} disabled={loading}><RefreshCw size={14}/> Perbarui</button></div>
    {error && <div className="alert error" role="alert">{error}</div>}{notice && <div className="alert success" role="status">{notice}</div>}
    {!isPrivileged && <form className="academic-form" onSubmit={createAssessment}>
      <h3><Plus size={16}/> Buat penilaian</h3>
      <label>Penugasan mengajar *<select required value={assignmentId} onChange={e=>setAssignmentId(e.target.value)}><option value="">Pilih kelas dan mata pelajaran</option>{assignments.map(a=><option key={a.id} value={a.id}>{a.schoolClass.name} · {a.subject.name}{a.term ? ` · ${a.term.name}` : ''}</option>)}</select></label>
      <label>Nama penilaian *<input required minLength={2} maxLength={200} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Contoh: Speaking Performance"/></label>
      <div className="form-grid"><label>Jenis penilaian<select value={assessmentType} onChange={e=>setAssessmentType(e.target.value)}>{assessmentTypes.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label>Nilai maksimum *<input required type="number" min="0.01" max="10000" step="0.01" value={maxScore} onChange={e=>setMaxScore(e.target.value)}/></label><label>Bobot (%)<input type="number" min="0" max="100" step="0.01" value={weight} onChange={e=>setWeight(e.target.value)}/></label><label>Tenggat (opsional)<input type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)}/></label></div>
      <div className="form-actions"><button className="primary-button" disabled={saving||!assignmentId||!title.trim()}><Plus size={14}/>{saving?'Menyimpan…':'Buat penilaian'}</button></div>
      {!assignments.length&&!loading&&<p className="form-hint">Belum ada penugasan mengajar untuk akun ini. Hubungi administrator sekolah.</p>}
    </form>}
    <div className="academic-form"><h3>Daftar penilaian</h3>{loading?<div className="academic-empty">Memuat penilaian…</div>:!assessments.length?<div className="academic-empty">Belum ada penilaian.</div>:<label>Pilih penilaian<select value={selectedId} onChange={e=>setSelectedId(e.target.value)}>{assessments.map(a=>{const assignment=a.assignment??assignments.find(item=>item.id===a.teachingAssignmentId);return <option key={a.id} value={a.id}>{assignment?.schoolClass.name??'Kelas'} · {assignment?.subject.name??'Mapel'} — {a.title} ({a.status==='PUBLISHED'?'Dipublikasikan':'Draf'})</option>})}</select></label>}</div>
    {selected&&<><div className="attendance-heading"><div><h3>{selected.title}</h3><p>{selectedAssignment?.schoolClass.name??'Kelas'} · {selectedAssignment?.subject.name??'Mata pelajaran'} · {typeLabel(selected.assessmentType)} · Maks. {selected.maxScore}</p></div><span className="status-tag">{selected.status==='PUBLISHED'?'Dipublikasikan':selected.status==='ARCHIVED'?'Diarsipkan':'Draf'}</span></div>
      <form className="table-wrap" onSubmit={saveScores}><table className="academic-table"><thead><tr><th>Siswa</th><th>NIS</th><th>Nilai / ${selected.maxScore}</th><th>Umpan balik</th></tr></thead><tbody>{enrollments.map(enrollment=><tr key={enrollment.studentId}><td><strong>{enrollment.student.fullName}</strong>{enrollment.student.preferredName&&<span className="table-subtitle">{enrollment.student.preferredName}</span>}</td><td>{enrollment.student.studentNumber??'—'}</td><td><input aria-label={`Nilai ${enrollment.student.fullName}`} className="score-input" type="number" min="0" max={Number(selected.maxScore)} step="0.01" value={scores[enrollment.studentId]??''} disabled={!canEditSelected||saving} onChange={e=>setScores(current=>({...current,[enrollment.studentId]:e.target.value}))}/></td><td><input aria-label={`Umpan balik ${enrollment.student.fullName}`} value={feedback[enrollment.studentId]??''} disabled={!canEditSelected||saving} maxLength={500} onChange={e=>setFeedback(current=>({...current,[enrollment.studentId]:e.target.value}))}/></td></tr>)}</tbody></table>{!enrollments.length&&<div className="academic-empty">Belum ada siswa aktif terdaftar di kelas penilaian ini.</div>}{canEditSelected&&<div className="form-actions"><button className="primary-button" disabled={saving||!enrollments.length}><Save size={14}/>{saving?'Menyimpan…':'Simpan nilai'}</button><button type="button" className="secondary-button" disabled={saving} onClick={()=>void publishAssessment()}><Send size={14}/> Publikasikan</button></div>}</form>
      {!canEditSelected&&<p className="muted role-note">{selected.status==='PUBLISHED'?'Penilaian sudah dipublikasikan dan terkunci.':'Mode pemantauan: nilai tidak dapat diubah dari akun ini.'}</p>}
    </>}
    <div className="table-footer">{isPrivileged?'Pemantauan penilaian sekolah aktif.':'Guru hanya dapat mengelola penilaian pada penugasan miliknya.'}</div>
  </section>;
}
