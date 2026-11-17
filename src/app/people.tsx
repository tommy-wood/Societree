import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { Button, Card, Message, Screen, SectionTitle } from '@/components/ui';
import { Brand, useColors } from '@/constants/theme';
import { useAuth, type Profile, type Role } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

const ROLE_ORDER: Record<string, number> = { pending: 0, admin: 1, volunteer: 2 };

export default function People() {
  const c = useColors();
  const { profile: me } = useAuth();
  const [people, setPeople] = useState<Profile[] | null>(null);
  const [legacy, setLegacy] = useState<{ name: string; count: number }[]>([]);
  const [linking, setLinking] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const [{ data: ps, error: pErr }, { data: vs }] = await Promise.all([
      supabase.from('profiles').select('*'),
      supabase.from('visits').select('legacy_logged_by').is('logged_by', null).not('legacy_logged_by', 'is', null),
    ]);
    if (pErr) return setError('Couldn’t load people. Go back and open this page again to retry.');
    setPeople([...(ps ?? [])].sort((a, b) => (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9) || a.name.localeCompare(b.name)));
    const counts = new Map<string, number>();
    for (const v of vs ?? []) if (v.legacy_logged_by) counts.set(v.legacy_logged_by, (counts.get(v.legacy_logged_by) ?? 0) + 1);
    setLegacy([...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function setRole(p: Profile, role: Role) {
    setError('');
    setBusyId(p.id);
    const { error: err } = await supabase.from('profiles').update({ role }).eq('id', p.id);
    setBusyId(null);
    if (err) setError(err.message.includes('at least one admin') ? 'There must always be at least one admin.' : 'Couldn’t change that, please try again.');
    load();
  }

  async function link(name: string, profileId: string) {
    setError('');
    setBusyId(profileId);
    const { error: err } = await supabase.rpc('link_legacy_visits', { p_legacy_name: name, p_profile_id: profileId });
    setBusyId(null);
    setLinking(null);
    if (err) setError('Couldn’t link those visits, please try again.');
    load();
  }

  if (!people) {
    return (
      <Screen center>
        {error ? <Message tone="error">{error}</Message> : <ActivityIndicator color={c.accent} />}
      </Screen>
    );
  }

  const members = people.filter((p) => p.role !== 'pending');
  const pendingCount = people.length - members.length;

  return (
    <Screen>
      {error ? <Message tone="error">{error}</Message> : null}
      <SectionTitle>{pendingCount ? `Waiting for approval (${pendingCount})` : 'People'}</SectionTitle>
      {people.map((p) => {
        const self = p.id === me?.id;
        const busy = busyId === p.id;
        return (
          <Card key={p.id}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ color: c.ink, fontWeight: '700', fontSize: 16, flex: 1 }}>
                {p.name || 'No name'}
                {self ? <Text style={{ color: c.muted, fontWeight: '400' }}> (you)</Text> : null}
              </Text>
              <RoleChip role={p.role} />
            </View>
            {!self && (
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                {p.role === 'pending' && <Button size="small" title="Approve" busy={busy} onPress={() => setRole(p, 'volunteer')} />}
                {p.role === 'volunteer' && (
                  <>
                    <Button size="small" variant="ghost" title="Make admin" disabled={busy} onPress={() => setRole(p, 'admin')} />
                    <Button size="small" variant="ghost" title="Remove access" disabled={busy} onPress={() => setRole(p, 'pending')} />
                  </>
                )}
                {p.role === 'admin' && <Button size="small" variant="ghost" title="Make volunteer" disabled={busy} onPress={() => setRole(p, 'volunteer')} />}
              </View>
            )}
          </Card>
        );
      })}

      {legacy.length > 0 && (
        <>
          <SectionTitle>Visits from the old app</SectionTitle>
          <Message>These names were typed into the old app. Link each one to a person here so their visits show under their account.</Message>
          {legacy.map((l) => (
            <Card key={l.name}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ color: c.ink, fontWeight: '600', flex: 1 }}>
                  {l.name} <Text style={{ color: c.muted, fontWeight: '400' }}>· {l.count} visit{l.count === 1 ? '' : 's'}</Text>
                </Text>
                <Button size="small" variant="ghost" title={linking === l.name ? 'Cancel' : 'Link to…'} onPress={() => setLinking(linking === l.name ? null : l.name)} />
              </View>
              {linking === l.name && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                  {members.map((m) => (
                    <Button key={m.id} size="small" title={m.name || 'No name'} busy={busyId === m.id} onPress={() => link(l.name, m.id)} />
                  ))}
                </View>
              )}
            </Card>
          ))}
        </>
      )}
    </Screen>
  );
}

function RoleChip({ role }: { role: string }) {
  const c = useColors();
  const bg = role === 'pending' ? Brand.medium : role === 'admin' ? c.accent : c.line;
  const fg = role === 'volunteer' ? c.ink : '#fff';
  const label = role === 'pending' ? 'Pending' : role === 'admin' ? 'Admin' : 'Volunteer';
  return (
    <View style={{ backgroundColor: bg, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 3 }}>
      <Text style={{ color: fg, fontSize: 12, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}
