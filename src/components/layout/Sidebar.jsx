import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Pill, Boxes, ShoppingCart, ReceiptText, Users, Truck,
  Wallet, UserSquare2, FileText, FlaskConical, BarChart3, Bell, Settings, ChevronLeft, ChevronRight
} from 'lucide-react';
import { useState } from 'react';
import { classNames } from '../../lib/utils';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/medicines', label: 'Medicines', icon: Pill },
  { to: '/inventory', label: 'Inventory', icon: Boxes },
  { to: '/purchases', label: 'Purchases', icon: ShoppingCart },
  { to: '/pos', label: 'POS / Billing', icon: ReceiptText },
  { to: '/sales', label: 'Sales History', icon: ReceiptText },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/suppliers', label: 'Suppliers', icon: Truck },
  { to: '/expenses', label: 'Expenses', icon: Wallet },
  { to: '/employees', label: 'Employees', icon: UserSquare2 },
  { to: '/prescriptions', label: 'Prescriptions', icon: FileText },
  { to: '/lab', label: 'Laboratory', icon: FlaskConical },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/settings', label: 'Settings', icon: Settings }
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className={classNames(
      'hidden md:flex flex-col shrink-0 border-r border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 transition-all',
      collapsed ? 'w-[68px]' : 'w-64'
    )}>
      <div className="h-16 flex items-center gap-2 px-4 border-b border-slate-200 dark:border-white/10">
        <div className="w-8 h-8 rounded-lg bg-brand-600 text-white flex items-center justify-center font-display font-bold shrink-0">Rx</div>
        {!collapsed && <span className="font-display font-semibold text-slate-900 dark:text-white truncate">PharmacyOS</span>}
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end}
            className={({ isActive }) => classNames(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
            )}>
            <Icon size={18} className="shrink-0" />
            {!collapsed && <span className="truncate">{label}</span>}
          </NavLink>
        ))}
      </nav>

      <button onClick={() => setCollapsed((c) => !c)}
        className="m-2 btn-ghost rounded-lg justify-center py-2 text-slate-500">
        {collapsed ? <ChevronRight size={16} /> : <><ChevronLeft size={16} /> <span className="text-xs">Collapse</span></>}
      </button>
    </aside>
  );
}
