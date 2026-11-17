import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import type { Database } from './database.types';

// Societree's live Supabase project. The URL and publishable key are public by
// design (they ship inside every copy of the app); Row Level Security in the
// database is what protects the data. Set EXPO_PUBLIC_SUPABASE_URL/KEY (e.g. in
// .env.local) to point the app at a different project, such as a local one.
const PRODUCTION_URL = 'https://zbdbtgqbdzgjmxwhoxns.supabase.co';
const PRODUCTION_KEY = 'sb_publishable_q7nAGu21x8L6n8bKOQ28Kg_80MnAXB1';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL || PRODUCTION_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_KEY || PRODUCTION_KEY;

export const supabaseConfigured = Boolean(url && key);

/**
 * True when the page was opened from an email link that failed (expired, or
 * already used, often because it was opened on a different device). Read
 * before the Supabase client starts, because it clears the address bar.
 */
export const openedFromFailedEmailLink = (() => {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.hash.slice(1) || window.location.search.slice(1));
  return Boolean(params.get('error') || params.get('error_code'));
})();

// The publishable (anon) key is safe to ship in the app: Row Level Security
// decides what each signed-in user can do. Never put the secret key here.
export const supabase = createClient<Database>(
  url,
  key,
  {
    auth: {
      ...(Platform.OS !== 'web' ? { storage: AsyncStorage } : {}),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: Platform.OS === 'web', // magic links land back on the web app
    },
  },
);

// On native, only refresh the session while the app is in the foreground.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
