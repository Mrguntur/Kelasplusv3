import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock3, CreditCard, Package, RefreshCw, Sparkles } from 'lucide-react';
import { api } from './api';

type AddonPack = {
  id: string; code: string; name: string; description: string | null;
  requestUnits: number; priceAmount: string | number; currency: string; expiresAfterDays: number | null;
};
type Purchase = {
  id: string; packId: string; requestUnits: number; priceAmount: string | number;
  currency: string; status: 'PENDING' | 'PAID' | 'FAILED' | 'CANCELED' | 'EXPIRED' | 'REFUNDED' | string;
  expiresAt: string | null; paidAt: string | null; createdAt: string;
  pack?: { name: string; code: string } | null;
};
type PurchaseResponse = { totalAvailable: number; purchases: Purchase[] };
type CreatePurchaseResponse = { purchase: Purchase; reused: boolean; paymentRequired: boolean };
type CheckoutResponse = { purchaseId: string; orderId: string; token: string | null; redirectUrl: string; environment: 'sandbox' | 'production'; reused: boolean };

const statusLabels: Record<string, string> = {
  PENDING: 'Menunggu pembayaran', PAID: 'Lunas', FAILED: 'Gagal',
  CANCELED: 'Dibatalkan', EXPIRED: 'Kedaluwarsa', REFUNDED: 'Dikembalikan',
};
const money = (amount: string | number, currency: string) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(amount));

