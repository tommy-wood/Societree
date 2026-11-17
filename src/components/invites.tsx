import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Button, Card, Field, Message, SectionTitle, confirmAction } from '@/components/ui';
import { useColors } from '@/constants/theme';
import { formatDate } from '@/lib/logic';
import { supabase, type Tables } from '@/lib/supabase';

type Invite = Tables<'invites'>;

/** Admins: people who get set up automatically when they sign up and confirm their email. */
export function Invites({ onChange }: { onChange?: () => void }) {
  const c = useColors();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [adding, setAdding] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [admin, setAdmin] = useState(false);
  const [signOff, setSignOff] = useState(false);
  const [rate, setRate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const { data } = await supabase.from('invites').select('*').order('created_at');
    setInvites(data ?? []);
  }, []);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function add() {
    setError('');
    const e = email.trim().toLowerCase();
    const r = rate.trim() ? Number(rate.replace('£', '').replace(',', '.')) : null;
    if (!/^\S+@\S+\.\S+$/.test(e)) return setError('Please enter their email address.');
    if (r !== null && !(r > 0 && r < 1000)) return setError('Hourly rate should be in pounds, e.g. 15 (or leave it empty if they aren’t a contractor).');
    setBusy(true);
    const { error: err } = await supabase.from('invites').upsert({
      email: e,
      name: name.trim(),
      role: admin ? 'admin' : 'volunteer',
      can_sign_off: signOff,
      hourly_rate: r === null ? null : Math.round(r * 100) / 100,
      used_at: null,
      used_by: null,
    });
    setBusy(false);
    if (err) return setError('Couldn’t save, please try again.');
    setEmail('');
    setName('');
    setAdmin(false);
    setSignOff(false);
    setRate('');
    setAdding(false);
    load();
    onChange?.();
  }

  async function remove(i: Invite) {
    if (!(await confirmAction(`Remove ${i.email}?`, i.used_at ? 'They have already joined; this only removes them from this list.' : 'If they sign up later they’ll wait for approval as usual.', 'Remove'))) return;
    await supabase.from('invites').delete().eq('email', i.email);
    load();
  }

  const describe = (i: Invite) =>
    [i.role === 'admin' ? 'Admin' : 'Volunteer', i.can_sign_off ? 'signs off invoices' : '', i.hourly_rate != null ? `£${Number(i.hourly_rate).toFixed(2)}/h` : ''].filter(Boolean).join(' · ');

  return (
    <>
      <SectionTitle>Pre-approved people</SectionTitle>
      <Message>People on this list are set up automatically when they sign up with this email and confirm it, so they don’t wait for approval.</Message>
      {invites.map((i) => (
        <Card key={i.email}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.ink, fontWeight: '600' }}>{i.name || i.email}</Text>
              {i.name ? <Text style={{ color: c.muted, fontSize: 13 }}>{i.email}</Text> : null}
              <Text style={{ color: c.muted, fontSize: 13 }}>{describe(i)}</Text>
              <Text style={{ color: i.used_at ? c.accent : c.muted, fontSize: 13, fontWeight: '600' }}>
                {i.used_at ? `Joined ${formatDate(i.used_at.slice(0, 10))}` : 'Waiting for them to sign up'}
              </Text>
            </View>
            <Button size="small" variant="ghost" title="Remove" onPress={() => remove(i)} />
          </View>
        </Card>
      ))}
      {adding ? (
        <Card>
          <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} inputMode="email" />
          <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. Ryan Gaffney" />
          <Tick label="Admin (approves people, adds and deletes sites)" value={admin} onChange={setAdmin} />
          <Tick label="Signs off invoices (sees everyone’s hours and bank details)" value={signOff} onChange={setSignOff} />
          <Field label="Hourly rate if they’re a contractor (£, optional)" value={rate} onChangeText={setRate} keyboardType="decimal-pad" inputMode="decimal" placeholder="15" />
          {error ? <Message tone="error">{error}</Message> : null}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button style={{ flex: 1 }} variant="ghost" title="Cancel" onPress={() => setAdding(false)} />
            <Button style={{ flex: 1 }} title="Add" onPress={add} busy={busy} />
          </View>
        </Card>
      ) : (
        <Button variant="ghost" title="+ Pre-approve someone" onPress={() => setAdding(true)} />
      )}
    </>
  );
}

function Tick({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, marginBottom: 4 }}>
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 6,
          borderWidth: 2,
          borderColor: value ? c.accent : c.muted,
          backgroundColor: value ? c.accent : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        {value ? <Text style={{ color: c.accentInk, fontWeight: '900', fontSize: 13 }}>✓</Text> : null}
      </View>
      <Text style={{ color: c.ink, flex: 1 }}>{label}</Text>
    </Pressable>
  );
}
