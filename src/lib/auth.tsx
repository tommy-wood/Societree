import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { supabase, type Tables } from './supabase';

export type Profile = Tables<'profiles'>;
export type Role = 'admin' | 'volunteer' | 'pending';

type AuthState = {
  /** True until the stored session (and its profile) has been loaded. */
  loading: boolean;
  session: Session | null;
  profile: Profile | null;
  role: Role | null;
  isMember: boolean;
  isAdmin: boolean;
  /** Set when the user arrived from a password-reset email. */
  recovering: boolean;
  refreshProfile: () => Promise<void>;
  finishRecovery: () => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [recovering, setRecovering] = useState(
    // Supabase puts type=recovery in the URL hash of the reset link (web).
    Platform.OS === 'web' && typeof window !== 'undefined' && window.location.hash.includes('type=recovery'),
  );

  const loadProfile = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setProfile(null);
      return;
    }
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    setProfile(data ?? null);
  }, []);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      await loadProfile(data.session?.user.id);
      if (active) setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      if (event === 'SIGNED_OUT') setRecovering(false);
      // Don't await inside the callback (supabase-js deadlock guidance); defer instead.
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED' || event === 'INITIAL_SESSION') {
        setTimeout(() => loadProfile(next?.user.id), 0);
      }
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const value = useMemo<AuthState>(() => {
    const role = (profile?.role as Role | undefined) ?? null;
    return {
      loading,
      session,
      profile,
      role,
      isMember: role === 'admin' || role === 'volunteer',
      isAdmin: role === 'admin',
      recovering,
      refreshProfile: () => loadProfile(session?.user.id),
      finishRecovery: () => {
        setRecovering(false);
        if (Platform.OS === 'web' && typeof window !== 'undefined') window.history.replaceState(null, '', '/');
      },
      signOut: async () => {
        await supabase.auth.signOut();
        setProfile(null);
      },
    };
  }, [loading, session, profile, recovering, loadProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/** Turn Supabase auth errors into plain English for the team. */
export function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'That email and password don’t match. Check them, or use “Forgot password?”.';
  if (m.includes('email not confirmed')) return 'Please confirm your email first: open the link we sent you, then sign in.';
  if (m.includes('already registered')) return 'There’s already an account with that email. Try signing in instead.';
  if (m.includes('password should be at least') || m.includes('weak')) return 'Please choose a longer password (at least 8 characters).';
  if (m.includes('rate limit') || m.includes('too many')) return 'Too many attempts. Please wait a minute and try again.';
  if (m.includes('network') || m.includes('fetch')) return 'Couldn’t reach the server. Check your signal and try again.';
  return message;
}

/** Where password-reset and confirmation emails should send people back to. */
export function authRedirectUrl(path = '/'): string | undefined {
  if (Platform.OS === 'web' && typeof window !== 'undefined') return window.location.origin + path;
  const web = process.env.EXPO_PUBLIC_WEB_URL;
  return web ? web.replace(/\/$/, '') + path : undefined; // undefined = Supabase "Site URL"
}
