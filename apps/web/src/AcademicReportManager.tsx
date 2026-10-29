import { useEffect, useState } from 'react';
import { FileText, Printer, RefreshCw } from 'lucide-react';
import { api } from './api';

type SchoolClass = { id: string; name: string; gradeLevel: number; academicYear?: { name: string } | null };
type Report = {
  generatedAt: string;
  class: { id: string; name: string; gradeLevel: number; academicYear?: { name: string } | null };
  summary: { activeStudents: number; finalizedAttendanceSessions: number; attendanceRate: number | null; publishedAssessments: number; submittedTeachingJournals: number };
  assessments: { id: string; title: string; assessmentType: string; subject: { name: string }; maxScore: number; scoreCount: number; averageScore: number | null; averagePercentage: number | null }[];
  students: { id: string; studentNumber: string | null; fullName: string; preferredName: string | null; attendance: { PRESENT: number; LATE: number; SICK: number; EXCUSED: number; ABSENT: number; recordedSessions: number; attendanceRate: number | null }; assessment: { publishedAssessmentsWithScore: number; averagePercentage: number | null } }[];
};
const percent = (value: number | null) => value === null ? '—' : value.toLocaleString('id-ID', { maximumFractionDigits: 2 }) + '%';

export default function AcademicReportManager() {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [classesLoading, setClassesLoading] = useState(true);
  const [classId, setClassId] = useState('');
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    api<SchoolClass[]>('/academic/reports/classes')
      .then(items => { if (!active) return; setClasses(items); if (items.length) setClassId(items[0].id); })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : 'Daftar kelas laporan gagal dimuat.'); })
      .finally(() => { if (active) setClassesLoading(false); });
    return () => { active = false; };
  }, []);

  async function loadReport() {
    if (!classId) return;
    setLoading(true); setError('');
    try { setReport(await api<Report>('/academic/reports/classes/' + classId)); }
    catch (e) { setReport(null); setError(e instanceof Error ? e.message : 'Laporan akademik gagal dimuat.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { if (classId) void loadReport(); }, [classId]);

  return <section className="academic-section">
    <div className="attendance-heading"><div><span className="eyebrow">REKAPITULASI AKADEMIK</span><h3><FileText size={18}/> Laporan kelas</h3><p>Ringkasan kehadiran, penilaian terpublikasi, dan perkembangan setiap siswa.</p></div><div className="form-actions"><button className="secondary-button" onClick={() => void loadReport()} disabled={loading || !classId}><RefreshCw size={14}/> Perbarui</button><button className="primary-button" onClick={() => window.print()} disabled={!report}><Printer size={14}/> Cetak / Simpan PDF</button></div></div>
    <div className="academic-form"><label>Pilih kelas<select value={classId} onChange={e => setClassId(e.target.value)}><option value="">Pilih kelas</option>{classes.filter(c => c.id).map(c => <option key={c.id} value={c.id}>{c.name} · Tingkat {c.gradeLevel}{c.academicYear?.name ? ' · ' + c.academicYear.name : ''}</option>)}</select></label></div>
    {error && <div className="alert error" role="alert">{error}</div>}
    {(loading || classesLoading) && <div className="academic-empty">Menyiapkan laporan…</div>}
    {!loading && !report && !error && <div className="academic-empty">{classesLoading ? 'Memuat daftar kelas…' : classes.length ? 'Pilih kelas untuk melihat laporan.' : 'Tidak ada kelas yang dapat diakses untuk laporan.'}</div>}
    {report && <div className="academic-report-print">
      <header className="report-heading"><span>LAPORAN AKADEMIK KELAS</span><h2>{report.class.name}</h2><p>Tingkat {report.class.gradeLevel} · {report.class.academicYear?.name ?? 'Tahun ajaran tidak tersedia'}</p><small>Dibuat {new Date(report.generatedAt).toLocaleString('id-ID')}</small></header>
      <div className="academic-report-metrics"><article><strong>{report.summary.activeStudents}</strong><span>Siswa aktif</span></article><article><strong>{report.summary.finalizedAttendanceSessions}</strong><span>Pertemuan presensi final</span></article><article><strong>{percent(report.summary.attendanceRate)}</strong><span>Kehadiran kelas</span></article><article><strong>{report.summary.publishedAssessments}</strong><span>Penilaian terpublikasi</span></article><article><strong>{report.summary.submittedTeachingJournals}</strong><span>Jurnal terkirim</span></article></div>
      <h3>Perkembangan siswa</h3><div className="table-wrap"><table className="academic-table"><thead><tr><th>Nama siswa</th><th>NIS</th><th>Hadir</th><th>Terlambat</th><th>Izin</th><th>Sakit</th><th>Alpa</th><th>Kehadiran</th><th>Rerata nilai</th></tr></thead><tbody>{report.students.map(s => <tr key={s.id}><td><strong>{s.fullName}</strong>{s.preferredName && <span className="table-subtitle">{s.preferredName}</span>}</td><td>{s.studentNumber ?? '—'}</td><td>{s.attendance.PRESENT}</td><td>{s.attendance.LATE}</td><td>{s.attendance.EXCUSED}</td><td>{s.attendance.SICK}</td><td>{s.attendance.ABSENT}</td><td>{percent(s.attendance.attendanceRate)}</td><td>{percent(s.assessment.averagePercentage)}</td></tr>)}</tbody></table></div>
      <h3>Ringkasan penilaian</h3><div className="table-wrap"><table className="academic-table"><thead><tr><th>Penilaian</th><th>Mata pelajaran</th><th>Jenis</th><th>Nilai maks.</th><th>Siswa dinilai</th><th>Rerata</th></tr></thead><tbody>{report.assessments.map(a => <tr key={a.id}><td>{a.title}</td><td>{a.subject.name}</td><td>{a.assessmentType}</td><td>{a.maxScore}</td><td>{a.scoreCount}</td><td>{a.averageScore === null ? '—' : a.averageScore.toLocaleString('id-ID')}</td></tr>)}</tbody></table>{!report.assessments.length && <div className="academic-empty">Belum ada penilaian yang dipublikasikan.</div>}</div>
      <p className="report-footnote">Laporan ini dibuat dari data presensi yang telah difinalisasi, penilaian yang telah dipublikasikan, dan jurnal mengajar yang telah dikirim.</p>
    </div>}
  </section>;
}
