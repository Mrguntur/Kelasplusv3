import { useEffect, useState, type FormEvent } from 'react';
import { Building2, CheckCircle2, Clock3, Mail, Plus, RefreshCw, Send, ShieldCheck } from 'lucide-react';
import { api } from './api';

type Plan = { id: string; code: string; name: string; billingInterval: 'MONTHLY' | 'YEARLY' };
type OnboardingItem = {
  id: string;
  schoolName: string;
  requestedSlug: string;
  contactName: string;
  email: string;
  phone: string | null;
  reviewedAt: string | null;
  createdAt: string;
  school: {
    id: string;
    slug: string;
    name: string;
    status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
    subscription: {
      id: string;
      status: 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'EXPIRED';
      trialEndsAt: string | null;
      currentPeriodEnd: string;
      plan: { id: string; code: string; name: string };
    } | null;
    invitation: {
      id: string;
      email: string;
      expiresAt: string;
      acceptedAt: string | null;
      revokedAt: string | null;
    } | null;
  };
};

type SchoolForm = { schoolName: string; requestedSlug: string; contactName: string; email: string; phone: string };
const emptySchoolForm: SchoolForm = { schoolName: '', requestedSlug: '', contactName: '', email: '', phone: '' };

const schoolStatusLabels: Record<string, string> = {
  PENDING: 'Menunggu aktivasi',
  ACTIVE: 'Aktif',
  SUSPENDED: 'Ditangguhkan',
  CLOSED: 'Ditutup',
};
const subscriptionStatusLabels: Record<string, string> = {
  TRIALING: 'Trial aktif',
  ACTIVE: 'Langganan aktif',
  PAST_DUE: 'Menunggak',
  CANCELED: 'Dibatalkan',
  EXPIRED: 'Kedaluwarsa',
};

function hasValidSubscription(item: OnboardingItem): boolean {
  const subscription = item.school.subscription;
  if (!subscription) return false;
  const now = Date.now();
  if (subscription.status === 'ACTIVE') return new Date(subscription.currentPeriodEnd).getTime() > now;
  if (subscription.status === 'TRIALING') return Boolean(subscription.trialEndsAt && new Date(subscription.trialEndsAt).getTime() > now);
  return false;
}

function invitationLabel(item: OnboardingItem): string {
  const invitation = item.school.invitation;
  if (!invitation) return 'Belum dikirim';
  if (invitation.acceptedAt) return 'Diterima';
  if (invitation.revokedAt || new Date(invitation.expiresAt).getTime() <= Date.now()) return 'Tidak aktif';
  return 'Terkirim';
}

