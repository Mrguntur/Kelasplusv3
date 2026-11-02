import { useEffect, useState, type FormEvent } from 'react';
import { ArrowRight, CheckCircle2, Eye, EyeOff, GraduationCap, LockKeyhole, ShieldCheck } from 'lucide-react';
import { api, ApiError } from './api';

type Preview = { email: string; displayName: string; schoolName: string; expiresAt: string };

export default function TeacherInvitationAcceptance() {
  const token = new URLSearchParams(window.location.search).get('token') ?? '';
  const [preview, setPreview] = useState<Preview | null>(null);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (!token) { setError('Tautan undangan tidak lengkap. Minta tautan baru kepada administrator sekolah.'); return; }
    let active = true;
    api<Preview>(`/auth/teacher-invitations/preview?token=${encodeURIComponent(token)}`)
      .then(data => { if (active) setPreview(data); })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(cause instanceof ApiError && cause.status === 404
          ? 'Undangan tidak ditemukan, sudah dicabut, atau tidak lagi berlaku.'
          : cause instanceof Error ? cause.message : 'Undangan belum dapat diverifikasi.');
      });
    return () => { active = false; };
  }, [token]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    if (password !== confirmation) { setError('Konfirmasi kata sandi belum sama.'); return; }
    if (password.length < 12) { setError('Gunakan kata sandi minimal 12 karakter.'); return; }
    setBusy(true);
    try {
      await api('/auth/teacher-invitations/accept', { method: 'POST', body: JSON.stringify({ token, password }) });
      setAccepted(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Undangan belum dapat diterima.'); }
    finally { setBusy(false); }
  }

  return <main className="invite-layout">
    <section className="invite-story">
      <div className="brand-lockup"><div className="brand-mark">K+</div><div><strong>KELAS+</strong><span>PLATFORM V2</span></div></div>
      <div className="invite-story-copy"><span className="eyebrow">AKSES GURU</span><h1>Selamat datang di ruang kerja <em>KELAS+.</em></h1><p>Gunakan satu akun untuk melihat jadwal, mengelola jurnal mengajar, dan mendukung pembelajaran.</p></div>
      <div className="invite-story-foot"><ShieldCheck size={17}/> Undangan pribadi dengan verifikasi keamanan</div>
    </section>
    <section className="invite-panel"><div className="invite-card">
      {accepted ? <>
        <div className="invite-success-icon"><CheckCircle2 size={28}/></div><span className="eyebrow">UNDANGAN DITERIMA</span><h2>Akun guru berhasil dibuat</h2>
        <p className="invite-muted">Akun Anda sudah terhubung ke sekolah sebagai Guru. Silakan masuk menggunakan email undangan dan kata sandi baru.</p>
        <a className="invite-primary" href="/app/">Lanjut ke halaman masuk <ArrowRight size={18}/></a>
      </> : <>
        <div className="invite-mobile-brand"><div className="brand-mark">K+</div><strong>KELAS+</strong></div>
        <span className="eyebrow">AKTIVASI AKUN GURU</span><h2>Terima undangan sekolah</h2>
        <p className="invite-muted">Pastikan informasi undangan benar, lalu buat kata sandi untuk mengaktifkan akun.</p>
        {preview && <div className="invite-school-card"><div className="invite-school-icon"><GraduationCap size={20}/></div><div><span>UNDANGAN UNTUK</span><strong>{preview.schoolName}</strong><small>{preview.displayName} · {preview.email}</small></div><CheckCircle2 size={18}/></div>}
        {error && <div className="alert error" role="alert">{error}</div>}
        {preview && <form className="invite-form" onSubmit={submit}>
          <label>Kata sandi baru<div className="invite-input"><LockKeyhole size={17}/><input required minLength={12} maxLength={128} autoComplete="new-password" type={showPassword ? 'text' : 'password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Minimal 12 karakter"/><button type="button" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></div></label>
          <label>Konfirmasi kata sandi<div className="invite-input"><LockKeyhole size={17}/><input required minLength={12} maxLength={128} autoComplete="new-password" type="password" value={confirmation} onChange={e=>setConfirmation(e.target.value)} placeholder="Ulangi kata sandi"/></div></label>
          <button className="invite-primary" type="submit" disabled={busy}>{busy ? 'Memproses undangan…' : 'Aktifkan akun guru'} <ArrowRight size={18}/></button>
        </form>}
        <div className="invite-security"><ShieldCheck size={16}/><span>Tautan undangan hanya dapat digunakan satu kali dan memiliki masa berlaku.</span></div>
      </>}
    </div></section>
  </main>;
}
