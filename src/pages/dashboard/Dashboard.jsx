import { useEffect, useState } from 'react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { DollarSign, TrendingUp, AlertTriangle, PackageX, CalendarClock, ShoppingBag } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import StatCard from '../../components/ui/StatCard';
import { formatCurrency, formatDate, formatDateTime } from '../../lib/utils';
import { TableSkeleton } from '../../components/ui/Feedback';

const COLORS = ['#0f766e', '#3ecdb4', '#f59e0b', '#ef4444', '#6366f1', '#ec4899'];

function startOfToday() { const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString(); }
function startOfMonth() { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d.toISOString(); }
function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); d.setHours(0, 0, 0, 0); return d; }

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [
      todaySalesRes, monthSalesRes, purchasesRes, medicinesRes,
      recentSalesRes, recentPurchasesRes, recentCustomersRes, recentSuppliersRes,
      salesLast14Res, saleItemsRes
    ] = await Promise.all([
      supabase.from('sales').select('grand_total').gte('sale_date', startOfToday()),
      supabase.from('sales').select('grand_total, sale_date').gte('sale_date', startOfMonth()),
      supabase.from('purchases').select('grand_total, purchase_date').gte('purchase_date', startOfMonth().slice(0, 10)),
      supabase.from('medicines').select('id, name, current_stock, minimum_stock, expiry_date, category_id, sale_price'),
      supabase.from('sales').select('id, invoice_no, grand_total, sale_date, customers(name)').order('sale_date', { ascending: false }).limit(5),
      supabase.from('purchases').select('id, invoice_no, grand_total, purchase_date, suppliers(name)').order('purchase_date', { ascending: false }).limit(5),
      supabase.from('customers').select('id, name, created_at').order('created_at', { ascending: false }).limit(5),
      supabase.from('suppliers').select('id, name, created_at').order('created_at', { ascending: false }).limit(5),
      supabase.from('sales').select('grand_total, sale_date').gte('sale_date', daysAgo(13).toISOString()),
      supabase.from('sale_items').select('medicine_id, quantity, line_total, medicines(name)').order('quantity', { ascending: false }).limit(200)
    ]);

    const medicines = medicinesRes.data ?? [];
    const today = todaySalesRes.data ?? [];
    const month = monthSalesRes.data ?? [];
    const purchasesMonth = purchasesRes.data ?? [];

    const todaySalesTotal = today.reduce((s, r) => s + Number(r.grand_total), 0);
    const monthSalesTotal = month.reduce((s, r) => s + Number(r.grand_total), 0);
    const monthPurchaseTotal = purchasesMonth.reduce((s, r) => s + Number(r.grand_total), 0);
    // Rough profit estimate: sales - cost-of-goods proxy via purchases (illustrative only)
    const todayProfitEst = todaySalesTotal * 0.25;
    const monthProfitEst = monthSalesTotal - monthPurchaseTotal;

    const lowStock = medicines.filter((m) => m.current_stock > 0 && m.current_stock <= m.minimum_stock);
    const outOfStock = medicines.filter((m) => m.current_stock <= 0);
    const in30 = new Date(); in30.setDate(in30.getDate() + 30);
    const expiring = medicines.filter((m) => m.expiry_date && new Date(m.expiry_date) <= in30 && new Date(m.expiry_date) >= new Date());
    const expired = medicines.filter((m) => m.expiry_date && new Date(m.expiry_date) < new Date());

    // 14-day sales trend
    const byDay = {};
    for (let i = 13; i >= 0; i--) {
      const d = daysAgo(i);
      byDay[d.toISOString().slice(0, 10)] = { date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), sales: 0 };
    }
    (salesLast14Res.data ?? []).forEach((s) => {
      const key = s.sale_date.slice(0, 10);
      if (byDay[key]) byDay[key].sales += Number(s.grand_total);
    });
    const salesTrend = Object.values(byDay);

    // Top selling medicines
    const topMap = {};
    (saleItemsRes.data ?? []).forEach((it) => {
      const name = it.medicines?.name ?? 'Unknown';
      topMap[name] = (topMap[name] ?? 0) + Number(it.quantity);
    });
    const topSelling = Object.entries(topMap).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, qty]) => ({ name, qty }));

    // Category distribution
    const catCount = {};
    medicines.forEach((m) => { const k = m.category_id ?? 'Uncategorized'; catCount[k] = (catCount[k] ?? 0) + 1; });
    const categoryData = Object.entries(catCount).map(([k, v]) => ({ name: k === 'Uncategorized' ? k : k.slice(0, 6), value: v }));

    setStats({
      todaySalesTotal, monthSalesTotal, todayProfitEst, monthProfitEst,
      lowStock, outOfStock, expiring, expired,
      recentSales: recentSalesRes.data ?? [],
      recentPurchases: recentPurchasesRes.data ?? [],
      recentCustomers: recentCustomersRes.data ?? [],
      recentSuppliers: recentSuppliersRes.data ?? [],
      salesTrend, topSelling, categoryData,
      inventoryValue: medicines.reduce((s, m) => s + Number(m.current_stock) * Number(m.sale_price), 0)
    });
    setLoading(false);
  }

  if (loading || !stats) {
    return <TableSkeleton rows={8} cols={4} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-display font-semibold text-slate-900 dark:text-white">Dashboard</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Here's what's happening in your pharmacy today.</p>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Today's Sales" value={formatCurrency(stats.todaySalesTotal)} icon={DollarSign} tone="brand" />
        <StatCard label="Today's Profit (est.)" value={formatCurrency(stats.todayProfitEst)} icon={TrendingUp} tone="brand" />
        <StatCard label="Monthly Sales" value={formatCurrency(stats.monthSalesTotal)} icon={DollarSign} tone="slate" />
        <StatCard label="Monthly Profit (est.)" value={formatCurrency(stats.monthProfitEst)} icon={TrendingUp} tone="slate" />
        <StatCard label="Low Stock" value={stats.lowStock.length} icon={AlertTriangle} tone="amber" />
        <StatCard label="Out of Stock" value={stats.outOfStock.length} icon={PackageX} tone="red" />
        <StatCard label="Expiring (30d)" value={stats.expiring.length} icon={CalendarClock} tone="amber" />
        <StatCard label="Inventory Value" value={formatCurrency(stats.inventoryValue)} icon={ShoppingBag} tone="slate" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="glass-card p-4 lg:col-span-2">
          <h3 className="font-medium text-slate-800 dark:text-slate-100 mb-3">Sales — last 14 days</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={stats.salesTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#94a3b833" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => formatCurrency(v)} />
              <Line type="monotone" dataKey="sales" stroke="#0f766e" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card p-4">
          <h3 className="font-medium text-slate-800 dark:text-slate-100 mb-3">Medicine Categories</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={stats.categoryData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                {stats.categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="glass-card p-4 lg:col-span-1">
          <h3 className="font-medium text-slate-800 dark:text-slate-100 mb-3">Top Selling Medicines</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={stats.topSelling} layout="vertical" margin={{ left: 20 }}>
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="qty" fill="#0f766e" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <RecentList title="Recent Sales" rows={stats.recentSales.map((s) => ({
          id: s.id, primary: s.invoice_no, secondary: s.customers?.name ?? 'Walk-in',
          value: formatCurrency(s.grand_total), meta: formatDateTime(s.sale_date)
        }))} />

        <RecentList title="Recent Purchases" rows={stats.recentPurchases.map((p) => ({
          id: p.id, primary: p.invoice_no, secondary: p.suppliers?.name ?? '—',
          value: formatCurrency(p.grand_total), meta: formatDate(p.purchase_date)
        }))} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RecentList title="Recent Customers" rows={stats.recentCustomers.map((c) => ({
          id: c.id, primary: c.name, secondary: '', value: '', meta: formatDate(c.created_at)
        }))} />
        <RecentList title="Recent Suppliers" rows={stats.recentSuppliers.map((s) => ({
          id: s.id, primary: s.name, secondary: '', value: '', meta: formatDate(s.created_at)
        }))} />
      </div>
    </div>
  );
}

function RecentList({ title, rows }) {
  return (
    <div className="glass-card p-4">
      <h3 className="font-medium text-slate-800 dark:text-slate-100 mb-3">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-400">No records yet.</p>
      ) : (
        <ul className="space-y-2.5">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between text-sm">
              <div>
                <p className="font-medium text-slate-700 dark:text-slate-200">{r.primary}</p>
                {r.secondary && <p className="text-xs text-slate-400">{r.secondary}</p>}
              </div>
              <div className="text-right">
                {r.value && <p className="font-medium text-slate-700 dark:text-slate-200">{r.value}</p>}
                <p className="text-xs text-slate-400">{r.meta}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
