import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

const AuthContext = createContext(null);

const ROLE_RANK = {
  super_admin: 6, owner: 5, manager: 4, pharmacist: 3, cashier: 2, store_keeper: 2
};

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId) => {
    if (!userId) return setProfile(null);
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    setProfile(data ?? null);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      loadProfile(data.session?.user?.id).finally(() => setLoading(false));
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      loadProfile(newSession?.user?.id);
    });

    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  const signIn = (email, password) => supabase.auth.signInWithPassword({ email, password });
  const signUp = (email, password, fullName) =>
    supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } });
  const signOut = () => supabase.auth.signOut();
  const resetPassword = (email) =>
    supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
  const updatePassword = (password) => supabase.auth.updateUser({ password });

  const hasRole = (minRole) => {
    if (!profile) return false;
    return (ROLE_RANK[profile.role] ?? 0) >= (ROLE_RANK[minRole] ?? 0);
  };

  const value = {
    session, profile, loading, user: session?.user ?? null,
    signIn, signUp, signOut, resetPassword, updatePassword, hasRole,
    refreshProfile: () => loadProfile(session?.user?.id)
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
