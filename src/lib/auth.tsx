import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { openedFromRecoveryLink, supabase, type Tables } from './supabase';

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
  /** Can see everyone's hours and sign off invoices. */
  isFinance: boolean;
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
  // Opened from a password-reset email: show "Choose a new password" first.
  const [recovering, setRecovering] = useState(openedFromRecoveryLink);

  // The last profile we saw is kept on the device, so the app opens straight
  // away (even with no signal) and then checks with the server.
  const cacheKey = (id: string) => `societree.profile.${id}`;

  const loadProfile = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setProfile(null);
      return;
    }
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (error) return; // offline or server trouble: keep what we have
    setProfile(data ?? null);
    if (data) AsyncStorage.setItem(cacheKey(userId), JSON.stringify(data)).catch(() => {});
    else AsyncStorage.removeItem(cacheKey(userId)).catch(() => {});
  }, []);

  const loadCachedProfile = useCallback(async (userId: string | undefined) => {
    if (!userId) return false;
    try {
      const raw = await AsyncStorage.getItem(cacheKey(userId));
      if (!raw) return false;
      setProfile(JSON.parse(raw) as Profile);
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      const userId = data.session?.user.id;
      if (await loadCachedProfile(userId)) {
        setLoading(false);
        loadProfile(userId); // refresh in the background
      } else {
        await loadProfile(userId);
      }
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
  }, [loadProfile, loadCachedProfile]);

  const value = useMemo<AuthState>(() => {
    const role = (profile?.role as Role | undefined) ?? null;
    return {
      loading,
      session,
      profile,
      role,
      isMember: role === 'admin' || role === 'volunteer',
      isAdmin: role === 'admin',
      isFinance: (role === 'admin' || role === 'volunteer') && !!profile?.can_sign_off,
      recovering,
      refreshProfile: () => loadProfile(session?.user.id),
      finishRecovery: () => {
        setRecovering(false);
        if (Platform.OS === 'web' && typeof window !== 'undefined') window.history.replaceState(null, '', '/');
      },
      signOut: async () => {
        if (session) AsyncStorage.removeItem(cacheKey(session.user.id)).catch(() => {});
        await supabase.auth.signOut({ scope: 'local' });
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
  if (m.includes('different from the old password')) return 'That’s already your password. You can just sign in with it, or choose a different one.';
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
