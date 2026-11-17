import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, processLock } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import type { Database } from './database.types';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_KEY;

/** False until .env.local has the project URL and publishable key. */
export const supabaseConfigured = Boolean(url && key);

// The publishable (anon) key is safe to ship in the app: Row Level Security
// decides what each signed-in user can do. Never put the secret key here.
export const supabase = createClient<Database>(
  url ?? 'http://127.0.0.1:54321',
  key ?? 'missing-key',
  {
    auth: {
      ...(Platform.OS !== 'web' ? { storage: AsyncStorage } : {}),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: Platform.OS === 'web', // magic links land back on the web app
      lock: processLock,
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
