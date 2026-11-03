import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Check, Package, Pencil, Plus, RefreshCw, Sparkles, X } from 'lucide-react';
import { api } from './api';

type PlanFeatures = Record<string, unknown>;
type Plan = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  billingInterval: 'MONTHLY' | 'YEARLY';
  priceAmount: string | number;
  currency: string;
  maxUsers: number | null;
  maxStudents: number | null;
  maxClasses: number | null;
  features: PlanFeatures;
  isPublished: boolean;
};

type PlanForm = {
  code: string;
  name: string;
  description: string;
  billingInterval: 'MONTHLY' | 'YEARLY';
  priceAmount: string;
  maxUsers: string;
  maxStudents: string;
  maxClasses: string;
  aiAssistant: boolean;
  aiTeacherMonthlyRequests: string;
  aiLeadershipInsights: boolean;
  aiLeadershipMonthlyRequests: string;
};

const tierLabels: Record<string, string> = {
  RINTISAN: 'Rintisan',
  GROWTH: 'Berkembang',
  UNGGULAN: 'Unggulan',
};
const tierCodes = ['RINTISAN', 'GROWTH', 'UNGGULAN'];

const emptyForm: PlanForm = {
  code: 'RINTISAN',
  name: '',
  description: '',
  billingInterval: 'MONTHLY',
  priceAmount: '0',
  maxUsers: '',
  maxStudents: '',
  maxClasses: '',
  aiAssistant: false,
  aiTeacherMonthlyRequests: '0',
  aiLeadershipInsights: false,
  aiLeadershipMonthlyRequests: '0',
};

function numericFeature(features: PlanFeatures, key: string): string {
  const value = features[key];
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : '0';
}

function nullableLimit(value: string): number | null {
  if (!value.trim()) return null;
  return Number(value);
}

function buildFeatures(form: PlanForm, existing: PlanFeatures = {}): PlanFeatures {
  const aiAllowed = form.code !== 'RINTISAN';
  return {
    ...existing,
    aiAssistant: aiAllowed && form.aiAssistant,
    aiTeacherMonthlyRequests: aiAllowed && form.aiAssistant ? Number(form.aiTeacherMonthlyRequests) : 0,
    aiLeadershipInsights: aiAllowed && form.aiLeadershipInsights,
    aiLeadershipMonthlyRequests: aiAllowed && form.aiLeadershipInsights ? Number(form.aiLeadershipMonthlyRequests) : 0,
  };
}

function formatPrice(amount: string | number, currency: string, interval: Plan['billingInterval']): string {
  const formatted = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Number(amount));
  return formatted + (interval === 'MONTHLY' ? ' / bulan' : ' / tahun');
}

