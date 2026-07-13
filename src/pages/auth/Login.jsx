import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pill, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';

export default function Login() {
  const { signIn, resetPassword } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    if (forgotMode) {
      const { error } = await resetPassword(email);
      setLoading(false);
      if (error) return toast.error(error.message);
      toast.success('Password reset email sent');
      setForgotMode(false);
      return;
    }
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) return toast.error(error.message);
    navigate('/');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-light dark:bg-surface-dark px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-brand-600 text-white flex items-center justify-center mb-3">
            <Pill size={22} />
          </div>
          <h1 className="text-xl font-display font-semibold text-slate-900 dark:text-white">PharmacyOS</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Complete pharmacy management</p>
        </div>

        <form onSubmit={submit} className="glass-card p-6 space-y-4">
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@pharmacy.com" />
          </div>

          {!forgotMode && (
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input className="input pr-10" type={showPassword ? 'text' : 'password'} required
                  value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                  onClick={() => setShowPassword((s) => !s)}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          )}

          <button className="btn-primary w-full" disabled={loading}>
            {loading ? 'Please wait…' : forgotMode ? 'Send reset link' : 'Sign in'}
          </button>

          <button type="button" className="text-sm text-brand-600 dark:text-brand-400 hover:underline w-full text-center"
            onClick={() => setForgotMode((f) => !f)}>
            {forgotMode ? 'Back to sign in' : 'Forgot password?'}
          </button>
        </form>
      </div>
    </div>
  );
}
