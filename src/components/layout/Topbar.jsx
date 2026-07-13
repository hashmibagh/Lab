import { useState } from 'react';
import { Search, Sun, Moon, Bell, LogOut, User, Menu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

export default function Topbar({ onMenuClick, notificationCount = 0 }) {
  const { profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="h-16 shrink-0 flex items-center gap-3 px-4 md:px-6 border-b border-slate-200 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
      <button className="md:hidden btn-ghost !p-2 rounded-lg" onClick={onMenuClick} aria-label="Open menu">
        <Menu size={20} />
      </button>

      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
        <input className="input !pl-9" placeholder="Search medicines, invoices, customers..." />
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <button className="btn-ghost !p-2 rounded-lg" onClick={toggleTheme} aria-label="Toggle theme">
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <button className="btn-ghost !p-2 rounded-lg relative" onClick={() => navigate('/notifications')} aria-label="Notifications">
          <Bell size={18} />
          {notificationCount > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" />
          )}
        </button>

        <div className="relative">
          <button className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10"
            onClick={() => setMenuOpen((o) => !o)}>
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-brand-600 text-white flex items-center justify-center text-sm font-semibold">
                {(profile?.full_name?.[0] ?? 'U').toUpperCase()}
              </div>
            )}
            <div className="hidden sm:block text-left">
              <p className="text-sm font-medium text-slate-800 dark:text-slate-100 leading-tight">{profile?.full_name ?? 'User'}</p>
              <p className="text-xs text-slate-400 capitalize leading-tight">{profile?.role?.replace('_', ' ')}</p>
            </div>
          </button>
          {menuOpen && (
            <div className="absolute right-0 mt-2 w-44 glass-card !bg-white dark:!bg-slate-900 py-1 z-20">
              <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10"
                onClick={() => { setMenuOpen(false); navigate('/settings'); }}>
                <User size={15} /> Profile
              </button>
              <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-slate-100 dark:hover:bg-white/10"
                onClick={signOut}>
                <LogOut size={15} /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
