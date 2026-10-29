import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, BookOpen, Plus, RefreshCw } from 'lucide-react';
import { api } from './api';

type Term = { id: string; name: string; sequence: number; startDate: string; endDate: string };
type AcademicYear = { id: string; name: string; status: string; startDate?: string; endDate?: string };

function dateInput(value?: string) {
  if (!value) return '';
  return value.slice(0, 10);
}

export default function AcademicTermManager({ year, canManage, onBack }: {
  year: AcademicYear;
  canManage: boolean;
  onBack: () => void;
}) {
  const [terms, setTerms] = useState<Term[]>([]);
  const [name, setName] = useState('Semester Ganjil');
  const [sequence, setSequence] = useState('1');
  const [startDate, setStartDate] = useState(dateInput(year.startDate));
  const [endDate, setEndDate] = useState(dateInput(year.endDate));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setTerms(await api<Term[]>(`/academic/years/${year.id}/terms`)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Daftar semester gagal dimuat.'); }
    finally { setLoading(false); }
  }, [year.id]);

  useEffect(() => { void load(); }, [load]);

  async function createTerm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(''); setNotice('');
    try {
      await api<Term>(`/academic/years/${year.id}/terms`, {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), sequence: Number(sequence), startDate, endDate }),
      });
      setShowForm(false); setName(Number(sequence) === 1 ? 'Semester Genap' : 'Semester Ganjil');
      setSequence(String(Number(sequence) + 1)); setNotice('Semester berhasil ditambahkan.'); await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Semester gagal disimpan.'); }
    finally { setSaving(false); }
  }

  return <section className="term-manager">
    <button className="back-link" onClick={onBack}><ArrowLeft size={15}/> Kembali ke tahun ajaran</button>
    <div className="term-heading"><div><span className="eyebrow">PERIODE PEMBELAJARAN</span><h3><BookOpen size={18}/> {year.name}</h3><p>Kelola semester di dalam rentang tahun ajaran yang dipilih.</p></div><button className="secondary-button" onClick={() => void load()} disabled={loading}><RefreshCw size={14}/> Perbarui</button></div>
    {error && <div className="alert error" role="alert">{error}</div>}{notice && <div className="alert success" role="status">{notice}</div>}
    {canManage && <div className="term-toolbar"><span className="muted">Urutan semester harus unik dalam tahun ajaran ini.</span><button className="primary-button" onClick={() => setShowForm(value => !value)} disabled={loading}><Plus size={15}/> Tambah semester</button></div>}
    {showForm && canManage && <form className="academic-form term-form" onSubmit={createTerm}><h3>Tambah semester</h3><label>Nama semester *<input required minLength={2} maxLength={80} value={name} onChange={e=>setName(e.target.value)}/></label><label>Urutan *<select value={sequence} onChange={e=>setSequence(e.target.value)}>{Array.from({length:8},(_,i)=>i+1).map(n=><option key={n} value={n}>{n}</option>)}</select></label><label>Tanggal mulai *<input required type="date" min={dateInput(year.startDate)} max={dateInput(year.endDate)} value={startDate} onChange={e=>setStartDate(e.target.value)}/></label><label>Tanggal akhir *<input required type="date" min={startDate||dateInput(year.startDate)} max={dateInput(year.endDate)} value={endDate} onChange={e=>setEndDate(e.target.value)}/></label><div className="form-actions"><button type="button" className="secondary-button" onClick={()=>setShowForm(false)}>Batal</button><button className="primary-button" disabled={saving||!startDate||!endDate||endDate<startDate}>{saving?'Menyimpan…':'Simpan semester'}</button></div></form>}
    {loading ? <div className="academic-empty">Memuat semester…</div> : <div className="table-wrap"><table className="academic-table"><thead><tr><th>Urutan</th><th>Semester</th><th>Tanggal mulai</th><th>Tanggal akhir</th></tr></thead><tbody>{terms.map(term=><tr key={term.id}><td>{term.sequence}</td><td><strong>{term.name}</strong></td><td>{new Date(term.startDate).toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric',timeZone:'UTC'})}</td><td>{new Date(term.endDate).toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric',timeZone:'UTC'})}</td></tr>)}</tbody></table>{!terms.length&&<div className="academic-empty">Belum ada semester untuk tahun ajaran ini.</div>}</div>}
  </section>;
}