export default function AiAddonStore() {
  const [packs, setPacks] = useState<AddonPack[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [totalAvailable, setTotalAvailable] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyPack, setBusyPack] = useState('');
  const [busyPurchase, setBusyPurchase] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [availablePacks, balance] = await Promise.all([
        api<AddonPack[]>('/billing/ai-addons/packs'),
        api<PurchaseResponse>('/billing/ai-addons/purchases'),
      ]);
      setPacks(availablePacks);
      setPurchases(balance.purchases ?? []);
      setTotalAvailable(balance.totalAvailable ?? 0);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Informasi paket kuota AI belum dapat dimuat.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function buy(pack: AddonPack) {
    if (busyPack) return;
    setBusyPack(pack.id); setError(''); setNotice('');
    try {
      const idempotencyKey = globalThis.crypto?.randomUUID?.() ??
        `kelasplus-ai-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const created = await api<CreatePurchaseResponse>('/billing/ai-addons/purchases', {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify({ packId: pack.id }),
      });
      const purchaseId = created.purchase.id;
      setNotice('Pesanan berhasil dibuat. Menghubungkan ke pembayaran Midtrans…');
      const checkout = await api<CheckoutResponse>(`/billing/ai-addons/purchases/${purchaseId}/checkout`, { method: 'POST' });
      if (!checkout.redirectUrl) throw new Error('Tautan pembayaran belum tersedia. Perbarui status pesanan sebelum mencoba lagi.');
      window.location.assign(checkout.redirectUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Pesanan belum dapat diproses.');
      await load();
    } finally { setBusyPack(''); }
  }

  async function reconcile(purchaseId: string) {
    if (busyPurchase) return;
    setBusyPurchase(purchaseId); setError(''); setNotice('');
    try {
      const result = await api<{ purchaseStatus?: string; reconciled?: boolean; reason?: string }>(
        `/billing/ai-addons/purchases/${purchaseId}/reconcile`, { method: 'POST' },
      );
      setNotice(result.purchaseStatus === 'PAID'
        ? 'Pembayaran terverifikasi. Kuota add-on sudah masuk ke saldo sekolah.'
        : result.reason === 'CHECKOUT_NOT_CREATED'
          ? 'Checkout belum dibuat. Silakan lanjutkan pembayaran dari pesanan.'
          : 'Status pembayaran diperiksa. Jika pembayaran baru saja dilakukan, tunggu sebentar lalu perbarui kembali.');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Status pembayaran belum dapat diverifikasi.');
    } finally { setBusyPurchase(''); }
  }

  async function continuePayment(purchase: Purchase) {
    setBusyPurchase(purchase.id); setError(''); setNotice('');
    try {
      const checkout = await api<CheckoutResponse>(`/billing/ai-addons/purchases/${purchase.id}/checkout`, { method: 'POST' });
      if (!checkout.redirectUrl) throw new Error('Tautan pembayaran belum tersedia.');
      window.location.assign(checkout.redirectUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Checkout belum dapat dibuka.');
    } finally { setBusyPurchase(''); }
  }

  return (
    <div className="ai-addon-store">
      <section className="ai-addon-hero">
        <div className="ai-addon-hero-icon"><Sparkles size={23}/></div>
        <div><span className="eyebrow">AI USAGE · SCHOOL ADD-ON</span><h1>Kuota AI tambahan</h1>
          <p>Tambah kapasitas penggunaan AI sekolah ketika kuota paket utama sudah digunakan.</p></div>
        <div className="ai-addon-balance"><span>Saldo add-on tersedia</span><strong>{totalAvailable.toLocaleString('id-ID')}</strong><small>permintaan AI</small></div>
      </section>

      {error && <div className="alert error" role="alert"><AlertCircle size={17}/>{error}</div>}
      {notice && <div className="alert success" role="status"><CheckCircle2 size={17}/>{notice}</div>}

      <section className="panel">
        <div className="panel-heading"><div><span className="eyebrow">PILIH KEBUTUHAN</span><h2>Paket kuota tersedia</h2></div>
          <button className="secondary-button compact-button" type="button" onClick={() => void load()} disabled={loading}><RefreshCw size={15}/> Perbarui</button>
        </div>
        <p className="ai-addon-intro">Pembelian hanya dapat dilakukan oleh Admin Sekolah. Kuota baru aktif setelah pembayaran diverifikasi oleh Midtrans.</p>
        {loading ? <div className="academic-empty">Memuat paket kuota…</div> : packs.length ? <div className="ai-addon-pack-grid">
          {packs.map(pack => <article className="ai-addon-pack-card" key={pack.id}>
            <div className="ai-addon-pack-icon"><Package size={19}/></div>
            <span className="eyebrow">{pack.code}</span><h3>{pack.name}</h3>
            <p>{pack.description || 'Paket permintaan AI tambahan untuk sekolah.'}</p>
            <strong className="ai-addon-price">{money(pack.priceAmount, pack.currency)}</strong>
            <div className="ai-addon-unit-count">{pack.requestUnits.toLocaleString('id-ID')} <span>permintaan AI</span></div>
            <small className="ai-addon-expiry">{pack.expiresAfterDays ? `Berlaku ${pack.expiresAfterDays} hari setelah pembayaran` : 'Tidak memiliki masa kedaluwarsa paket'}</small>
            <button className="primary-button" type="button" disabled={Boolean(busyPack) || loading} onClick={() => void buy(pack)}>
              <CreditCard size={16}/>{busyPack === pack.id ? 'Menyiapkan pembayaran…' : 'Beli paket'}
            </button>
          </article>)}
        </div> : <div className="empty-state compact"><Package size={24}/><strong>Belum ada paket yang tersedia</strong><p>Administrator platform belum memublikasikan paket add-on AI.</p></div>}
      </section>

      <section className="panel ai-addon-history">
        <div className="panel-heading"><div><span className="eyebrow">RIWAYAT TRANSAKSI</span><h2>Pesanan kuota AI</h2></div><span className="count-pill">{purchases.length} pesanan</span></div>
        {purchases.length ? <div className="ai-addon-purchase-list">{purchases.map(purchase => <article className="ai-addon-purchase-row" key={purchase.id}>
          <div className="ai-addon-purchase-icon"><Clock3 size={18}/></div>
          <div className="ai-addon-purchase-copy"><strong>{purchase.pack?.name || 'Paket kuota AI'}</strong>
            <span>{purchase.requestUnits.toLocaleString('id-ID')} permintaan · {money(purchase.priceAmount, purchase.currency)} · {new Date(purchase.createdAt).toLocaleDateString('id-ID')}</span>
          </div>
          <span className={`status-badge ${purchase.status === 'PAID' ? 'status-active' : purchase.status === 'PENDING' ? 'status-pending' : ''}`}>{statusLabels[purchase.status] ?? purchase.status}</span>
          {purchase.status === 'PENDING' && <div className="ai-addon-purchase-actions">
            <button className="secondary-button compact-button" type="button" disabled={Boolean(busyPurchase)} onClick={() => void continuePayment(purchase)}>Lanjut bayar</button>
            <button className="secondary-button compact-button" type="button" disabled={Boolean(busyPurchase)} onClick={() => void reconcile(purchase.id)}>{busyPurchase === purchase.id ? 'Memeriksa…' : 'Periksa pembayaran'}</button>
          </div>}
        </article>)}</div> : <div className="empty-state compact"><Clock3 size={23}/><strong>Belum ada transaksi</strong><p>Pesanan kuota AI sekolah akan tercatat di sini.</p></div>}
      </section>
      <p className="panel-footnote">Saldo add-on terpisah dari kuota bawaan paket langganan. Sistem menggunakan kuota bawaan terlebih dahulu, lalu kuota add-on sesuai urutan kedaluwarsa. Pembayaran yang belum terverifikasi tidak menambah saldo.</p>
    </div>
  );
}
