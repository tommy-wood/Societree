import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Text, View } from 'react-native';

import { Button, Card, Field, Message, Screen, SectionTitle, confirmAction } from '@/components/ui';
import { Brand, useColors } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import {
  dayLabel,
  gbp,
  hoursText,
  invoiceHtml,
  invoiceTotals,
  monthLabel,
  STATUS_LABEL,
  type Contractor,
  type Day,
  type Material,
  type Totals,
} from '@/lib/invoice';
import { todayISO } from '@/lib/logic';
import { printHtml } from '@/lib/print';
import { supabase } from '@/lib/supabase';
import { useMonth } from '@/lib/timesheet';

export default function InvoiceScreen() {
  const c = useColors();
  const { session, isFinance } = useAuth();
  const params = useLocalSearchParams<{ month: string; userId?: string }>();
  const userId = params.userId || session?.user.id;
  const own = userId === session?.user.id;
  const { data, error: loadError, reload } = useMonth(userId, params.month);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [returning, setReturning] = useState(false);
  const [reason, setReason] = useState('');
  const [receipts, setReceipts] = useState<Record<string, string>>({});

  useEffect(() => {
    const paths = (data?.expenses ?? []).map((e) => e.receipt_path).filter((p): p is string => !!p);
    if (!paths.length) return;
    supabase.storage
      .from('receipts')
      .createSignedUrls(paths, 3600)
      .then(({ data: urls }) => setReceipts(Object.fromEntries((urls ?? []).filter((u) => u.path && u.signedUrl).map((u) => [u.path as string, u.signedUrl as string]))));
  }, [data?.expenses]);

  if (!data) {
    return (
      <Screen center>
        {loadError ? <Message tone="error">{loadError}</Message> : <ActivityIndicator color={c.accent} />}
      </Screen>
    );
  }

  // A sent invoice shows exactly what was sent; a draft shows the live figures.
  const inv = data.invoice;
  const sent = !!inv && data.status !== 'returned';
  const lines = (sent ? (inv!.lines as { days: Day[]; materials: Material[] }) : null) ?? {
    days: data.days.map((d) => ({ date: d.date, hours: Number(d.hours), miles: Number(d.miles), description: d.description })),
    materials: data.expenses.map((e) => ({ date: e.date, description: e.description, amount: Number(e.amount) })),
  };
  const rate = sent ? Number(inv!.hourly_rate) : (data.hourlyRate ?? 0);
  const mileageRate = sent ? Number(inv!.mileage_rate) : data.mileageRate;
  const contractor = sent ? (inv!.contractor as Contractor) : data.details;
  const totals: Totals = sent
    ? {
        hours: Number(inv!.hours),
        labour: Number(inv!.labour_total),
        miles: Number(inv!.miles),
        mileage: Number(inv!.mileage_total),
        materials: Number(inv!.materials_total),
        total: Number(inv!.total),
      }
    : invoiceTotals(lines.days, lines.materials, rate, mileageRate);
  const number = inv?.number ?? 'Draft';
  const issued = inv?.submitted_at ? inv.submitted_at.slice(0, 10) : todayISO();

  async function run(label: string, fn: () => PromiseLike<{ error: { message: string } | null }>, after?: () => void) {
    setError('');
    setBusy(label);
    const { error: err } = await fn();
    setBusy('');
    if (err) return setError(err.message);
    await reload();
    after?.();
  }

  async function send() {
    if (!data?.details.name.trim()) return setError('Please add your name in “Your invoice details” first.');
    const ok = await confirmAction(
      `Send your ${monthLabel(params.month)} invoice?`,
      `Total ${gbp(totals.total)}. Bethan will see it straight away, and this month will be locked so the figures can’t change.`,
      'Send',
    );
    if (ok) run('send', () => supabase.rpc('submit_invoice', { p_month: params.month }));
  }

  const print = () =>
    printHtml(
      invoiceHtml({
        number,
        month: params.month,
        issued,
        to: data.invoiceTo,
        contractor,
        hourlyRate: rate,
        mileageRate,
        days: lines.days,
        materials: lines.materials,
        totals,
        draft: !sent,
      }),
    );

  const statusColour = data.status === 'returned' ? Brand.urgent : data.status === 'submitted' ? Brand.medium : data.status === 'draft' ? c.muted : Brand.low;
  const bank = contractor.bank_account_name || contractor.bank_sort_code || contractor.bank_account_number;

  return (
    <Screen>
      <Stack.Screen options={{ title: `${own ? 'Your' : contractor.name || 'Invoice'} ${monthLabel(params.month)}` }} />
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ color: c.ink, fontWeight: '700', fontSize: 18 }}>Invoice {number}</Text>
          <Text style={{ color: statusColour, fontWeight: '600' }}>{STATUS_LABEL[data.status]}</Text>
        </View>
        {data.status === 'returned' && inv?.returned_reason ? <Text style={{ color: c.ink, marginTop: 4 }}>Note: “{inv.returned_reason}”</Text> : null}
        <Text style={{ color: c.muted, marginTop: 6 }}>
          From {contractor.name || '(name not set)'} to {data.invoiceTo} · work in {monthLabel(params.month)}
        </Text>
        <View style={{ marginTop: 12, gap: 4 }}>
          <Line label={`Labour: ${hoursText(totals.hours)} × ${gbp(rate)}/h`} value={gbp(totals.labour)} />
          <Line label={`Mileage: ${totals.miles} mi × ${Math.round(mileageRate * 100)}p`} value={gbp(totals.mileage)} />
          <Line label="Materials" value={gbp(totals.materials)} />
          <View style={{ borderTopWidth: 2, borderTopColor: c.ink, marginTop: 6, paddingTop: 6 }}>
            <Line label="Total due (no VAT)" value={gbp(totals.total)} bold />
          </View>
        </View>
      </Card>

      {error ? <Message tone="error">{error}</Message> : null}
      {own && data.hourlyRate == null && !sent ? <Message tone="error">Your hourly rate hasn’t been set yet. Ask Bethan or an admin to set it before sending.</Message> : null}

      {/* Actions */}
      <View style={{ gap: 8, marginTop: 4 }}>
        {own && (data.status === 'draft' || data.status === 'returned') ? (
          <Button title={data.status === 'returned' ? 'Send the corrected invoice' : 'Send invoice to Bethan'} onPress={send} busy={busy === 'send'} disabled={data.hourlyRate == null || totals.total === 0} />
        ) : null}
        {own && data.status === 'submitted' ? (
          <Button variant="ghost" title="Take it back to make changes" busy={busy === 'withdraw'} onPress={() => run('withdraw', () => supabase.rpc('withdraw_invoice', { p_id: inv!.id }))} />
        ) : null}
        {isFinance && !own && data.status === 'submitted' ? (
          <Button title="Sign off" busy={busy === 'approve'} onPress={() => run('approve', () => supabase.rpc('review_invoice', { p_id: inv!.id, p_action: 'approve' }))} />
        ) : null}
        {isFinance && !own && data.status === 'approved' ? (
          <Button title="Mark as paid" busy={busy === 'paid'} onPress={() => run('paid', () => supabase.rpc('review_invoice', { p_id: inv!.id, p_action: 'paid' }))} />
        ) : null}
        {isFinance && !own && (data.status === 'submitted' || data.status === 'approved') ? (
          returning ? (
            <Card>
              <Field label="What needs changing?" value={reason} onChangeText={setReason} multiline style={{ minHeight: 60, textAlignVertical: 'top' }} />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button style={{ flex: 1 }} variant="ghost" title="Cancel" onPress={() => setReturning(false)} />
                <Button
                  style={{ flex: 1 }}
                  variant="danger"
                  title="Send back"
                  busy={busy === 'return'}
                  disabled={!reason.trim()}
                  onPress={() => run('return', () => supabase.rpc('review_invoice', { p_id: inv!.id, p_action: 'return', p_reason: reason.trim() }), () => setReturning(false))}
                />
              </View>
            </Card>
          ) : (
            <Button variant="ghost" title="Send back for changes" onPress={() => setReturning(true)} />
          )
        ) : null}
        <Button variant="ghost" title="Print / save as PDF" onPress={print} />
        {own && !sent ? <Button variant="ghost" title="Edit your invoice details" onPress={() => router.push('/hours/details')} /> : null}
      </View>

      <SectionTitle>{`Days (${lines.days.length})`}</SectionTitle>
      <Card>
        {lines.days.length === 0 ? <Text style={{ color: c.muted }}>No days</Text> : null}
        {lines.days.map((d, i) => (
          <View key={d.date} style={{ paddingVertical: 6, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
            <Line label={dayLabel(d.date)} value={`${hoursText(d.hours)}${d.miles ? ` · ${d.miles} mi` : ''}`} />
            {d.description ? <Text style={{ color: c.muted, fontSize: 14 }}>{d.description}</Text> : null}
          </View>
        ))}
      </Card>

      {lines.materials.length > 0 ? (
        <>
          <SectionTitle>Materials</SectionTitle>
          <Card>
            {lines.materials.map((m, i) => (
              <View key={`${m.date}-${i}`} style={{ paddingVertical: 6, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
                <Line label={`${dayLabel(m.date)} · ${m.description}`} value={gbp(m.amount)} />
              </View>
            ))}
          </Card>
          {Object.keys(receipts).length > 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {data.expenses
                .filter((e) => e.receipt_path && receipts[e.receipt_path])
                .map((e) => (
                  <Button key={e.id} size="small" variant="ghost" title={`🧾 ${e.description}`} onPress={() => Linking.openURL(receipts[e.receipt_path!])} />
                ))}
            </View>
          ) : null}
        </>
      ) : null}

      {bank ? (
        <>
          <SectionTitle>Payment details</SectionTitle>
          <Card>
            {contractor.bank_account_name ? <Text style={{ color: c.ink }}>{contractor.bank_account_name}</Text> : null}
            {contractor.bank_sort_code ? <Text style={{ color: c.ink }}>Sort code {contractor.bank_sort_code}</Text> : null}
            {contractor.bank_account_number ? <Text style={{ color: c.ink }}>Account {contractor.bank_account_number}</Text> : null}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

function Line({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
      <Text style={{ color: c.ink, flex: 1, fontWeight: bold ? '700' : '400', fontSize: bold ? 17 : 15 }}>{label}</Text>
      <Text style={{ color: c.ink, fontWeight: bold ? '700' : '600', fontSize: bold ? 17 : 15 }}>{value}</Text>
    </View>
  );
}
