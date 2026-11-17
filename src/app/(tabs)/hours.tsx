import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { Button, Card, LinkText, Message, Screen, SectionTitle } from '@/components/ui';
import { Brand, useColors } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { addMonths, dayLabel, gbp, hoursText, invoiceTotals, monthLabel, monthOf, STATUS_LABEL } from '@/lib/invoice';
import { todayISO } from '@/lib/logic';
import { useMonth } from '@/lib/timesheet';

export default function Hours() {
  const c = useColors();
  const { session, isFinance } = useAuth();
  const thisMonth = monthOf(todayISO());
  const [month, setMonth] = useState(thisMonth);
  const { data, error, reload } = useMonth(session?.user.id, month);

  const totals = data ? invoiceTotals(data.days.map(numDay), data.expenses.map(numExp), data.hourlyRate ?? 0, data.mileageRate) : null;
  const statusColour = data?.status === 'returned' ? Brand.urgent : data?.status === 'paid' || data?.status === 'approved' ? Brand.low : data?.status === 'submitted' ? Brand.medium : c.muted;

  return (
    <Screen onRefresh={reload}>
      {isFinance ? <Button title="Team invoices" variant="ghost" onPress={() => router.push('/team')} style={{ marginBottom: 12 }} /> : null}

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <Button size="small" variant="ghost" title="‹" accessibilityLabel="Previous month" onPress={() => setMonth(addMonths(month, -1))} />
        <Text style={{ color: c.ink, fontWeight: '700', fontSize: 18 }}>{monthLabel(month)}</Text>
        <Button size="small" variant="ghost" title="›" accessibilityLabel="Next month" disabled={month >= thisMonth} onPress={() => setMonth(addMonths(month, 1))} />
      </View>

      {error ? <Message tone="error">{error}</Message> : null}
      {!data || !totals ? (
        <ActivityIndicator color={c.accent} style={{ marginTop: 40 }} />
      ) : (
        <>
          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Text style={{ color: c.muted }}>This month so far</Text>
              <Text style={{ color: c.ink, fontWeight: '700', fontSize: 24 }}>{gbp(data.invoice && data.locked ? Number(data.invoice.total) : totals.total)}</Text>
            </View>
            <Text style={{ color: c.muted, marginTop: 4 }}>
              {hoursText(totals.hours)}
              {data.hourlyRate != null ? ` × ${gbp(data.hourlyRate)}` : ''} · {totals.miles} miles · {gbp(totals.materials)} materials
            </Text>
            <Text style={{ color: statusColour, fontWeight: '600', marginTop: 8 }}>
              {data.invoice ? `${data.invoice.number}: ` : ''}
              {STATUS_LABEL[data.status]}
            </Text>
            {data.status === 'returned' && data.invoice?.returned_reason ? (
              <Text style={{ color: c.ink, marginTop: 4 }}>“{data.invoice.returned_reason}”</Text>
            ) : null}
            {data.hourlyRate == null ? (
              <Message>Your hourly rate hasn’t been set yet, so you can’t send an invoice. Ask Bethan or an admin to set it.</Message>
            ) : null}
            <Button
              style={{ marginTop: 12 }}
              title={data.locked ? 'View invoice' : 'Review and send invoice'}
              variant={data.locked ? 'ghost' : 'primary'}
              disabled={!data.locked && totals.total === 0}
              onPress={() => router.push({ pathname: '/hours/invoice', params: { month } })}
            />
          </Card>

          {!data.locked && data.visitDaysWithoutHours.length > 0 ? (
            <Card style={{ borderColor: Brand.medium }}>
              <Text style={{ color: c.ink, fontWeight: '600' }}>You logged visits on these days but haven’t added hours:</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                {data.visitDaysWithoutHours.map((d) => (
                  <Button key={d} size="small" variant="ghost" title={`+ ${dayLabel(d)}`} onPress={() => router.push({ pathname: '/hours/day', params: { date: d } })} />
                ))}
              </View>
            </Card>
          ) : null}

          <SectionTitle>{`Days worked (${data.days.length})`}</SectionTitle>
          {data.days.map((d) => (
            <Row
              key={d.id}
              locked={data.locked}
              onPress={() => router.push({ pathname: '/hours/day', params: { id: d.id } })}
              title={dayLabel(d.date)}
              detail={d.description}
              right={`${hoursText(Number(d.hours))}${Number(d.miles) ? ` · ${Number(d.miles)} mi` : ''}`}
            />
          ))}
          {!data.locked ? <Button title="+ Add a day" onPress={() => router.push({ pathname: '/hours/day', params: { date: month === thisMonth ? todayISO() : month } })} /> : null}

          <SectionTitle>{`Materials bought (${data.expenses.length})`}</SectionTitle>
          {data.expenses.map((e) => (
            <Row
              key={e.id}
              locked={data.locked}
              onPress={() => router.push({ pathname: '/hours/material', params: { id: e.id } })}
              title={e.description}
              detail={`${dayLabel(e.date)}${e.receipt_path ? ' · 🧾 receipt' : ''}`}
              right={gbp(Number(e.amount))}
            />
          ))}
          {!data.locked ? (
            <Button variant="ghost" title="+ Add materials" onPress={() => router.push({ pathname: '/hours/material', params: { date: month === thisMonth ? todayISO() : month } })} />
          ) : null}

          {data.locked ? <Message>This month has been invoiced, so it’s locked. If something needs changing, take the invoice back (if it hasn’t been signed off) or ask Bethan to send it back.</Message> : null}

          <View style={{ marginTop: 24 }}>
            <LinkText onPress={() => router.push('/hours/details')}>Your invoice details (name, address, bank)</LinkText>
          </View>
        </>
      )}
    </Screen>
  );
}

const numDay = (d: { date: string; hours: number; miles: number; description: string }) => ({ ...d, hours: Number(d.hours), miles: Number(d.miles) });
const numExp = (e: { date: string; description: string; amount: number }) => ({ ...e, amount: Number(e.amount) });

function Row({ title, detail, right, onPress, locked }: { title: string; detail: string; right: string; onPress: () => void; locked: boolean }) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={locked}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: c.card,
        borderColor: c.line,
        borderWidth: 1,
        borderRadius: 12,
        padding: 12,
        marginBottom: 8,
        opacity: pressed ? 0.8 : 1,
      })}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: c.ink, fontWeight: '600' }}>{title}</Text>
        {detail ? (
          <Text style={{ color: c.muted, fontSize: 14 }} numberOfLines={2}>
            {detail}
          </Text>
        ) : null}
      </View>
      <Text style={{ color: c.ink, fontWeight: '600' }}>{right}</Text>
    </Pressable>
  );
}
