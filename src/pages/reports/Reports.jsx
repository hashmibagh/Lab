import { useEffect, useMemo, useState } from 'react';
import { FileSpreadsheet, Download } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { supabase } from '../../lib/supabaseClient';
import { TableSkeleton } from '../../components/ui/Feedback';
import { formatCurrency, formatDate, exportToExcel, exportToPdf, classNames, daysUntil } from '../../lib/utils';

const REPORTS = ['Sales', 'Purchases', 'Profit & Loss', 'Inventory', 'Expiry'];

export default function Reports() {
  const [tab, setTab] = useState('Sales');
  const [from, setFrom] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [medicines, setMedicines] = useState([]);

  useEffect(() => { load(); }, [from, to]);

  async function load() {
    setLoading(true);
    const [s, p, m] = await Promise.all([
      supabase.from('sales').select('*').gte('sale_date', from).lte('sale_date', to + 'T23:59:59'),
      supabase.from('purchases').select('*').gte('purchase_date', from).lte('purchase_date', to),
      supabase.from('medicines').select('*').is('deleted_at', null)
    ]);
    setSales(s.data ?? []);
    setPurchases(p.data ?? []);
    setMedicines(m.data ?? []);
    setLoading(false);
  }

  const salesTotal = sales.reduce((s, r) => s + Number(r.grand_total), 0);
  const purchasesTotal = purchases.reduce((s, r) => s + Number(r.grand_total), 0);
  const profit = salesTotal - purchasesTotal;

  const salesByDay = useMemo(() => {
    const map = {};
    sales.forEach((s) => {
      const key = s.sale_date.slice(0, 10);
      map[key] = (map[key] ?? 0) + Number(s.grand_total);
    });
    return Object.entries(map).sort().map(([date, total]) => ({ date, total }));
  }, [sales]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="text-xl font-display font-semibold text-slate-900 dark:text-white">Reports</h1>
        <div className="flex items-center gap-2">
          <input type="date" className="input !w-auto" value={from} onChange={(e) => setFrom(e.target.value)} />
          <input type="date" className="input !w-auto" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      <div className="flex gap-1 mb-4 border-b border-slate-200 dark:border-white/10 overflow-x-auto">
        {REPORTS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={classNames('px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap',
              tab === t ? 'border-brand-600 text-brand-700 dark:text-brand-400' : 'border-transparent text-slate-500')}>
            {t}
          </button>
        ))}
      </div>

      {loading ? <TableSkeleton rows={6} cols={4} /> : (
        <>
          {tab === 'Sales' && (
            <div className="space-y-4">
              <div className="glass-card p-4">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={salesByDay}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#94a3b833" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => formatDate(d, { month: 'short', day: 'numeric', year: undefined })} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => formatCurrency(v)} />
                    <Bar dataKey="total" fill="#0f766e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <ReportTable title="Sales" total={formatCurrency(salesTotal)} rows={sales}
                cols={[['invoice_no', 'Invoice'], ['grand_total', 'Total'], ['payment_status', 'Status'], ['sale_date', 'Date']]}
                fmt={{ grand_total: formatCurrency, sale_date: formatDate }} />
            </div>
          )}

          {tab === 'Purchases' && (
            <ReportTable title="Purchases" total={formatCurrency(purchasesTotal)} rows={purchases}
              cols={[['invoice_no', 'Invoice'], ['grand_total', 'Total'], ['payment_status', 'Status'], ['purchase_date', 'Date']]}
              fmt={{ grand_total: formatCurrency, purchase_date: formatDate }} />
          )}

          {tab === 'Profit & Loss' && (
            <div className="glass-card p-6 max-w-md space-y-2">
              <Row label="Total Sales" value={formatCurrency(salesTotal)} />
              <Row label="Total Purchases (COGS)" value={formatCurrency(purchasesTotal)} />
              <Row label={profit >= 0 ? 'Net Profit' : 'Net Loss'} value={formatCurrency(Math.abs(profit))} bold tone={profit >= 0 ? 'text-emerald-600' : 'text-red-600'} />
            </div>
          )}

          {tab === 'Inventory' && (
            <ReportTable title="Inventory Valuation" total={formatCurrency(medicines.reduce((s, m) => s + m.current_stock * m.sale_price, 0))}
              rows={medicines} cols={[['name', 'Medicine'], ['current_stock', 'Stock'], ['sale_price', 'Sale Price'], ['minimum_stock', 'Min Stock']]}
              fmt={{ sale_price: formatCurrency }} />
          )}

          {tab === 'Expiry' && (
            <ReportTable title="Expiry Report" rows={medicines.filter((m) => m.expiry_date && daysUntil(m.expiry_date) <= 60)}
              cols={[['name', 'Medicine'], ['batch_number', 'Batch'], ['current_stock', 'Stock'], ['expiry_date', 'Expiry']]}
              fmt={{ expiry_date: formatDate }} />
          )}
        </>
      )}
    </div>
  );
}

function Row({ label, value, bold, tone }) {
  return (
    <div className={classNames('flex justify-between', bold && 'font-semibold text-base pt-2 border-t border-slate-200 dark:border-white/10', tone)}>
      <span className={!bold ? 'text-slate-500' : ''}>{label}</span><span>{value}</span>
    </div>
  );
}

function ReportTable({ title, total, rows, cols, fmt = {} }) {
  const doExcel = () => exportToExcel(rows.map((r) => Object.fromEntries(cols.map(([k, l]) => [l, r[k]]))), `${title.toLowerCase()}.xlsx`);
  const doPdf = () => exportToPdf({
    title, head: cols.map(([, l]) => l),
    body: rows.map((r) => cols.map(([k]) => fmt[k] ? fmt[k](r[k]) : (r[k] ?? ''))),
    filename: `${title.toLowerCase()}.pdf`
  });

  return (
    <div className="glass-card overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b border-slate-200 dark:border-white/10">
        <p className="text-sm text-slate-500">{rows.length} records {total && `· Total: ${total}`}</p>
        <div className="flex gap-2">
          <button className="btn-secondary !py-1.5" onClick={doExcel}><FileSpreadsheet size={15}/> Excel</button>
          <button className="btn-secondary !py-1.5" onClick={doPdf}><Download size={15}/> PDF</button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-white/10">
              {cols.map(([k, l]) => <th key={k} className="px-4 py-2.5">{l}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {rows.map((r, i) => (
              <tr key={r.id ?? i}>
                {cols.map(([k]) => <td key={k} className="px-4 py-2.5 text-slate-700 dark:text-slate-200">{fmt[k] ? fmt[k](r[k]) : (r[k] ?? '—')}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
