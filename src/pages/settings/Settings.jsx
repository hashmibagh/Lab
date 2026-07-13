import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Save, Moon, Sun } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { classNames } from '../../lib/utils';
import { TableSkeleton } from '../../components/ui/Feedback';
import FileUpload from '../../components/ui/FileUpload';

const ROLES = ['super_admin', 'owner', 'manager', 'pharmacist', 'cashier', 'store_keeper'];
const TABS = ['My Profile', 'Pharmacy Profile', 'Invoice Settings', 'Appearance', 'Users & Roles'];

export default function Settings() {
  const { profile, hasRole } = useAuth();
  const [tab, setTab] = useState('My Profile');

  return (
    <div>
      <h1 className="text-xl font-display font-semibold text-slate-900 dark:text-white mb-4">Settings</h1>
      <div className="flex gap-1 mb-4 border-b border-slate-200 dark:border-white/10 overflow-x-auto">
        {TABS.filter((t) => t !== 'Users & Roles' || hasRole('owner')).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={classNames('px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap',
              tab === t ? 'border-brand-600 text-brand-700 dark:text-brand-400' : 'border-transparent text-slate-500')}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'My Profile' && <MyProfileTab />}

      {tab === 'Pharmacy Profile' && <SettingsForm settingKey="pharmacy_profile" fields={[
        ['name', 'Pharmacy Name'], ['owner', 'Owner Name'], ['address', 'Address'],
        ['phone', 'Phone'], ['email', 'Email'], ['currency', 'Currency'],
        ['tax_number', 'Tax / GST Number'], ['license_number', 'License Number']
      ]} />}

      {tab === 'Invoice Settings' && <SettingsForm settingKey="invoice_settings" fields={[
        ['prefix', 'Invoice Prefix'], ['receipt_size', 'Receipt Size (e.g. 80mm, A4)']
      ]} />}

      {tab === 'Appearance' && <AppearanceTab />}

      {tab === 'Users & Roles' && hasRole('owner') && <UsersTab />}
    </div>
  );
}

function MyProfileTab() {
  const { profile, user, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from('profiles')
      .update({ full_name: fullName, phone, avatar_url: avatarUrl })
      .eq('id', profile.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success('Profile updated');
    refreshProfile();
  };

  if (!profile) return <TableSkeleton rows={3} cols={2} />;

  return (
    <div className="glass-card p-5 max-w-xl space-y-4">
      <FileUpload bucket="avatars" folder={profile.id} kind="image" label="Profile Photo"
        value={avatarUrl} onChange={setAvatarUrl} />
      <div>
        <label className="label">Full Name</label>
        <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
      </div>
      <div>
        <label className="label">Phone</label>
        <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
      <div>
        <label className="label">Email</label>
        <input className="input" value={user?.email ?? ''} disabled />
      </div>
      <div>
        <label className="label">Role</label>
        <input className="input capitalize" value={profile.role?.replace('_', ' ')} disabled />
      </div>
      <button className="btn-primary" onClick={save} disabled={saving}><Save size={16}/> {saving ? 'Saving…' : 'Save changes'}</button>
    </div>
  );
}

function SettingsForm({ settingKey, fields }) {
  const [values, setValues] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from('settings').select('value').eq('key', settingKey).single()
      .then(({ data }) => setValues(data?.value ?? {}));
  }, [settingKey]);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from('settings').upsert({ key: settingKey, value: values, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success('Settings saved');
  };

  if (!values) return <TableSkeleton rows={4} cols={2} />;

  return (
    <div className="glass-card p-5 max-w-xl space-y-3">
      {fields.map(([key, label]) => (
        <div key={key}>
          <label className="label">{label}</label>
          <input className="input" value={values[key] ?? ''} onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))} />
        </div>
      ))}
      <button className="btn-primary" onClick={save} disabled={saving}><Save size={16}/> {saving ? 'Saving…' : 'Save changes'}</button>
    </div>
  );
}

function AppearanceTab() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="glass-card p-5 max-w-xl">
      <p className="label mb-2">Theme</p>
      <div className="flex gap-2">
        <button className={classNames('btn-secondary', theme === 'light' && '!bg-brand-100 dark:!bg-brand-500/20')} onClick={() => setTheme('light')}>
          <Sun size={16}/> Light
        </button>
        <button className={classNames('btn-secondary', theme === 'dark' && '!bg-brand-100 dark:!bg-brand-500/20')} onClick={() => setTheme('dark')}>
          <Moon size={16}/> Dark
        </button>
      </div>
    </div>
  );
}

function UsersTab() {
  const [users, setUsers] = useState(null);

  useEffect(() => { load(); }, []);
  async function load() {
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    setUsers(data ?? []);
  }

  const updateRole = async (id, role) => {
    const { error } = await supabase.from('profiles').update({ role }).eq('id', id);
    if (error) return toast.error(error.message);
    toast.success('Role updated');
    load();
  };

  const toggleActive = async (id, is_active) => {
    await supabase.from('profiles').update({ is_active: !is_active }).eq('id', id);
    load();
  };

  if (!users) return <TableSkeleton rows={4} cols={4} />;

  return (
    <div className="glass-card overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-white/10">
            <th className="px-4 py-2.5">User</th><th className="px-4 py-2.5">Role</th><th className="px-4 py-2.5">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
          {users.map((u) => (
            <tr key={u.id}>
              <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-slate-100">{u.full_name}</td>
              <td className="px-4 py-2.5">
                <select className="input !w-auto" value={u.role} onChange={(e) => updateRole(u.id, e.target.value)}>
                  {ROLES.map((r) => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
                </select>
              </td>
              <td className="px-4 py-2.5">
                <button className={classNames('badge cursor-pointer', u.is_active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-slate-200 text-slate-600')}
                  onClick={() => toggleActive(u.id, u.is_active)}>
                  {u.is_active ? 'Active' : 'Inactive'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
