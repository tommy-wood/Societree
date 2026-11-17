// Shared app data for the list screens: sites, open-job counts, stock and the
// overdue setting. Small enough (tens of rows) to load in one go and refresh
// whenever a screen comes into focus or the app returns to the foreground.
import { useFocusEffect } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { DEFAULT_OVERDUE_DAYS, isOverdue, needsAttention, score } from './logic';
import { supabase, type Tables } from './supabase';

export type Site = Tables<'sites'>;
export type StockItem = Tables<'stock_items'>;

export type RankedSite = Site & { openJobs: number; score: number; overdue: boolean; needsAttention: boolean };

type DataState = {
  loading: boolean;
  error: string;
  sites: RankedSite[]; // sorted by score, highest first
  stock: StockItem[];
  overdueDays: number;
  /** Re-fetch everything. Pass true to skip the "fetched in the last few seconds" shortcut. */
  reload: (force?: boolean) => Promise<void>;
};

const DataContext = createContext<DataState | null>(null);
const STALE_MS = 15_000;

export function DataProvider({ children }: { children: ReactNode }) {
  const [raw, setRaw] = useState<{ sites: Site[]; openJobs: Record<string, number>; stock: StockItem[]; overdueDays: number } | null>(null);
  const [error, setError] = useState('');
  const lastFetch = useRef(0);
  const inFlight = useRef<Promise<void> | null>(null);

  const reload = useCallback(async (force = false) => {
    if (!force && Date.now() - lastFetch.current < STALE_MS) return;
    if (inFlight.current) return inFlight.current;
    inFlight.current = (async () => {
      const [sites, jobs, stock, setting] = await Promise.all([
        supabase.from('sites').select('*'),
        supabase.from('jobs').select('site_id').eq('done', false),
        supabase.from('stock_items').select('*').order('name'),
        supabase.from('app_settings').select('value').eq('key', 'overdue_days').maybeSingle(),
      ]);
      const failed = sites.error || jobs.error || stock.error;
      if (failed) {
        setError('Couldn’t load the latest data. Check your signal and pull down to try again.');
        return;
      }
      const openJobs: Record<string, number> = {};
      for (const j of jobs.data ?? []) openJobs[j.site_id] = (openJobs[j.site_id] ?? 0) + 1;
      const days = Number(setting.data?.value);
      setRaw({ sites: sites.data ?? [], openJobs, stock: stock.data ?? [], overdueDays: days > 0 ? days : DEFAULT_OVERDUE_DAYS });
      setError('');
      lastFetch.current = Date.now();
    })().finally(() => {
      inFlight.current = null;
    });
    return inFlight.current;
  }, []);

  useEffect(() => {
    reload(true);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && reload());
    return () => sub.remove();
  }, [reload]);

  const value = useMemo<DataState>(() => {
    const overdueDays = raw?.overdueDays ?? DEFAULT_OVERDUE_DAYS;
    const sites = (raw?.sites ?? [])
      .map((s) => {
        const openJobs = raw?.openJobs[s.id] ?? 0;
        return {
          ...s,
          openJobs,
          score: score(s, openJobs, overdueDays),
          overdue: isOverdue(s, overdueDays),
          needsAttention: needsAttention(s, openJobs, overdueDays),
        };
      })
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
    return { loading: !raw && !error, error, sites, stock: raw?.stock ?? [], overdueDays, reload };
  }, [raw, error, reload]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside <DataProvider>');
  return ctx;
}

/** Refresh shared data when the calling screen comes into focus. */
export function useRefreshOnFocus() {
  const { reload } = useData();
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );
}
