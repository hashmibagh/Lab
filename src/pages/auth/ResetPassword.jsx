import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';

export default function ResetPassword() {
  const { updatePassword } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await updatePassword(password);
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success('Password updated — please sign in');
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-light dark:bg-surface-dark px-4">
      <form onSubmit={submit} className="glass-card p-6 w-full max-w-sm space-y-4">
        <h1 className="text-lg font-display font-semibold text-slate-900 dark:text-white">Set a new password</h1>
        <div>
          <label className="label">New password</label>
          <input className="input" type="password" required minLength={6} value={password}
            onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        </div>
        <button className="btn-primary w-full" disabled={loading}>{loading ? 'Saving…' : 'Update password'}</button>
      </form>
    </div>
  );
}
