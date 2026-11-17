import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { Button, Message, Screen, SectionTitle } from '@/components/ui';
import { Brand, useColors } from '@/constants/theme';
import { addMonths, gbp, hoursText, invoiceTotals, lastDayOfMonth, monthLabel, monthOf, STATUS_LABEL, type InvoiceStatus } from '@/lib/invoice';
import { todayISO } from '@/lib/logic';
import { supabase } from '@/lib/supabase';

type Row = { userId: string; name: string; status: InvoiceStatus; total: number; hours: number; number?: string };

const ORDER: Record<InvoiceStatus, number> = { submitted: 0, approved: 1, returned: 2, draft: 3, paid: 4 };

/** For whoever signs off invoices: every contractor's invoice for a month. */
export default function Team() {
  const c = useColors();
  const thisMonth = monthOf(todayISO());
  // Invoices are usually sent at the start of the next month, so open on last month.
  const [month, setMonth] = useState(addMonths(thisMonth, -1));
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const end = lastDayOfMonth(month);
    const [rates, invs, days, exps, profiles, settings] = await Promise.all([
      supabase.from('contractor_rates').select('user_id, hourly_rate'),
      supabase.from('invoices').select('user_id, status, total, hours, number').eq('month', month),
      supabase.from('work_days').select('user_id, date, hours, miles, description').gte('date', month).lte('date', end),
      supabase.from('expenses').select('user_id, date, description, amount').gte('date', month).lte('date', end),
      supabase.from('profiles').select('id, name'),
      supabase.from('app_settings').select('value').eq('key', 'mileage_rate').maybeSingle(),
    ]);
    if (rates.error || invs.error) return setError('Couldn’t load invoices. Pull down to try again.');
    setError('');
    const mileageRate = Number(settings.data?.value) || 0.45;
    const name = (id: string) => profiles.data?.find((p) => p.id === id)?.name || 'Unknown';
    const people = new Set([...(rates.data ?? []).map((r) => r.user_id), ...(invs.data ?? []).map((i) => i.user_id)]);
    const out: Row[] = [...people].map((id) => {
      const inv = invs.data?.find((i) => i.user_id === id);
      if (inv && inv.status !== 'returned') {
        return { userId: id, name: name(id), status: inv.status as InvoiceStatus, total: Number(inv.total), hours: Number(inv.hours), number: inv.number };
      }
      const rate = Number(rates.data?.find((r) => r.user_id === id)?.hourly_rate ?? 0);
      const t = invoiceTotals(
        (days.data ?? []).filter((d) => d.user_id === id).map((d) => ({ ...d, hours: Number(d.hours), miles: Number(d.miles) })),
        (exps.data ?? []).filter((e) => e.user_id === id).map((e) => ({ ...e, amount: Number(e.amount) })),
        rate,
        mileageRate,
      );
      return { userId: id, name: name(id), status: (inv?.status as InvoiceStatus | undefined) ?? 'draft', total: t.total, hours: t.hours, number: inv?.number };
    });
    setRows(out.sort((a, b) => ORDER[a.status] - ORDER[b.status] || a.name.localeCompare(b.name)));
  }, [month]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const waiting = rows?.filter((r) => r.status === 'submitted').length ?? 0;
  const toPay = rows?.filter((r) => r.status === 'approved').reduce((n, r) => n + r.total, 0) ?? 0;

  return (
    <Screen onRefresh={load}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <Button size="small" variant="ghost" title="‹" accessibilityLabel="Previous month" onPress={() => setMonth(addMonths(month, -1))} />
        <Text style={{ color: c.ink, fontWeight: '700', fontSize: 18 }}>{monthLabel(month)}</Text>
        <Button size="small" variant="ghost" title="›" accessibilityLabel="Next month" disabled={month >= thisMonth} onPress={() => setMonth(addMonths(month, 1))} />
      </View>
      {error ? <Message tone="error">{error}</Message> : null}
      {!rows ? (
        <ActivityIndicator color={c.accent} style={{ marginTop: 40 }} />
      ) : (
        <>
          <Message>
            {waiting ? `${waiting} invoice${waiting > 1 ? 's' : ''} waiting for you to sign off. ` : 'Nothing waiting for sign-off. '}
            {toPay ? `${gbp(toPay)} signed off and waiting to be paid.` : ''}
          </Message>
          {rows.length === 0 ? <Message>No contractors yet. Set someone’s hourly rate to add them.</Message> : null}
          {rows.map((r) => {
            const colour = r.status === 'submitted' ? Brand.medium : r.status === 'returned' ? Brand.urgent : r.status === 'draft' ? c.muted : Brand.low;
            return (
              <Pressable
                key={r.userId}
                accessibilityRole="button"
                onPress={() => router.push({ pathname: '/hours/invoice', params: { month, userId: r.userId } })}
                style={({ pressed }) => ({ backgroundColor: c.card, borderColor: r.status === 'submitted' ? Brand.medium : c.line, borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 10, opacity: pressed ? 0.85 : 1 })}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: c.ink, fontWeight: '700', fontSize: 16 }}>{r.name}</Text>
                  <Text style={{ color: c.ink, fontWeight: '700', fontSize: 16 }}>{gbp(r.total)}</Text>
                </View>
                <Text style={{ color: colour, fontWeight: '600', marginTop: 2 }}>
                  {r.number ? `${r.number} · ` : ''}
                  {r.status === 'draft' ? 'Not sent yet (running total)' : STATUS_LABEL[r.status]}
                </Text>
                <Text style={{ color: c.muted, fontSize: 14 }}>{hoursText(r.hours)}</Text>
              </Pressable>
            );
          })}
        </>
      )}
      <SectionTitle>Settings</SectionTitle>
      <Button variant="ghost" title="Hourly rates" onPress={() => router.push('/rates')} />
    </Screen>
  );
}
