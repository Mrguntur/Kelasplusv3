import { useEffect, useState, type FormEvent } from 'react';
import { Activity, Building2, CheckCircle2, Clock3, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';
import { api } from './api';

type PlatformOverview = {
  generatedAt: string;
  metrics: {
    totalSchools: number;
    activeSchools: number;
    pendingSchools: number;
    suspendedSchools: number;
    pendingRegistrations: number;
    approvedRegistrations: number;
    rejectedRegistrations: number;
  };
  schools: Array<{
    id: string;
    slug: string;
    name: string;
    status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
    createdAt: string;
    usage: { members: number; students: number; classes: number };
  }>;
};

type Registration = {
  id: string;
  schoolName: string;
  requestedSlug: string;
  contactName: string;
  email: string;
  phone?: string | null;
  status: string;
  createdAt: string;
};

type Plan = {
  id: string;
  code: string;
  name: string;
  billingInterval: 'MONTHLY' | 'YEARLY';
  priceAmount: string | number;
  currency: string;
};

type Subscription = {
  id: string;
  status: 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'EXPIRED';
  billingInterval: 'MONTHLY' | 'YEARLY';
  priceAmount: string | number;
  currency: string;
  currentPeriodEnd: string;
  trialEndsAt: string | null;
  school: { id: string; name: string; slug: string };
  plan: { id: string; code: string; name: string };
};

const statusLabels: Record<string, string> = {
  ACTIVE: 'Aktif', PENDING: 'Menunggu', SUSPENDED: 'Ditangguhkan', CLOSED: 'Ditutup',
  TRIALING: 'Trial', PAST_DUE: 'Menunggak', CANCELED: 'Dibatalkan', EXPIRED: 'Kedaluwarsa',
};

export default function PlatformAdminDashboard({ onLogout }: { onLogout: () => void }) {
  const [overview, setOverview] = useState<PlatformOverview | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [trialSchoolId, setTrialSchoolId] = useState('');
  const [trialPlanId, setTrialPlanId] = useState('');
  const [trialDays, setTrialDays] = useState(14);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function refresh() {
    setBusy(true);
    setError('');
    try {
      const [summary, requests, publishedPlans, currentSubscriptions] = await Promise.all([
        api<PlatformOverview>('/schools/admin/overview'),
        api<Registration[]>('/schools/admin/registration-requests'),
        api<Plan[]>('/billing/plans'),
        api<Subscription[]>('/billing/admin/subscriptions'),
      ]);
      setOverview(summary);
      setRegistrations(requests);
      setPlans(publishedPlans);
      setSubscriptions(currentSubscriptions);
      setTrialSchoolId(current => current || summary.schools[0]?.id || '');
      setTrialPlanId(current => current || publishedPlans[0]?.id || '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Dashboard platform belum dapat dimuat.');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { void refresh(); }, []);

  async function review(id: string, action: 'approve' | 'reject') {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (action === 'approve') {
        await api(`/schools/admin/registration-requests/${id}/approve`, { method: 'POST' });
      } else {
        await api(`/schools/admin/registration-requests/${id}/reject`, {
          method: 'POST',
          body: JSON.stringify({ reason: 'Belum memenuhi persyaratan verifikasi platform.' }),
        });
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Permohonan belum dapat diproses.');
      setBusy(false);
    }
  }

  async function assignTrial(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api('/billing/admin/subscriptions/trial', {
        method: 'POST',
        body: JSON.stringify({ schoolId: trialSchoolId, planId: trialPlanId, trialDays }),
      });
      setNotice('Masa uji coba berhasil diberikan dan tercatat pada audit log.');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Masa uji coba belum dapat diberikan.');
      setBusy(false);
    }
  }


  async function expireTrials() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await api<{ processed: number; expired: number }>('/billing/admin/subscriptions/expire-trials', { method: 'POST' });
      setNotice(`Pemeriksaan selesai: ${result.processed} trial diperiksa, ${result.expired} trial kedaluwarsa.`);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Pemeriksaan masa trial belum dapat dilakukan.');
      setBusy(false);
    }
  }

  return <main className="platform-admin-page">
    <header className="platform-admin-header">
      <div className="brand-lockup"><div className="brand-mark">K+</div><div><strong>KELAS+</strong><span>PLATFORM CONTROL CENTER</span></div></div>
      <div className="platform-admin-actions">
        <span className="platform-admin-identity"><ShieldCheck size={16}/> Super Admin</span>
        <button className="secondary-button" onClick={() => void refresh()} disabled={busy}><RefreshCw size={16}/> Perbarui</button>
        <button className="text-button" onClick={onLogout}>Keluar</button>
      </div>
    </header>
    <section className="platform-admin-intro">
      <span className="eyebrow">PUSAT KENDALI PLATFORM</span>
      <h1>Ekosistem KELAS+</h1>
      <p>Monitor sekolah, tinjau pendaftaran, dan kelola pertumbuhan platform dari satu tempat.</p>
    </section>
    {error && <div className="alert error" role="alert">{error}</div>}
    {notice && <div className="alert success" role="status">{notice}</div>}
    <section className="platform-metrics">
      {[
        { label: 'Total sekolah', value: overview?.metrics.totalSchools, icon: Building2 },
        { label: 'Sekolah aktif', value: overview?.metrics.activeSchools, icon: CheckCircle2 },
        { label: 'Menunggu aktivasi', value: overview?.metrics.pendingSchools, icon: Clock3 },
        { label: 'Sekolah ditangguhkan', value: overview?.metrics.suspendedSchools, icon: XCircle },
      ].map(item => <article className="metric-card" key={item.label}><div className="metric-top"><span>{item.label}</span><div className="metric-icon"><item.icon size={19}/></div></div><div className="metric-value">{item.value ?? '—'}</div><div className="metric-foot">Data seluruh tenant</div></article>)}
    </section>
    <section className="platform-admin-grid">
      <article className="panel">
        <div className="panel-heading"><div><span className="eyebrow">ONBOARDING</span><h2>Permohonan sekolah</h2></div><span className="count-pill">{overview?.metrics.pendingRegistrations ?? 0} menunggu</span></div>
        {registrations.length ? <div className="platform-registration-list">{registrations.map(item => <div className="platform-registration" key={item.id}>
          <div><strong>{item.schoolName}</strong><span>{item.contactName} · {item.email}</span><small>Slug: {item.requestedSlug}</small></div>
          <div className="platform-registration-actions"><button className="primary-button compact-button" disabled={busy} onClick={() => void review(item.id, 'approve')}>Setujui</button><button className="secondary-button compact-button" disabled={busy} onClick={() => void review(item.id, 'reject')}>Tolak</button></div>
        </div>)}</div> : <div className="empty-state compact"><Activity size={22}/><strong>Tidak ada permohonan tertunda</strong><p>Permohonan baru akan muncul di sini.</p></div>}
      </article>
      <article className="panel">
        <div className="panel-heading"><div><span className="eyebrow">STATUS REVIEW</span><h2>Ringkasan permohonan</h2></div></div>
        <div className="platform-review-stat"><span>Disetujui</span><strong>{overview?.metrics.approvedRegistrations ?? 0}</strong></div>
        <div className="platform-review-stat"><span>Ditolak</span><strong>{overview?.metrics.rejectedRegistrations ?? 0}</strong></div>
        <p className="panel-footnote">Persetujuan membuat sekolah berstatus menunggu. Administrator sekolah tetap harus menerima undangan sebelum sekolah diaktifkan.</p>
      </article>
    </section>
    <section className="panel platform-school-panel">
      <div className="panel-heading"><div><span className="eyebrow">SUBSCRIPTION</span><h2>Berikan masa uji coba</h2></div></div>
      <form className="platform-trial-form" onSubmit={event => void assignTrial(event)}>
        <label>Sekolah
          <select value={trialSchoolId} onChange={event => setTrialSchoolId(event.target.value)} required>
            <option value="">Pilih sekolah</option>
            {overview?.schools.map(school => <option key={school.id} value={school.id}>{school.name} ({statusLabels[school.status]})</option>)}
          </select>
        </label>
        <label>Paket
          <select value={trialPlanId} onChange={event => setTrialPlanId(event.target.value)} required>
            <option value="">Pilih paket</option>
            {plans.map(plan => <option key={plan.id} value={plan.id}>{plan.name} · {plan.billingInterval === 'MONTHLY' ? 'Bulanan' : 'Tahunan'}</option>)}
          </select>
        </label>
        <label>Durasi trial (hari)
          <input type="number" min={1} max={90} value={trialDays} onChange={event => setTrialDays(Number(event.target.value))} required />
        </label>
        <button className="primary-button" type="submit" disabled={busy || !trialSchoolId || !trialPlanId || plans.length === 0}>Berikan trial</button>
      </form>
      {plans.length === 0 && <p className="panel-footnote">Belum ada paket yang dipublikasikan. Publikasikan paket terlebih dahulu sebelum memberikan trial.</p>}
      <p className="panel-footnote">Trial hanya diberikan kepada sekolah yang belum memiliki langganan berjalan. Tindakan ini tidak memproses pembayaran.</p>
    </section>

    <section className="panel platform-school-panel">
      <div className="panel-heading">
        <div><span className="eyebrow">SUBSCRIPTION MONITORING</span><h2>Status langganan sekolah</h2></div>
        <button className="secondary-button compact-button" onClick={() => void expireTrials()} disabled={busy}>Periksa trial kedaluwarsa</button>
      </div>
      <div className="platform-school-table-wrap"><table className="platform-school-table">
        <thead><tr><th>Sekolah</th><th>Paket</th><th>Status</th><th>Akhir periode</th></tr></thead>
        <tbody>{subscriptions.map(item => <tr key={item.id}>
          <td><strong>{item.school.name}</strong><small>{item.school.slug}</small></td>
          <td>{item.plan.name}</td>
          <td><span className={`status-badge status-${item.status.toLowerCase()}`}>{statusLabels[item.status]}</span></td>
          <td>{new Date(item.trialEndsAt ?? item.currentPeriodEnd).toLocaleDateString('id-ID')}</td>
        </tr>)}</tbody>
      </table></div>
      {!subscriptions.length && <div className="empty-state compact"><strong>Belum ada langganan</strong><p>Trial atau langganan sekolah akan muncul di sini.</p></div>}
      <p className="panel-footnote">Pemeriksaan trial saat ini dijalankan secara manual oleh Super Admin. Belum ada scheduler otomatis.</p>
    </section>
    <section className="panel platform-school-panel">
      <div className="panel-heading"><div><span className="eyebrow">MULTI-TENANT</span><h2>Daftar sekolah</h2></div><span className="count-pill">{overview?.schools.length ?? 0} ditampilkan</span></div>
      <div className="platform-school-table-wrap"><table className="platform-school-table"><thead><tr><th>Sekolah</th><th>Status</th><th>Pengguna</th><th>Siswa</th><th>Kelas</th></tr></thead><tbody>
        {overview?.schools.map(school => <tr key={school.id}><td><strong>{school.name}</strong><small>{school.slug}</small></td><td><span className={`status-badge status-${school.status.toLowerCase()}`}>{statusLabels[school.status] ?? school.status}</span></td><td>{school.usage.members}</td><td>{school.usage.students}</td><td>{school.usage.classes}</td></tr>)}
      </tbody></table></div>
      {!overview?.schools.length && !busy && <div className="empty-state compact"><strong>Belum ada sekolah</strong><p>Sekolah yang terdaftar akan tampil di sini.</p></div>}
    </section>
    <footer className="footer"><span>KELAS+ · Super Admin</span><span>Dashboard monitoring platform</span></footer>
  </main>;
}
