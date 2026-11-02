import { useEffect, useState } from 'react';
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

const statusLabels: Record<string, string> = {
  ACTIVE: 'Aktif', PENDING: 'Menunggu', SUSPENDED: 'Ditangguhkan', CLOSED: 'Ditutup',
};

export default function PlatformAdminDashboard({ onLogout }: { onLogout: () => void }) {
  const [overview, setOverview] = useState<PlatformOverview | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');

  async function refresh() {
    setBusy(true);
    setError('');
    try {
      const [summary, requests] = await Promise.all([
        api<PlatformOverview>('/schools/admin/overview'),
        api<Registration[]>('/schools/admin/registration-requests'),
      ]);
      setOverview(summary);
      setRegistrations(requests);
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
      <div className="panel-heading"><div><span className="eyebrow">MULTI-TENANT</span><h2>Daftar sekolah</h2></div><span className="count-pill">{overview?.schools.length ?? 0} ditampilkan</span></div>
      <div className="platform-school-table-wrap"><table className="platform-school-table"><thead><tr><th>Sekolah</th><th>Status</th><th>Pengguna</th><th>Siswa</th><th>Kelas</th></tr></thead><tbody>
        {overview?.schools.map(school => <tr key={school.id}><td><strong>{school.name}</strong><small>{school.slug}</small></td><td><span className={`status-badge status-${school.status.toLowerCase()}`}>{statusLabels[school.status] ?? school.status}</span></td><td>{school.usage.members}</td><td>{school.usage.students}</td><td>{school.usage.classes}</td></tr>)}
      </tbody></table></div>
      {!overview?.schools.length && !busy && <div className="empty-state compact"><strong>Belum ada sekolah</strong><p>Sekolah yang terdaftar akan tampil di sini.</p></div>}
    </section>
    <footer className="footer"><span>KELAS+ · Super Admin</span><span>Dashboard monitoring platform</span></footer>
  </main>;
}
