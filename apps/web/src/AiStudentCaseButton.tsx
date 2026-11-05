import { useState, type FormEvent } from 'react';
import { Bot, ShieldCheck, X } from 'lucide-react';
import { api, ApiError } from './api';

type CaseResponse = {
  answer: string;
  caseReference: string;
  usage: { monthlyUsed: number; monthlyLimit: number };
  model: string;
  privacy: string;
};

export default function AiStudentCaseButton({ studentId, studentName }: { studentId: string; studentName: string }) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState<CaseResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const prompt = question.trim();
    if (prompt.length < 5 || prompt.length > 2000 || busy) return;
    setBusy(true); setError(''); setResult(null);
    try {
      const response = await api<CaseResponse>('/ai/teacher/student-case', {
        method: 'POST',
        body: JSON.stringify({ studentId, question: prompt }),
      });
      setResult(response);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 403) {
        setError('Analisis kasus belum tersedia untuk akun atau paket sekolah ini, atau akses ke siswa tidak diizinkan.');
      } else if (cause instanceof ApiError && cause.status === 503) {
        setError('Layanan AI belum dikonfigurasi oleh administrator platform.');
      } else {
        setError(cause instanceof Error ? cause.message : 'Analisis belum dapat dibuat. Silakan coba kembali.');
      }
    } finally { setBusy(false); }
  }

  return <>
    <button type="button" className="table-action" onClick={() => { setOpen(true); setError(''); }}>Analisis AI</button>
    {open && <div role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !busy) setOpen(false); }}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,.58)', display: 'grid', placeItems: 'center', padding: 16 }}>
      <section role="dialog" aria-modal="true" aria-labelledby="ai-case-title"
        style={{ width: 'min(720px, 100%)', maxHeight: '90vh', overflowY: 'auto', background: 'var(--panel, #fff)', color: 'var(--text, #172033)', borderRadius: 18, padding: 24, boxShadow: '0 24px 80px rgba(0,0,0,.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
          <div><span className="eyebrow">AI KELAS+ · GURU</span><h2 id="ai-case-title" style={{ margin: '8px 0' }}>Analisis kasus pembelajaran</h2><p style={{ margin: 0, opacity: .75 }}>Kasus terpilih: <strong>{studentName}</strong></p></div>
          <button type="button" className="icon-button" aria-label="Tutup analisis" disabled={busy} onClick={() => setOpen(false)}><X size={18}/></button>
        </div>
        {!result && <form onSubmit={submit} style={{ marginTop: 20 }}>
          <label htmlFor={`ai-case-question-${studentId}`}>Apa yang ingin ditelaah?</label>
          <textarea id={`ai-case-question-${studentId}`} rows={4} minLength={5} maxLength={2000} required value={question}
            onChange={event => setQuestion(event.target.value)}
            placeholder="Contoh: Berdasarkan pola kehadiran dan hasil penilaian, strategi pendampingan apa yang sebaiknya saya verifikasi dan coba?" />
          <p style={{ fontSize: 12, opacity: .7 }}>Hindari menuliskan nama orang lain, NISN, nomor telepon, alamat, atau informasi keluarga. Maksimal 2.000 karakter.</p>
          {error && <div className="alert error" role="alert">{error}</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" className="secondary-button" disabled={busy} onClick={() => setOpen(false)}>Batal</button>
            <button type="submit" className="primary-button" disabled={busy || question.trim().length < 5}>{busy ? 'Menganalisis…' : 'Analisis dengan AI'} <Bot size={16}/></button>
          </div>
        </form>}
        {result && <article className="ai-answer" aria-live="polite" style={{ marginTop: 20 }}>
          <div className="ai-answer-title"><Bot size={18}/><strong>Hasil telaah · {result.caseReference}</strong></div>
          <div className="ai-answer-body" style={{ whiteSpace: 'pre-wrap' }}>{result.answer}</div>
          <div className="ai-answer-meta">Kuota AI: {result.usage.monthlyUsed}/{result.usage.monthlyLimit} · Model: {result.model}</div>
          <div className="ai-privacy-note"><ShieldCheck size={16}/><span>{result.privacy} Verifikasi semua rekomendasi dengan konteks langsung sebelum mengambil keputusan.</span></div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}><button type="button" className="primary-button" onClick={() => { setResult(null); setQuestion(''); }}>Tutup hasil</button></div>
        </article>}
        {!result && <div className="ai-privacy-note" style={{ marginTop: 16 }}><ShieldCheck size={16}/><span>AI menerima ringkasan presensi dan nilai terpublikasi dalam bentuk pseudonim. Nama dan ID internal tidak dikirim. Catatan bebas serta data keluarga tidak digunakan. Hasil bukan diagnosis dan keputusan akhir tetap pada guru.</span></div>}
      </section>
    </div>}
  </>;
}
