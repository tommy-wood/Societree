import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button, Card, Field, Message, Screen, SectionTitle } from '@/components/ui';
import { useColors } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export default function Account() {
  const c = useColors();
  const { profile, session, isAdmin, refreshProfile, signOut } = useAuth();
  const [name, setName] = useState(profile?.name ?? '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);

  async function saveName() {
    if (!profile) return;
    const n = name.trim();
    if (!n) return setMsg({ tone: 'error', text: 'Name can’t be empty.' });
    setBusy(true);
    const { error } = await supabase.from('profiles').update({ name: n }).eq('id', profile.id);
    setBusy(false);
    if (error) return setMsg({ tone: 'error', text: 'Couldn’t save, please try again.' });
    await refreshProfile();
    setMsg({ tone: 'success', text: 'Saved ✓' });
  }

  return (
    <Screen>
      <Card>
        <Text style={{ color: c.muted }}>Signed in as</Text>
        <Text style={{ color: c.ink, fontSize: 16, fontWeight: '600' }}>{session?.user.email}</Text>
        <Text style={{ color: c.muted, marginTop: 4 }}>{isAdmin ? 'Admin' : 'Volunteer'}</Text>
      </Card>

      <SectionTitle>Your name</SectionTitle>
      <Field label="Shown on the visits you log" value={name} onChangeText={setName} autoComplete="name" onSubmitEditing={saveName} />
      {msg ? <Message tone={msg.tone}>{msg.text}</Message> : null}
      <Button title="Save name" onPress={saveName} busy={busy} disabled={name.trim() === (profile?.name ?? '')} />

      {isAdmin && (
        <>
          <SectionTitle>Admin</SectionTitle>
          <Button title="People and approvals" variant="ghost" onPress={() => router.push('/people')} />
        </>
      )}

      <View style={{ marginTop: 32 }}>
        <Button title="Sign out" variant="ghost" onPress={signOut} />
      </View>
    </Screen>
  );
}
