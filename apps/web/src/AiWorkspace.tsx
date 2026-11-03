import { useState, type FormEvent } from 'react';
import { Bot, Send, ShieldCheck, Sparkles } from 'lucide-react';
import { api, ApiError } from './api';

type Capability = 'teacher_assistant' | 'leadership_insights';
type AiResponse = {
  answer: string;
  usage: { monthlyUsed: number; monthlyLimit: number };
  model: string;
};

export default function AiWorkspace({ role }: { role: string }) {
  const isAdmin = role === 'SCHOOL_ADMIN';
  const initialCapability: Capability = role === 'SCHOOL_LEADER' ? 'leadership_insights' : 'teacher_assistant';
  const [capability, setCapability] = useState<Capability>(initialCapability);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<AiResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!['TEACHER', 'SCHOOL_LEADER', 'SCHOOL_ADMIN'].includes(role)) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const prompt = question.trim();
    if (prompt.length < 5 || prompt.length > 3000 || busy) return;
    setBusy(true);
    setError('');
    setAnswer(null);
    try {
      const path = capability === 'teacher_assistant'
        ? '/ai/teacher/assistant'
        : '/ai/leadership/insights';
      const result = await api<AiResponse>(path, {
        method: 'POST',
        body: JSON.stringify({ question: prompt }),
      });
      setAnswer(result);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 403) {
        setError('Fitur ini belum tersedia untuk peran atau paket sekolah Anda. Hubungi Super Admin untuk memeriksa pengaturan paket.');
      } else if (cause instanceof ApiError && cause.status === 503) {
        setError('Layanan AI belum dikonfigurasi. Silakan hubungi administrator platform.');
      } else {
        setError(cause instanceof Error ? cause.message : 'Asisten AI belum dapat menjawab. Silakan coba kembali.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="ai-workspace panel" aria-labelledby="ai-workspace-title">
      <div className="ai-workspace-heading">
        <div className="ai-workspace-icon"><Sparkles size={20}/></div>
        <div>
          <span className="eyebrow">AI KELAS+</span>
          <h2 id="ai-workspace-title">{capability === 'teacher_assistant' ? 'Asisten pembelajaran guru' : 'Insight pimpinan sekolah'}</h2>
          <p>{capability === 'teacher_assistant'
            ? 'Dapatkan ide strategi mengajar dan tindak lanjut berdasarkan ringkasan kelas yang Anda ampu.'
            : 'Tinjau pola akademik sekolah dan susun prioritas tindak lanjut berbasis data agregat.'}</p>
        </div>
      </div>
      {isAdmin && (
        <label className="ai-capability-select">Mode bantuan
          <select value={capability} onChange={event => { setCapability(event.target.value as Capability); setAnswer(null); setError(''); }}>
            <option value="teacher_assistant">Asisten pembelajaran guru</option>
            <option value="leadership_insights">Insight pimpinan sekolah</option>
          </select>
        </label>
      )}
      <form className="ai-prompt-form" onSubmit={submit}>
        <label htmlFor="kelasplus-ai-question">Apa yang ingin Anda konsultasikan?</label>
        <textarea id="kelasplus-ai-question" rows={4} minLength={5} maxLength={3000}
          value={question} onChange={event => setQuestion(event.target.value)}
          placeholder={capability === 'teacher_assistant'
            ? 'Contoh: Bagaimana strategi pembelajaran untuk meningkatkan partisipasi siswa dalam speaking?'
            : 'Contoh: Berdasarkan ringkasan kehadiran dan hasil belajar, apa prioritas monitoring sekolah bulan ini?'}
          required />
        <div className="ai-prompt-footer">
          <span>{question.length.toLocaleString('id-ID')}/3.000 karakter</span>
          <button className="primary-button" type="submit" disabled={busy || question.trim().length < 5 || question.length > 3000}>
            {busy ? 'Menyusun jawaban…' : 'Tanyakan kepada AI'} {busy ? <Bot size={16}/> : <Send size={16}/>}
          </button>
        </div>
      </form>
      {error && <div className="alert error" role="alert">{error}</div>}
      {answer && <article className="ai-answer" aria-live="polite">
        <div className="ai-answer-title"><Bot size={18}/><strong>Jawaban KELAS+ AI</strong></div>
        <div className="ai-answer-body">{answer.answer}</div>
        <div className="ai-answer-meta">Penggunaan bulan ini: {answer.usage.monthlyUsed}/{answer.usage.monthlyLimit} · Model: {answer.model}</div>
      </article>}
      <div className="ai-privacy-note"><ShieldCheck size={16}/><span>AI menggunakan ringkasan data agregat sesuai peran. Jangan masukkan nama siswa, NISN, nomor telepon, atau informasi pribadi. Rekomendasi AI wajib diverifikasi oleh guru atau pimpinan.</span></div>
    </section>
  );
}
