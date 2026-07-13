import { useEffect, useState } from 'react';
import { Bell, AlertTriangle, PackageX, CalendarClock, Wallet, CheckCheck } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { EmptyState, TableSkeleton } from '../../components/ui/Feedback';
import { formatDateTime, classNames } from '../../lib/utils';

const ICONS = {
  low_stock: AlertTriangle, out_of_stock: PackageX, expiry: CalendarClock,
  payment_due: Wallet, supplier_due: Wallet, customer_due: Wallet,
  daily_summary: Bell, system: Bell
};

export default function Notifications() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(100);
    setRows(data ?? []);
    setLoading(false);
  }

  const markRead = async (id) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setRows((r) => r.map((n) => n.id === id ? { ...n, is_read: true } : n));
  };

  const markAllRead = async () => {
    await supabase.from('notifications').update({ is_read: true }).eq('is_read', false);
    setRows((r) => r.map((n) => ({ ...n, is_read: true })));
  };

  const filtered = filter === 'all' ? rows : filter === 'unread' ? rows.filter((r) => !r.is_read) : rows.filter((r) => r.type === filter);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-display font-semibold text-slate-900 dark:text-white">Notifications</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{rows.filter((r) => !r.is_read).length} unread</p>
        </div>
        <div className="flex items-center gap-2">
          <select className="input !w-auto" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All</option><option value="unread">Unread</option>
            <option value="low_stock">Low stock</option><option value="out_of_stock">Out of stock</option>
            <option value="expiry">Expiry</option>
          </select>
          <button className="btn-secondary" onClick={markAllRead}><CheckCheck size={16}/> Mark all read</button>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        {loading ? <TableSkeleton rows={6} cols={2} /> : filtered.length === 0 ? <EmptyState title="You're all caught up" /> : (
          <ul className="divide-y divide-slate-100 dark:divide-white/5">
            {filtered.map((n) => {
              const Icon = ICONS[n.type] ?? Bell;
              return (
                <li key={n.id} className={classNames('flex items-start gap-3 px-4 py-3', !n.is_read && 'bg-brand-50/50 dark:bg-brand-500/5')}>
                  <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-white/10 flex items-center justify-center shrink-0">
                    <Icon size={16} className="text-slate-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{n.title}</p>
                    {n.body && <p className="text-xs text-slate-500 mt-0.5">{n.body}</p>}
                    <p className="text-xs text-slate-400 mt-0.5">{formatDateTime(n.created_at)}</p>
                  </div>
                  {!n.is_read && (
                    <button className="text-xs text-brand-600 dark:text-brand-400 hover:underline shrink-0" onClick={() => markRead(n.id)}>
                      Mark read
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
