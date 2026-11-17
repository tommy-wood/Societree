import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Text, TextInput, View } from 'react-native';

import { Button, Card, Message, Screen, SectionTitle, confirmAction } from '@/components/ui';
import { useColors } from '@/constants/theme';
import { gbp } from '@/lib/invoice';
import { supabase } from '@/lib/supabase';

type Person = { id: string; name: string; role: string; rate: number | null };

/** Admins and sign-off people set contractors' hourly rates. Having a rate makes someone a contractor. */
export default function Rates() {
  const c = useColors();
  const [people, setPeople] = useState<Person[] | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');

  const load = useCallback(async () => {
    const [ps, rs] = await Promise.all([supabase.from('profiles').select('id, name, role'), supabase.from('contractor_rates').select('user_id, hourly_rate')]);
    if (ps.error || rs.error) return setError('Couldn’t load rates.');
    setPeople(
      (ps.data ?? [])
        .filter((p) => p.role !== 'pending')
        .map((p) => {
          const r = rs.data?.find((x) => x.user_id === p.id);
          return { id: p.id, name: p.name || 'No name', role: p.role, rate: r ? Number(r.hourly_rate) : null };
        })
        .sort((a, b) => Number(b.rate != null) - Number(a.rate != null) || a.name.localeCompare(b.name)),
    );
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function save(p: Person) {
    setError('');
    setSaved('');
    const value = Number((edits[p.id] ?? '').replace('£', '').replace(',', '.'));
    if (!(value > 0 && value < 1000)) return setError(`Enter ${p.name}’s hourly rate in pounds, e.g. 15 or 17.50`);
    setBusy(p.id);
    const { error: err } = await supabase.from('contractor_rates').upsert({ user_id: p.id, hourly_rate: Math.round(value * 100) / 100 });
    setBusy('');
    if (err) return setError('Couldn’t save the rate, please try again.');
    setEdits((e) => ({ ...e, [p.id]: '' }));
    setSaved(`${p.name}: ${gbp(value)} an hour. Applies to invoices sent from now on.`);
    load();
  }

  async function remove(p: Person) {
    if (!(await confirmAction(`Remove ${p.name} as a contractor?`, 'Their hours stay saved, but they won’t be able to send invoices until a rate is set again.', 'Remove'))) return;
    setBusy(p.id);
    await supabase.from('contractor_rates').delete().eq('user_id', p.id);
    setBusy('');
    load();
  }

  if (!people) {
    return (
      <Screen center>
        {error ? <Message tone="error">{error}</Message> : <ActivityIndicator color={c.accent} />}
      </Screen>
    );
  }

  const contractors = people.filter((p) => p.rate != null);
  const others = people.filter((p) => p.rate == null);
  const input = (p: Person) => (
    <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, alignItems: 'center' }}>
      <Text style={{ color: c.ink }}>£</Text>
      <TextInput
        value={edits[p.id] ?? ''}
        onChangeText={(t) => setEdits((e) => ({ ...e, [p.id]: t }))}
        placeholder={p.rate != null ? String(p.rate) : '15.00'}
        placeholderTextColor={c.muted}
        keyboardType="decimal-pad"
        inputMode="decimal"
        accessibilityLabel={`Hourly rate for ${p.name}`}
        style={{ flex: 1, borderWidth: 1, borderColor: c.line, backgroundColor: c.bg, color: c.ink, borderRadius: 10, padding: 10, fontSize: 16 }}
      />
      <Text style={{ color: c.muted }}>/hour</Text>
      <Button size="small" title={p.rate != null ? 'Change' : 'Set'} accessibilityLabel={`Save rate for ${p.name}`} busy={busy === p.id} onPress={() => save(p)} />
    </View>
  );

  return (
    <Screen>
      {error ? <Message tone="error">{error}</Message> : null}
      {saved ? <Message tone="success">{saved}</Message> : null}
      <SectionTitle>{`Contractors (${contractors.length})`}</SectionTitle>
      {contractors.length === 0 ? <Message>No one yet. Set a rate for someone below to make them a contractor.</Message> : null}
      {contractors.map((p) => (
        <Card key={p.id}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: c.ink, fontWeight: '700', fontSize: 16 }}>{p.name}</Text>
            <Text style={{ color: c.ink, fontWeight: '700' }}>{gbp(p.rate!)}/h</Text>
          </View>
          {input(p)}
          <Button size="small" variant="ghost" title="Not a contractor" style={{ marginTop: 8, alignSelf: 'flex-start' }} onPress={() => remove(p)} />
        </Card>
      ))}
      {others.length > 0 ? (
        <>
          <SectionTitle>Everyone else</SectionTitle>
          {others.map((p) => (
            <Card key={p.id}>
              <Text style={{ color: c.ink, fontWeight: '600' }}>{p.name}</Text>
              {input(p)}
            </Card>
          ))}
        </>
      ) : null}
    </Screen>
  );
}
