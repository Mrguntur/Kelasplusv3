import { useCallback, useEffect, useState } from 'react';
import { BookOpen, RefreshCw, Users } from 'lucide-react';
import { api } from './api';

type MyClassAssignment = {
  id: string;
  term: { id: string; name: string; sequence: number } | null;
  subject: { id: string; name: string; code: string | null };
  schoolClass: {
    id: string; name: string; gradeLevel: number;
    academicYear: { id: string; name: string; status: string };
    homeroomStaff: { displayName: string } | null;
    _count: { enrollments: number };
  };
};

export default function MyClassesManager() {
  const [items, setItems] = useState<MyClassAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      setItems(await api<MyClassAssignment[]>('/academic/my-classes'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kelas yang diampu belum dapat dimuat.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const classes = Array.from(new Map(items.map(item => [item.schoolClass.id, item.schoolClass])).values());

  return <section className="academic-section">
    <div className="attendance-heading">
      <div><span className="eyebrow">RUANG KERJA GURU</span><h3><BookOpen size={18}/> Kelas Saya</h3><p>Daftar kelas dan mata pelajaran yang ditugaskan kepada akun Anda.</p></div>
      <button className="secondary-button" onClick={() => void load()} disabled={loading}><RefreshCw size={14}/> Perbarui</button>
    </div>
    {error && <div className="alert error" role="alert">{error}</div>}
    {loading ? <div className="academic-empty">Memuat penugasan mengajar…</div> :
      !items.length ? <div className="academic-empty"><strong>Belum ada penugasan mengajar</strong><p>Hubungi administrator sekolah untuk memastikan kelas dan mata pelajaran telah ditetapkan ke akun Anda.</p></div> :
      <div className="my-classes-grid">
        {classes.map(item => {
          const assignments = items.filter(a => a.schoolClass.id === item.id);
          return <article className="panel my-class-card" key={item.id}>
            <div className="my-class-card-head"><div><span className="eyebrow">TINGKAT {item.gradeLevel}</span><h3>{item.name}</h3><p>{item.academicYear.name}</p></div><div className="my-class-count"><Users size={17}/><strong>{item._count.enrollments}</strong><span>siswa</span></div></div>
            <div className="my-class-subjects"><strong>Mata pelajaran diampu</strong>{assignments.map(a=><div className="my-class-subject" key={a.id}><span>{a.subject.name}</span><small>{a.term ? a.term.name : 'Semua semester'}</small></div>)}</div>
            <div className="my-class-homeroom">Wali kelas: {item.homeroomStaff?.displayName ?? 'Belum ditetapkan'}</div>
          </article>;
        })}
      </div>
    }
    <div className="table-footer">Informasi hanya mencakup penugasan aktif milik akun guru yang sedang masuk.</div>
  </section>;
}