export default function SchoolOnboardingManager({ onChanged }: { onChanged: () => Promise<void> }) {
  const [items, setItems] = useState<OnboardingItem[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [form, setForm] = useState<SchoolForm>(emptySchoolForm);
  const [selectedPlans, setSelectedPlans] = useState<Record<string, string>>({});
  const [trialDays, setTrialDays] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busySchoolId, setBusySchoolId] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [onboarding, publishedPlans] = await Promise.all([
        api<OnboardingItem[]>('/schools/admin/onboarding'),
        api<Plan[]>('/billing/plans'),
      ]);
      setItems(onboarding);
      setPlans(publishedPlans);
      setSelectedPlans(current => {
        const next = { ...current };
        for (const item of onboarding) {
          if (!next[item.school.id] && publishedPlans[0]) next[item.school.id] = publishedPlans[0].id;
        }
        return next;
      });
      setTrialDays(current => {
        const next = { ...current };
        for (const item of onboarding) if (!next[item.school.id]) next[item.school.id] = 14;
        return next;
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Data onboarding belum dapat dimuat.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function createSchool(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const result = await api<{ school: { name: string }; requestId: string }>('/schools/admin/schools', {
        method: 'POST',
        body: JSON.stringify({
          schoolName: form.schoolName.trim(),
          requestedSlug: form.requestedSlug.trim().toLowerCase(),
          contactName: form.contactName.trim(),
          email: form.email.trim().toLowerCase(),
          ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
        }),
      });
      setForm(emptySchoolForm);
      setShowForm(false);
      setNotice(`Sekolah ${result.school.name} berhasil dibuat. Selanjutnya tetapkan trial dan undang administrator.`);
      await load();
      await onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Sekolah belum dapat dibuat.');
    } finally {
      setSaving(false);
    }
  }

  async function assignTrialAndInvite(item: OnboardingItem) {
    if (busySchoolId) return;
    setBusySchoolId(item.school.id);
    setError('');
    setNotice('');
    try {
      if (!hasValidSubscription(item)) {
        const planId = selectedPlans[item.school.id] ?? plans[0]?.id;
        if (!planId) throw new Error('Publikasikan minimal satu paket sebelum mengundang administrator.');
        await api('/billing/admin/subscriptions/trial', {
          method: 'POST',
          body: JSON.stringify({
            schoolId: item.school.id,
            planId,
            trialDays: trialDays[item.school.id] ?? 14,
          }),
        });
      }
      await api(`/schools/admin/registration-requests/${item.id}/invite-admin`, { method: 'POST' });
      setNotice(`Undangan administrator untuk ${item.school.name} berhasil dikirim.`);
      await load();
      await onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Trial atau undangan administrator belum dapat diproses.');
      // A trial may have been assigned successfully even if email delivery failed.
      await load();
      await onChanged();
    } finally {
      setBusySchoolId('');
    }
  }

  return (
    <section className="panel school-onboarding-panel">
      <div className="panel-heading">
        <div><span className="eyebrow">SCHOOL ONBOARDING</span><h2>Onboarding sekolah</h2></div>
        <div className="school-onboarding-actions">
          <button className="secondary-button compact-button" type="button" onClick={() => void load()} disabled={loading || saving || Boolean(busySchoolId)}><RefreshCw size={14}/> Perbarui</button>
          <button className="primary-button compact-button" type="button" onClick={() => { setShowForm(value => !value); setError(''); setNotice(''); }} disabled={saving}><Plus size={14}/> Sekolah manual</button>
        </div>
      </div>
      <p className="school-onboarding-intro">Buat sekolah langsung dari Control Center, tetapkan paket trial, lalu kirim undangan administrator. Permohonan yang sudah disetujui juga dapat dilanjutkan dari daftar ini.</p>
      {error && <div className="alert error" role="alert">{error}</div>}
      {notice && <div className="alert success" role="status">{notice}</div>}

      {showForm && (
        <form className="school-onboarding-form" onSubmit={event => void createSchool(event)}>
          <div className="school-onboarding-form-heading"><strong>Buat sekolah baru</strong><span>Data kontak digunakan untuk undangan administrator.</span></div>
          <div className="school-onboarding-form-grid">
            <label>Nama sekolah
              <input required minLength={3} maxLength={200} value={form.schoolName} onChange={event => setForm(current => ({ ...current, schoolName: event.target.value }))} placeholder="Contoh: SMP Negeri 2 Bajuin"/>
            </label>
            <label>Slug sekolah
              <input required minLength={3} maxLength={80} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={form.requestedSlug} onChange={event => setForm(current => ({ ...current, requestedSlug: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') }))} placeholder="smp-negeri-2-bajuin"/>
            </label>
            <label>Nama kontak administrator
              <input required minLength={2} maxLength={200} value={form.contactName} onChange={event => setForm(current => ({ ...current, contactName: event.target.value }))} placeholder="Nama calon administrator"/>
            </label>
            <label>Email administrator
              <input required type="email" maxLength={320} value={form.email} onChange={event => setForm(current => ({ ...current, email: event.target.value }))} placeholder="admin@sekolah.sch.id"/>
            </label>
            <label>Nomor telepon (opsional)
              <input maxLength={40} value={form.phone} onChange={event => setForm(current => ({ ...current, phone: event.target.value }))} placeholder="08xxxxxxxxxx"/>
            </label>
          </div>
          <div className="form-actions">
            <button className="secondary-button" type="button" onClick={() => setShowForm(false)} disabled={saving}>Batal</button>
            <button className="primary-button" type="submit" disabled={saving}>{saving ? 'Membuat sekolah…' : 'Buat sekolah'}</button>
          </div>
        </form>
      )}

      {loading ? <div className="academic-empty">Memuat daftar onboarding…</div>
        : items.length ? <div className="school-onboarding-list">
          {items.map(item => {
            const validSubscription = hasValidSubscription(item);
            const inviteState = invitationLabel(item);
            const isBusy = busySchoolId === item.school.id;
            return (
              <article className="school-onboarding-card" key={item.id}>
                <div className="school-onboarding-card-head">
                  <div className="school-onboarding-school-icon"><Building2 size={18}/></div>
                  <div className="school-onboarding-school-copy">
                    <strong>{item.school.name}</strong>
                    <span>{item.contactName} · {item.email}</span>
                    <small>{item.school.slug}</small>
                  </div>
                  <span className={`status-badge ${item.school.status === 'ACTIVE' ? 'status-active' : item.school.status === 'PENDING' ? 'status-pending' : 'status-suspended'}`}>{schoolStatusLabels[item.school.status]}</span>
                </div>
                <div className="school-onboarding-state">
                  <span><ShieldCheck size={14}/> {item.school.subscription ? `${subscriptionStatusLabels[item.school.subscription.status] ?? item.school.subscription.status} · ${item.school.subscription.plan.name}` : 'Paket belum ditetapkan'}</span>
                  <span><Mail size={14}/> Undangan: {inviteState}</span>
                  {item.school.subscription && <span><Clock3 size={14}/> Berakhir: {new Date(item.school.subscription.trialEndsAt ?? item.school.subscription.currentPeriodEnd).toLocaleDateString('id-ID')}</span>}
                </div>
                {item.school.status === 'PENDING' && (
                  <div className="school-onboarding-next-step">
                    {!validSubscription && (
                      <div className="school-onboarding-trial-controls">
                        <label>Paket trial
                          <select value={selectedPlans[item.school.id] ?? ''} onChange={event => setSelectedPlans(current => ({ ...current, [item.school.id]: event.target.value }))} disabled={plans.length === 0 || isBusy}>
                            <option value="">Pilih paket</option>
                            {plans.map(plan => <option value={plan.id} key={plan.id}>{plan.name} · {plan.billingInterval === 'MONTHLY' ? 'Bulanan' : 'Tahunan'}</option>)}
                          </select>
                        </label>
                        <label>Durasi (hari)
                          <input type="number" min={1} max={90} value={trialDays[item.school.id] ?? 14} onChange={event => setTrialDays(current => ({ ...current, [item.school.id]: Number(event.target.value) }))} disabled={isBusy}/>
                        </label>
                      </div>
                    )}
                    <button className="primary-button compact-button" type="button" onClick={() => void assignTrialAndInvite(item)} disabled={isBusy || (!validSubscription && (!plans.length || !(selectedPlans[item.school.id] ?? plans[0]?.id)))}>
                      {isBusy ? 'Memproses…' : <><Send size={14}/> {validSubscription ? inviteState === 'Terkirim' ? 'Kirim ulang undangan' : 'Kirim undangan admin' : 'Aktifkan trial & kirim undangan'}</>}
                    </button>
                  </div>
                )}
                {item.school.status === 'ACTIVE' && <p className="school-onboarding-complete"><CheckCircle2 size={15}/> Administrator telah menerima undangan dan sekolah sudah aktif.</p>}
              </article>
            );
          })}
        </div> : <div className="empty-state compact"><Building2 size={24}/><strong>Belum ada sekolah dalam proses onboarding</strong><p>Buat sekolah manual atau setujui permohonan sekolah untuk memulai proses.</p></div>}
      <p className="panel-footnote">Undangan memerlukan konfigurasi email Resend. Jika email gagal dikirim, trial yang sudah berhasil dibuat tetap tersimpan dan undangan dapat dicoba kembali setelah konfigurasi email diperbaiki.</p>
    </section>
  );
}
