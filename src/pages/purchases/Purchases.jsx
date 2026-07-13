import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/ui/Modal';
import { EmptyState, TableSkeleton } from '../../components/ui/Feedback';
import { formatCurrency, formatDate, generateInvoiceNo, classNames } from '../../lib/utils';

export default function Purchases() {
  const { profile, hasRole } = useAuth();
  const [rows, setRows] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [detailItems, setDetailItems] = useState([]);

  const [supplierId, setSupplierId] = useState('');
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(false);
  const canWrite = hasRole('manager');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [p, m, s] = await Promise.all([
      supabase.from('purchases').select('*, suppliers(name)').order('purchase_date', { ascending: false }),
      supabase.from('medicines').select('id, name, purchase_price').is('deleted_at', null),
      supabase.from('suppliers').select('id, name')
    ]);
    setRows(p.data ?? []);
    setMedicines(m.data ?? []);
    setSuppliers(s.data ?? []);
    setLoading(false);
  }

  const openCreate = () => { setSupplierId(''); setItems([]); setCreateOpen(true); };

  const addLine = () => setItems((it) => [...it, { medicine_id: '', quantity: 1, unit_cost: 0, tax_percent: 0, expiry_date: '' }]);
  const updateLine = (idx, patch) => setItems((it) => it.map((l, i) => i === idx ? { ...l, ...patch } : l));
  const removeLine = (idx) => setItems((it) => it.filter((_, i) => i !== idx));

  const totals = useMemo(() => {
    const subtotal = items.reduce((s, l) => s + Number(l.unit_cost) * Number(l.quantity), 0);
    const taxTotal = items.reduce((s, l) => s + Number(l.unit_cost) * Number(l.quantity) * (Number(l.tax_percent) / 100), 0);
    return { subtotal, taxTotal, grandTotal: subtotal + taxTotal };
  }, [items]);

  const submit = async () => {
    if (!supplierId) return toast.error('Select a supplier');
    if (items.length === 0) return toast.error('Add at least one item');
    if (items.some((l) => !l.medicine_id || !l.quantity)) return toast.error('Complete all item rows');
    setSaving(true);

    const invoice_no = generateInvoiceNo('PO-');
    const { data: purchase, error } = await supabase.from('purchases').insert({
      invoice_no, supplier_id: supplierId, subtotal: totals.subtotal, tax_total: totals.taxTotal,
      grand_total: totals.grandTotal, paid_amount: 0, payment_status: 'unpaid', created_by: profile?.id
    }).select().single();

    if (error) { setSaving(false); return toast.error(error.message); }

    const rowsToInsert = items.map((l) => ({
      purchase_id: purchase.id, medicine_id: l.medicine_id, quantity: Number(l.quantity),
      unit_cost: Number(l.unit_cost), tax_percent: Number(l.tax_percent) || 0,
      line_total: Number(l.unit_cost) * Number(l.quantity), expiry_date: l.expiry_date || null
    }));
    const { error: itemsError } = await supabase.from('purchase_items').insert(rowsToInsert);
    setSaving(false);
    if (itemsError) return toast.error(itemsError.message);

    toast.success(`Purchase ${invoice_no} recorded — stock updated`);
    setCreateOpen(false);
    load();
  };

  const openDetail = async (row) => {
    setDetail(row);
    const { data } = await supabase.from('purchase_items').select('*, medicines(name)').eq('purchase_id', row.id);
    setDetailItems(data ?? []);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-display font-semibold text-slate-900 dark:text-white">Purchases</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{rows.length} purchase orders</p>
        </div>
        {canWrite && <button className="btn-primary" onClick={openCreate}><Plus size={16}/> New Purchase</button>}
      </div>

      <div className="glass-card overflow-hidden">
        {loading ? <TableSkeleton cols={6} /> : rows.length === 0 ? (
          <EmptyState title="No purchases recorded yet" action={canWrite && <button className="btn-primary" onClick={openCreate}><Plus size={16}/> New Purchase</button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-white/10">
                  <th className="px-4 py-2.5">Invoice</th><th className="px-4 py-2.5">Supplier</th>
                  <th className="px-4 py-2.5">Total</th><th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Date</th><th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-white/5">
                    <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-slate-100">{r.invoice_no}</td>
                    <td className="px-4 py-2.5">{r.suppliers?.name ?? '—'}</td>
                    <td className="px-4 py-2.5">{formatCurrency(r.grand_total)}</td>
                    <td className="px-4 py-2.5">
                      <span className={classNames('badge',
                        r.payment_status === 'paid' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                        : r.payment_status === 'partial' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
                        : 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300')}>{r.payment_status}</span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">{formatDate(r.purchase_date)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button className="btn-ghost !p-1.5 rounded-lg" onClick={() => openDetail(r)}><Eye size={15}/></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New Purchase Order" width="max-w-2xl"
        footer={<>
          <button className="btn-secondary" onClick={() => setCreateOpen(false)}>Cancel</button>
          <button className="btn-primary" onClick={submit} disabled={saving}>{saving ? 'Saving…' : `Record Purchase — ${formatCurrency(totals.grandTotal)}`}</button>
        </>}>
        <div className="space-y-4">
          <div>
            <label className="label">Supplier</label>
            <select className="input" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option value="">Select supplier…</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            {items.map((l, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-4">
                  <label className="label">Medicine</label>
                  <select className="input" value={l.medicine_id} onChange={(e) => {
                    const med = medicines.find((m) => m.id === e.target.value);
                    updateLine(idx, { medicine_id: e.target.value, unit_cost: med?.purchase_price ?? l.unit_cost });
                  }}>
                    <option value="">Select…</option>
                    {medicines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                <div className="col-span-2"><label className="label">Qty</label>
                  <input className="input" type="number" value={l.quantity} onChange={(e) => updateLine(idx, { quantity: e.target.value })} /></div>
                <div className="col-span-2"><label className="label">Unit Cost</label>
                  <input className="input" type="number" step="0.01" value={l.unit_cost} onChange={(e) => updateLine(idx, { unit_cost: e.target.value })} /></div>
                <div className="col-span-2"><label className="label">Expiry</label>
                  <input className="input" type="date" value={l.expiry_date} onChange={(e) => updateLine(idx, { expiry_date: e.target.value })} /></div>
                <div className="col-span-1"><label className="label">Tax %</label>
                  <input className="input" type="number" value={l.tax_percent} onChange={(e) => updateLine(idx, { tax_percent: e.target.value })} /></div>
                <div className="col-span-1">
                  <button className="btn-ghost !p-2 rounded-lg text-red-500" onClick={() => removeLine(idx)}><Trash2 size={15}/></button>
                </div>
              </div>
            ))}
            <button className="btn-secondary" onClick={addLine}><Plus size={15}/> Add Item</button>
          </div>

          <div className="text-sm text-right space-y-1 border-t border-slate-200 dark:border-white/10 pt-3">
            <p className="text-slate-500">Subtotal: {formatCurrency(totals.subtotal)}</p>
            <p className="text-slate-500">Tax: {formatCurrency(totals.taxTotal)}</p>
            <p className="font-semibold text-slate-900 dark:text-white">Total: {formatCurrency(totals.grandTotal)}</p>
          </div>
        </div>
      </Modal>

      <Modal open={!!detail} onClose={() => setDetail(null)} title={`Purchase ${detail?.invoice_no ?? ''}`}>
        <ul className="divide-y divide-slate-100 dark:divide-white/5">
          {detailItems.map((it) => (
            <li key={it.id} className="flex justify-between py-2 text-sm">
              <span>{it.medicines?.name} × {it.quantity}</span>
              <span className="font-medium">{formatCurrency(it.line_total)}</span>
            </li>
          ))}
        </ul>
      </Modal>
    </div>
  );
}
