import { useEffect, useMemo, useState } from 'react';
import { Eye, RotateCcw, FileSpreadsheet } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabaseClient';
import Modal from '../../components/ui/Modal';
import { EmptyState, TableSkeleton } from '../../components/ui/Feedback';
import { formatCurrency, formatDateTime, exportToExcel, classNames } from '../../lib/utils';

export default function SalesHistory() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [detail, setDetail] = useState(null);
  const [detailItems, setDetailItems] = useState([]);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('sales').select('*, customers(name)').order('sale_date', { ascending: false }).limit(300);
    setRows(data ?? []);
    setLoading(false);
  }

  const filtered = useMemo(() => rows.filter((r) => {
    if (from && new Date(r.sale_date) < new Date(from)) return false;
    if (to && new Date(r.sale_date) > new Date(to + 'T23:59:59')) return false;
    return true;
  }), [rows, from, to]);

  const openDetail = async (sale) => {
    setDetail(sale);
    const { data } = await supabase.from('sale_items').select('*, medicines(name)').eq('sale_id', sale.id);
    setDetailItems(data ?? []);
  };

  const refund = async (item) => {
    const { error } = await supabase.from('sales_returns').insert({
      sale_id: detail.id, medicine_id: item.medicine_id, quantity: item.quantity,
      amount: item.line_total, reason: 'Customer return'
    });
    if (error) return toast.error(error.message);
    toast.success('Item returned and stock restored');
  };

  const totalRevenue = filtered.reduce((s, r) => s + Number(r.grand_total), 0);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-display font-semibold text-slate-900 dark:text-white">Sales History</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{filtered.length} sales · {formatCurrency(totalRevenue)} revenue</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input type="date" className="input !w-auto" value={from} onChange={(e) => setFrom(e.target.value)} />
          <input type="date" className="input !w-auto" value={to} onChange={(e) => setTo(e.target.value)} />
          <button className="btn-secondary" onClick={() => exportToExcel(filtered.map((r) => ({
            Invoice: r.invoice_no, Customer: r.customers?.name ?? 'Walk-in', Total: r.grand_total,
            Paid: r.paid_amount, Status: r.payment_status, Date: r.sale_date
          })), 'sales.xlsx')}><FileSpreadsheet size={16}/> Export</button>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        {loading ? <TableSkeleton cols={6} /> : filtered.length === 0 ? <EmptyState title="No sales in this range" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-white/10">
                  <th className="px-4 py-2.5">Invoice</th><th className="px-4 py-2.5">Customer</th>
                  <th className="px-4 py-2.5">Total</th><th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Date</th><th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-white/5">
                    <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-slate-100">{r.invoice_no}</td>
                    <td className="px-4 py-2.5">{r.customers?.name ?? 'Walk-in'}</td>
                    <td className="px-4 py-2.5">{formatCurrency(r.grand_total)}</td>
                    <td className="px-4 py-2.5">
                      <span className={classNames('badge',
                        r.payment_status === 'paid' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                        : r.payment_status === 'partial' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
                        : 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300')}>
                        {r.payment_status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">{formatDateTime(r.sale_date)}</td>
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

      <Modal open={!!detail} onClose={() => setDetail(null)} title={`Invoice ${detail?.invoice_no ?? ''}`} width="max-w-lg">
        <div className="space-y-3">
          <ul className="divide-y divide-slate-100 dark:divide-white/5">
            {detailItems.map((it) => (
              <li key={it.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <p className="font-medium text-slate-800 dark:text-slate-100">{it.medicines?.name}</p>
                  <p className="text-xs text-slate-400">{it.quantity} × {formatCurrency(it.unit_price)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{formatCurrency(it.line_total)}</span>
                  <button className="btn-ghost !p-1.5 rounded-lg text-amber-600" title="Return item" onClick={() => refund(it)}>
                    <RotateCcw size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <div className="flex justify-between font-semibold text-slate-900 dark:text-white border-t border-slate-200 dark:border-white/10 pt-2">
            <span>Total</span><span>{formatCurrency(detail?.grand_total)}</span>
          </div>
        </div>
      </Modal>
    </div>
  );
}
