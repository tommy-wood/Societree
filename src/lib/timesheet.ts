import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { DEFAULT_MILEAGE_RATE, lastDayOfMonth, type Contractor, type InvoiceStatus } from './invoice';
import { supabase, type Tables } from './supabase';

export type WorkDay = Tables<'work_days'>;
export type Expense = Tables<'expenses'>;
export type Invoice = Tables<'invoices'>;

export type MonthData = {
  days: WorkDay[];
  expenses: Expense[];
  invoice: Invoice | null;
  status: InvoiceStatus;
  locked: boolean;
  hourlyRate: number | null;
  mileageRate: number;
  invoiceTo: string;
  details: Contractor;
  /** Days this person logged a forest visit but hasn't added hours for. */
  visitDaysWithoutHours: string[];
};

const EMPTY_DETAILS: Contractor = { name: '', address: '', phone: '', email: '', bank_account_name: '', bank_sort_code: '', bank_account_number: '' };

/** Everything for one person's month. Reloads when the screen comes into focus. */
export function useMonth(userId: string | undefined, month: string) {
  const [data, setData] = useState<MonthData | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!userId) return;
    const end = lastDayOfMonth(month);
    const [days, exps, inv, rate, settings, details, profile, visits] = await Promise.all([
      supabase.from('work_days').select('*').eq('user_id', userId).gte('date', month).lte('date', end).order('date'),
      supabase.from('expenses').select('*').eq('user_id', userId).gte('date', month).lte('date', end).order('date'),
      supabase.from('invoices').select('*').eq('user_id', userId).eq('month', month).maybeSingle(),
      supabase.from('contractor_rates').select('hourly_rate').eq('user_id', userId).maybeSingle(),
      supabase.from('app_settings').select('key, value').in('key', ['mileage_rate', 'invoice_to']),
      supabase.from('contractor_details').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('profiles').select('name').eq('id', userId).maybeSingle(),
      supabase.from('visits').select('date').eq('logged_by', userId).gte('date', month).lte('date', end),
    ]);
    if (days.error || exps.error || inv.error) {
      setError('Couldn’t load your hours. Check your signal and pull down to try again.');
      return;
    }
    setError('');
    const setting = (k: string) => settings.data?.find((s) => s.key === k)?.value;
    const status: InvoiceStatus = (inv.data?.status as InvoiceStatus | undefined) ?? 'draft';
    const dayDates = new Set((days.data ?? []).map((d) => d.date));
    const visitDates = [...new Set((visits.data ?? []).map((v) => v.date))].filter((d) => !dayDates.has(d)).sort();
    const d = details.data;
    setData({
      days: days.data ?? [],
      expenses: exps.data ?? [],
      invoice: inv.data ?? null,
      status,
      locked: status === 'submitted' || status === 'approved' || status === 'paid',
      hourlyRate: rate.data ? Number(rate.data.hourly_rate) : null,
      mileageRate: Number(setting('mileage_rate')) || DEFAULT_MILEAGE_RATE,
      invoiceTo: typeof setting('invoice_to') === 'string' ? (setting('invoice_to') as string) : 'Societree',
      details: {
        ...EMPTY_DETAILS,
        ...(d ? { address: d.address, phone: d.phone, email: d.email, bank_account_name: d.bank_account_name, bank_sort_code: d.bank_sort_code, bank_account_number: d.bank_account_number } : {}),
        name: d?.invoice_name || profile.data?.name || '',
      },
      visitDaysWithoutHours: visitDates,
    });
  }, [userId, month]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return { data, error, reload: load };
}
