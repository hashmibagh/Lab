import { useEffect, useMemo, useState } from 'react';
import { ArrowDownCircle, ArrowUpCircle, Sliders, AlertTriangle, PackageX, CalendarClock } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/ui/Modal';
import { EmptyState, TableSkeleton } from '../../components/ui/Feedback';
import { formatDateTime, daysUntil, classNames } from '../../lib/utils';

const TABS = ['Alerts', 'Stock Movements', 'Adjustments'];

export default function Inventory() {
  const { hasRole, profile } = useAuth();
  const [tab, setTab] = useState('Alerts');
  const [medicines, setMedicines] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [movementModal, setMovementModal] = useState(null); // 'in' | 'out' | 'adjustment'
  const [form, setForm] = useState({ medicine_id: '', quantity: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const canWrite = hasRole('pharmacist') || hasRole('store_keeper');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [m, t] = await Promise.all([
      supabase.from('medicines').select('*').is('deleted_at', null),
      supabase.from('stock_transactions').select('*, medicines(name)').order('created_at', { ascending: false }).limit(100)
    ]);
    setMedicines(m.data ?? []);
    setTransactions(t.data ?? []);
    setLoading(false);
  }

  const lowStock = useMemo(() => medicines.filter((m) => m.current_stock > 0 && m.current_stock <= m.minimum_stock), [medicines]);
  const outOfStock = useMemo(() => medicines.filter((m) => m.current_stock <= 0), [medicines]);
  const expiring = useMemo(() => medicines.filter((m) => {
    const d = daysUntil(m.expiry_date);
    return d !== null && d >= 0 && d <= 30;
  }), [medicines]);
  const expired = useMemo(() => medicines.filter((m) => {
    const d = daysUntil(m.expiry_date);
    return d !== null && d < 0;
  }), [medicines]);

  const openMovement = (type) => { setForm({ medicine_id: '', quantity: '', notes: '' }); setMovementModal(type); };

  const submitMovement = async () => {
    if (!form.medicine_id || !form.quantity) return toast.error('Select a medicine and quantity');
    setSaving(true);
    const med = medicines.find((m) => m.id === form.medicine_id);
    const qty = Number(form.quantity);
    const type = movementModal;
    let newStock = med.current_stock;
    if (type === 'in') newStock += qty;
    else if (type === 'out') newStock -= qty;
    else newStock = qty; // adjustment sets absolute value

    const { error: e1 } = await supabase.from('medicines').update({ current_stock: newStock }).eq('id', med.id);
    if (e1) { setSaving(false); return toast.error(e1.message); }

    const txnType = type === 'adjustment' ? 'adjustment' : type;
    const txnQty = type === 'adjustment' ? Math.abs(newStock - med.current_stock) : qty;
    await supabase.from('stock_transactions').insert({
      medicine_id: med.id, type: txnType, quantity: txnQty, notes: form.notes, created_by: profile?.id
    });
    if (type === 'adjustment') {
      await supabase.from('stock_adjustments').insert({
        medicine_id: med.id, previous_qty: med.current_stock, adjusted_qty: newStock, reason: form.notes, created_by: profile?.id
      });
    }

    setSaving(false);
    toast.success('Stock updated');
    setMovementModal(null);
    load();
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-display font-semibold text-slate-900 dark:text-white">Inventory</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Stock levels, movements and alerts</p>
        </div>
        {canWrite && (
          <div className="flex items-center gap-2">
            <button className="btn-secondary" onClick={() => openMovement('in')}><ArrowDownCircle size={16}/> Stock In</button>
            <button className="btn-secondary" onClick={() => openMovement('out')}><ArrowUpCircle size={16}/> Stock Out</button>
            <button className="btn-secondary" onClick={() => openMovement('adjustment')}><Sliders size={16}/> Adjust</button>
          </div>
        )}
      </div>

      <div className="flex gap-1 mb-4 border-b border-slate-200 dark:border-white/10">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={classNames('px-4 py-2 text-sm font-medium border-b-2 -mb-px',
              tab === t ? 'border-brand-600 text-brand-700 dark:text-brand-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300')}>
            {t}
          </button>
        ))}
      </div>

      {loading ? <TableSkeleton rows={6} cols={4} /> : (
        <>
          {tab === 'Alerts' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <AlertPanel title="Low Stock" icon={AlertTriangle} tone="amber" items={lowStock}
                render={(m) => `${m.name} — ${m.current_stock} left (min ${m.minimum_stock})`} />
              <AlertPanel title="Out of Stock" icon={PackageX} tone="red" items={outOfStock}
                render={(m) => `${m.name}`} />
              <AlertPanel title="Expiring within 30 days" icon={CalendarClock} tone="amber" items={expiring}
                render={(m) => `${m.name} — expires ${m.expiry_date}`} />
              <AlertPanel title="Expired" icon={PackageX} tone="red" items={expired}
                render={(m) => `${m.name} — expired ${m.expiry_date}`} />
            </div>
          )}

          {tab === 'Stock Movements' && (
            transactions.length === 0 ? <EmptyState title="No stock movements yet" /> : (
              <div className="glass-card overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-white/10">
                      <th className="px-4 py-2.5">Medicine</th><th className="px-4 py-2.5">Type</th>
                      <th className="px-4 py-2.5">Quantity</th><th className="px-4 py-2.5">Notes</th><th className="px-4 py-2.5">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {transactions.map((t) => (
                      <tr key={t.id}>
                        <td className="px-4 py-2.5">{t.medicines?.name}</td>
                        <td className="px-4 py-2.5 capitalize">{t.type}</td>
                        <td className="px-4 py-2.5">{t.quantity}</td>
                        <td className="px-4 py-2.5 text-slate-500">{t.notes || '—'}</td>
                        <td className="px-4 py-2.5 text-slate-500">{formatDateTime(t.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {tab === 'Adjustments' && (
            <div className="glass-card p-4">
              <p className="text-sm text-slate-500">Use the "Adjust" button above to record a stock correction after a physical count. All adjustments are logged with the previous and new quantity for audit purposes.</p>
            </div>
          )}
        </>
      )}

      <Modal open={!!movementModal} onClose={() => setMovementModal(null)}
        title={movementModal === 'in' ? 'Stock In' : movementModal === 'out' ? 'Stock Out' : 'Stock Adjustment'}
        footer={<>
          <button className="btn-secondary" onClick={() => setMovementModal(null)}>Cancel</button>
          <button className="btn-primary" onClick={submitMovement} disabled={saving}>{saving ? 'Saving…' : 'Confirm'}</button>
        </>}>
        <div className="space-y-3">
          <div>
            <label className="label">Medicine</label>
            <select className="input" value={form.medicine_id} onChange={(e) => setForm((f) => ({ ...f, medicine_id: e.target.value }))}>
              <option value="">Select medicine…</option>
              {medicines.map((m) => <option key={m.id} value={m.id}>{m.name} (current: {m.current_stock})</option>)}
            </select>
          </div>
          <div>
            <label className="label">{movementModal === 'adjustment' ? 'New stock quantity' : 'Quantity'}</label>
            <input className="input" type="number" value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} />
          </div>
          <div>
            <label className="label">Notes / Reason</label>
            <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </div>
        </div>
      </Modal>
    </div>
  );
}

function AlertPanel({ title, icon: Icon, tone, items, render }) {
  const tones = { amber: 'text-amber-600 dark:text-amber-400', red: 'text-red-600 dark:text-red-400' };
  return (
    <div className="glass-card p-4">
      <h3 className={classNames('font-medium mb-3 flex items-center gap-2', tones[tone])}>
        <Icon size={17} /> {title} <span className="text-xs font-normal text-slate-400">({items.length})</span>
      </h3>
      {items.length === 0 ? (
        <p className="text-sm text-slate-400">All clear.</p>
      ) : (
        <ul className="space-y-1.5 max-h-48 overflow-y-auto">
          {items.map((m) => <li key={m.id} className="text-sm text-slate-600 dark:text-slate-300">{render(m)}</li>)}
        </ul>
      )}
    </div>
  );
}