export default function PlanManagement({ onChanged }: { onChanged: () => Promise<void> }) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [form, setForm] = useState<PlanForm>(emptyForm);

  const availableCodes = useMemo(
    () => tierCodes.filter(code => !plans.some(plan => plan.code === code)),
    [plans],
  );

  async function loadPlans() {
    setLoading(true);
    setError('');
    try {
      setPlans(await api<Plan[]>('/billing/admin/plans'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Daftar paket belum dapat dimuat.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadPlans(); }, []);

  function startCreate() {
    setEditingPlan(null);
    setForm({ ...emptyForm, code: availableCodes[0] ?? 'RINTISAN', name: tierLabels[availableCodes[0] ?? 'RINTISAN'] });
    setShowForm(true);
    setError('');
    setNotice('');
  }

  function startEdit(plan: Plan) {
    const features = plan.features && typeof plan.features === 'object' ? plan.features : {};
    setEditingPlan(plan);
    setForm({
      code: plan.code,
      name: plan.name,
      description: plan.description ?? '',
      billingInterval: plan.billingInterval,
      priceAmount: String(plan.priceAmount),
      maxUsers: plan.maxUsers === null ? '' : String(plan.maxUsers),
      maxStudents: plan.maxStudents === null ? '' : String(plan.maxStudents),
      maxClasses: plan.maxClasses === null ? '' : String(plan.maxClasses),
      aiAssistant: features.aiAssistant === true,
      aiTeacherMonthlyRequests: numericFeature(features, 'aiTeacherMonthlyRequests'),
      aiLeadershipInsights: features.aiLeadershipInsights === true,
      aiLeadershipMonthlyRequests: numericFeature(features, 'aiLeadershipMonthlyRequests'),
    });
    setShowForm(true);
    setError('');
    setNotice('');
  }

  function updateForm<K extends keyof PlanForm>(key: K, value: PlanForm[K]) {
    setForm(current => {
      if (key === 'code' && value === 'RINTISAN') {
        return {
          ...current,
          code: value as string,
          aiAssistant: false,
          aiTeacherMonthlyRequests: '0',
          aiLeadershipInsights: false,
          aiLeadershipMonthlyRequests: '0',
        };
      }
      return { ...current, [key]: value };
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const price = Number(form.priceAmount);
    const teacherQuota = Number(form.aiTeacherMonthlyRequests);
    const leadershipQuota = Number(form.aiLeadershipMonthlyRequests);
    if (!Number.isInteger(price) || price < 0 || price > 1_000_000_000) {
      setError('Harga harus berupa bilangan bulat antara 0 dan 1.000.000.000.');
      return;
    }
    if ((form.aiAssistant && (!Number.isInteger(teacherQuota) || teacherQuota < 1)) ||
        (form.aiLeadershipInsights && (!Number.isInteger(leadershipQuota) || leadershipQuota < 1))) {
      setError('Kuota bulanan AI harus berupa bilangan bulat minimal 1 jika fitur AI diaktifkan.');
      return;
    }
    const limits = [form.maxUsers, form.maxStudents, form.maxClasses];
    if (limits.some(value => value.trim() && (!Number.isInteger(Number(value)) || Number(value) < 1))) {
      setError('Batas pengguna, siswa, dan kelas harus kosong atau bilangan bulat minimal 1.');
      return;
    }

    setSaving(true);
    setError('');
    setNotice('');
    const features = buildFeatures(form, editingPlan?.features ?? {});
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      priceAmount: price,
      currency: 'IDR',
      maxUsers: nullableLimit(form.maxUsers),
      maxStudents: nullableLimit(form.maxStudents),
      maxClasses: nullableLimit(form.maxClasses),
      features,
    };
    try {
      if (editingPlan) {
        await api<Plan>(`/billing/admin/plans/${editingPlan.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        setNotice('Paket berhasil diperbarui. Perubahan konfigurasi tersimpan.');
      } else {
        await api<Plan>('/billing/admin/plans', {
          method: 'POST',
          body: JSON.stringify({
            ...payload,
            code: form.code,
            billingInterval: form.billingInterval,
          }),
        });
        setNotice('Paket berhasil dibuat dalam status belum dipublikasikan. Periksa kembali sebelum dipublikasikan.');
      }
      setShowForm(false);
      setEditingPlan(null);
      await loadPlans();
      await onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Paket belum dapat disimpan.');
    } finally {
      setSaving(false);
    }
  }

  async function togglePublished(plan: Plan) {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await api<Plan>(`/billing/admin/plans/${plan.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isPublished: !plan.isPublished }),
      });
      setNotice(plan.isPublished ? 'Paket berhasil disembunyikan dari katalog.' : 'Paket berhasil dipublikasikan dan dapat dipilih untuk langganan baru.');
      await loadPlans();
      await onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Status publikasi paket belum dapat diubah.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel plan-management-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">PACKAGE MANAGEMENT</span>
          <h2>Kelola paket KELAS+</h2>
        </div>
        <div className="plan-management-actions">
          <button className="secondary-button compact-button" type="button" onClick={() => void loadPlans()} disabled={loading || saving}>
            <RefreshCw size={15}/> Perbarui
          </button>
          <button className="primary-button compact-button" type="button" onClick={startCreate} disabled={loading || saving || availableCodes.length === 0}>
            <Plus size={15}/> Paket baru
          </button>
        </div>
      </div>

      <p className="plan-management-intro">Atur harga, batas penggunaan, dan fitur setiap paket. Paket baru dibuat sebagai draft dan baru dapat dipilih sekolah setelah dipublikasikan.</p>
      {error && <div className="alert error" role="alert">{error}</div>}
      {notice && <div className="alert success" role="status">{notice}</div>}

      {loading ? <div className="academic-empty">Memuat konfigurasi paket…</div>
        : plans.length ? <div className="plan-management-grid">
          {plans.map(plan => {
            const features = plan.features ?? {};
            const aiTeacher = features.aiAssistant === true;
            const aiLeader = features.aiLeadershipInsights === true;
            return (
              <article className="plan-management-card" key={plan.id}>
                <div className="plan-management-card-top">
                  <div className="plan-management-icon"><Package size={19}/></div>
                  <span className={`status-badge ${plan.isPublished ? 'status-active' : 'status-pending'}`}>{plan.isPublished ? 'Dipublikasikan' : 'Draft'}</span>
                </div>
                <span className="eyebrow">{tierLabels[plan.code] ?? plan.code} · {plan.code}</span>
                <h3>{plan.name}</h3>
                <p className="plan-management-description">{plan.description || 'Belum ada deskripsi paket.'}</p>
                <strong className="plan-management-price">{formatPrice(plan.priceAmount, plan.currency, plan.billingInterval)}</strong>
                <div className="plan-management-limits">
                  <span>{plan.maxUsers ?? '∞'} pengguna</span>
                  <span>{plan.maxStudents ?? '∞'} siswa</span>
                  <span>{plan.maxClasses ?? '∞'} kelas</span>
                </div>
                <div className="plan-management-ai">
                  <span><Sparkles size={14}/> Asisten guru: {aiTeacher ? `Aktif · ${numericFeature(features, 'aiTeacherMonthlyRequests')}/bulan` : 'Tidak aktif'}</span>
                  <span><Sparkles size={14}/> Insight pimpinan: {aiLeader ? `Aktif · ${numericFeature(features, 'aiLeadershipMonthlyRequests')}/bulan` : 'Tidak aktif'}</span>
                </div>
                <div className="plan-management-card-actions">
                  <button className="secondary-button compact-button" type="button" onClick={() => startEdit(plan)} disabled={saving}><Pencil size={14}/> Edit</button>
                  <button className={`compact-button ${plan.isPublished ? 'secondary-button' : 'primary-button'}`} type="button" onClick={() => void togglePublished(plan)} disabled={saving}>
                    {plan.isPublished ? <><X size={14}/> Sembunyikan</> : <><Check size={14}/> Publikasikan</>}
                  </button>
                </div>
              </article>
            );
          })}
        </div> : <div className="empty-state compact"><Package size={24}/><strong>Belum ada paket</strong><p>Buat paket Rintisan, Berkembang, atau Unggulan untuk mulai mengatur langganan sekolah.</p></div>}

      {availableCodes.length === 0 && !showForm && <p className="panel-footnote">Ketiga paket sudah dibuat. Gunakan tombol Edit untuk mengubah konfigurasi paket yang tersedia.</p>}

      {showForm && (
        <form className="plan-management-form" onSubmit={event => void submit(event)}>
          <div className="plan-management-form-heading">
            <div>
              <span className="eyebrow">{editingPlan ? 'EDIT PACKAGE' : 'NEW PACKAGE'}</span>
              <h3>{editingPlan ? `Ubah paket ${tierLabels[editingPlan.code] ?? editingPlan.code}` : 'Buat paket baru'}</h3>
            </div>
            <button className="icon-button" type="button" aria-label="Tutup formulir paket" onClick={() => { setShowForm(false); setEditingPlan(null); }} disabled={saving}><X size={17}/></button>
          </div>
          <div className="plan-form-grid">
            {!editingPlan && <label>Kategori paket
              <select value={form.code} onChange={event => updateForm('code', event.target.value)}>
                {availableCodes.map(code => <option value={code} key={code}>{tierLabels[code]} ({code})</option>)}
              </select>
            </label>}
            <label>Nama paket
              <input value={form.name} onChange={event => updateForm('name', event.target.value)} minLength={2} maxLength={120} required/>
            </label>
            <label>Periode tagihan
              <select value={form.billingInterval} onChange={event => updateForm('billingInterval', event.target.value as PlanForm['billingInterval'])} disabled={Boolean(editingPlan)}>
                <option value="MONTHLY">Bulanan</option>
                <option value="YEARLY">Tahunan</option>
              </select>
            </label>
            <label>Harga (Rupiah)
              <input type="number" min="0" max="1000000000" step="1" value={form.priceAmount} onChange={event => updateForm('priceAmount', event.target.value)} required/>
            </label>
            <label>Batas pengguna
              <input type="number" min="1" step="1" value={form.maxUsers} onChange={event => updateForm('maxUsers', event.target.value)} placeholder="Kosong = tanpa batas"/>
            </label>
            <label>Batas siswa
              <input type="number" min="1" step="1" value={form.maxStudents} onChange={event => updateForm('maxStudents', event.target.value)} placeholder="Kosong = tanpa batas"/>
            </label>
            <label>Batas kelas
              <input type="number" min="1" step="1" value={form.maxClasses} onChange={event => updateForm('maxClasses', event.target.value)} placeholder="Kosong = tanpa batas"/>
            </label>
            <label className="plan-form-wide">Deskripsi paket
              <textarea rows={2} maxLength={500} value={form.description} onChange={event => updateForm('description', event.target.value)} placeholder="Ringkasan manfaat dan sasaran paket"/>
            </label>
          </div>

          <div className="plan-ai-config">
            <div className="plan-ai-config-heading">
              <div><span className="eyebrow">AI ENTITLEMENTS</span><strong>Fitur kecerdasan buatan</strong></div>
              {form.code === 'RINTISAN' && <span className="plan-ai-locked">AI tidak tersedia pada Rintisan</span>}
            </div>
            <div className="plan-ai-config-grid">
              <label className="plan-ai-toggle">
                <input type="checkbox" checked={form.aiAssistant} disabled={form.code === 'RINTISAN'} onChange={event => updateForm('aiAssistant', event.target.checked)}/>
                <span><strong>AI Assistant guru</strong><small>Membantu strategi pembelajaran dan tindak lanjut kelas.</small></span>
              </label>
              <label>Kuota AI guru / bulan
                <input type="number" min="1" max="100000" step="1" value={form.aiTeacherMonthlyRequests} disabled={!form.aiAssistant || form.code === 'RINTISAN'} onChange={event => updateForm('aiTeacherMonthlyRequests', event.target.value)}/>
              </label>
              <label className="plan-ai-toggle">
                <input type="checkbox" checked={form.aiLeadershipInsights} disabled={form.code === 'RINTISAN'} onChange={event => updateForm('aiLeadershipInsights', event.target.checked)}/>
                <span><strong>AI Insights pimpinan</strong><small>Menganalisis ringkasan sekolah dan prioritas monitoring.</small></span>
              </label>
              <label>Kuota AI pimpinan / bulan
                <input type="number" min="1" max="100000" step="1" value={form.aiLeadershipMonthlyRequests} disabled={!form.aiLeadershipInsights || form.code === 'RINTISAN'} onChange={event => updateForm('aiLeadershipMonthlyRequests', event.target.value)}/>
              </label>
            </div>
            <p className="panel-footnote">Aturan produk: API tetap memblokir AI pada Rintisan, meskipun konfigurasi paket keliru. AI hanya dapat aktif pada Berkembang dan Unggulan dengan kuota positif.</p>
          </div>

          <div className="form-actions">
            <button className="secondary-button" type="button" onClick={() => { setShowForm(false); setEditingPlan(null); }} disabled={saving}>Batal</button>
            <button className="primary-button" type="submit" disabled={saving}>{saving ? 'Menyimpan…' : editingPlan ? 'Simpan perubahan' : 'Buat paket draft'}</button>
          </div>
        </form>
      )}
    </section>
  );
}
