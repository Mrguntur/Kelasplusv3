import { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw, Users } from 'lucide-react';
import { api } from './api';
import AiStudentCaseButton from './AiStudentCaseButton';

type SchoolClass = { id: string; name: string; gradeLevel: number; academicYear?: { name: string } | null };
type AttentionStudent = {
  id: string; fullName: string; studentNumber: string | null;
  attendance: { attendanceRate: number | null; ABSENT: number; recordedSessions: number };
  assessment: { averagePercentage: number | null; publishedAssessmentsWithScore: number };
};
type ClassReport = { class: { name: string }; summary: { finalizedAttendanceSessions: number }; students: AttentionStudent[] };

function percent(value: number | null) {
  return value === null ? 'Belum cukup data' : value.toLocaleString('id-ID', { maximumFractionDigits: 1 }) + '%';
}

export default function StudentAttentionCenter({ role }: { role: string }) {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [classId, setClassId] = useState('');
  const [report, setReport] = useState<ClassReport | null>(null);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingReport, setLoadingReport] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'attendance' | 'learning'>('all');

  useEffect(() => {
    let active = true;
    api<SchoolClass[]>('/academic/reports/classes')
      .then(items => { if (!active) return; setClasses(items); if (items.length) setClassId(items[0].id); })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : 'Daftar kelas tidak dapat dimuat.'); })
      .finally(() => { if (active) setLoadingClasses(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!classId) { setReport(null); return; }
    let active = true;
    setLoadingReport(true); setError(''); setReport(null);
    api<ClassReport>('/academic/reports/classes/' + classId)
      .then(data => { if (active) setReport(data); })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : 'Ringkasan siswa tidak dapat dimuat.'); })
      .finally(() => { if (active) setLoadingReport(false); });
    return () => { active = false; };
  }, [classId]);

  const students = (report?.students ?? []).map(student => {
    const attendanceConcern = student.attendance.attendanceRate !== null && student.attendance.attendanceRate < 80;
    const learningConcern = student.assessment.averagePercentage !== null && student.assessment.averagePercentage < 65;
    return { ...student, attendanceConcern, learningConcern };
  }).filter(student => filter === 'attendance' ? student.attendanceConcern : filter === 'learning' ? student.learningConcern : student.attendanceConcern || student.learningConcern);

  return <section className="student-attention-panel">
    <div className="panel-heading"><div><span className="eyebrow">PENDAMPINGAN SISWA</span><h2><AlertTriangle size={18}/> Pusat Perhatian Siswa</h2></div><span className="count-pill">{students.length} perlu ditinjau</span></div>
    <p className="student-attention-intro">Menandai indikator kehadiran di bawah 80% atau rerata penilaian di bawah 65%. Ini adalah sinyal awal untuk ditinjau bersama konteks siswa, bukan diagnosis atau keputusan otomatis.</p>
    <div className="student-attention-controls"><label>Pilih kelas<select value={classId} onChange={e=>setClassId(e.target.value)} disabled={loadingClasses}><option value="">Pilih kelas</option>{classes.map(item=><option key={item.id} value={item.id}>{item.name} · Tingkat {item.gradeLevel}</option>)}</select></label><div className="student-attention-filters"><button className={filter==='all'?'selected':''} onClick={()=>setFilter('all')}>Semua</button><button className={filter==='attendance'?'selected':''} onClick={()=>setFilter('attendance')}>Kehadiran</button><button className={filter==='learning'?'selected':''} onClick={()=>setFilter('learning')}>Penilaian</button></div></div>
    {error && <div className="alert error" role="alert">{error}</div>}
    {loadingClasses || loadingReport ? <div className="academic-empty"><RefreshCw size={16}/> Memuat ringkasan kelas…</div> : !classes.length ? <div className="academic-empty">Belum ada kelas yang dapat diakses oleh akun ini.</div> : !report ? <div className="academic-empty">Pilih kelas untuk memeriksa indikator siswa.</div> : !report.summary.finalizedAttendanceSessions && !report.students.some(s=>s.assessment.publishedAssessmentsWithScore>0) ? <div className="academic-empty">Belum ada data presensi final atau penilaian terpublikasi yang cukup untuk pemeriksaan. </div> : !students.length ? <div className="academic-empty"><Users size={20}/> Tidak ada siswa yang melewati ambang pemeriksaan pada data tersedia.</div> : <div className="table-wrap"><table className="academic-table"><thead><tr><th>Nama siswa</th><th>Kehadiran</th><th>Rerata penilaian</th><th>Indikator</th>{role === 'TEACHER' && <th>Tindak lanjut</th>}</tr></thead><tbody>{students.map(student=><tr key={student.id}><td><strong>{student.fullName}</strong><span className="table-subtitle">{student.studentNumber || 'NIS belum diisi'}</span></td><td>{percent(student.attendance.attendanceRate)}</td><td>{percent(student.assessment.averagePercentage)}</td><td><div className="attention-tags">{student.attendanceConcern&&<span>Kehadiran</span>}{student.learningConcern&&<span>Penilaian</span>}</div></td>{role === 'TEACHER' && <td><AiStudentCaseButton studentId={student.id} studentName={student.fullName}/></td>}</tr>)}</tbody></table></div>}
    <p className="student-attention-footnote">Data diambil dari laporan kelas yang diizinkan untuk role ini. Ambang 80% dan 65% merupakan penanda awal yang dapat ditinjau sekolah, bukan standar kelulusan.</p>
  </section>;
}
