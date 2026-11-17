import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, Field, Message, Screen, confirmAction } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useData, type Site } from '@/lib/data';
import { supabase } from '@/lib/supabase';

type Values = Pick<Site, 'name' | 'address' | 'contact' | 'contact_email' | 'notes'>;

/** Add a site (admins) or edit one (any member). */
export function SiteForm({ site }: { site?: Site }) {
  const { isAdmin } = useAuth();
  const { reload } = useData();
  const [v, setV] = useState<Values>({
    name: site?.name ?? '',
    address: site?.address ?? '',
    contact: site?.contact ?? '',
    contact_email: site?.contact_email ?? '',
    notes: site?.notes ?? '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k: keyof Values) => (t: string) => setV((x) => ({ ...x, [k]: t }));

  async function save() {
    setError('');
    const clean = Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x.trim()])) as Values;
    if (!clean.name) return setError('Please give the site a name.');
    if (clean.contact_email && !/^\S+@\S+\.\S+$/.test(clean.contact_email)) return setError('That email address doesn’t look right.');
    setBusy(true);
    const res = site
      ? await supabase.from('sites').update(clean).eq('id', site.id).select('id').single()
      : await supabase.from('sites').insert(clean).select('id').single();
    setBusy(false);
    if (res.error) return setError('Couldn’t save, please try again.');
    await reload(true);
    if (site) router.back();
    else router.replace({ pathname: '/site/[id]', params: { id: res.data.id } });
  }

  async function remove() {
    if (!site) return;
    const ok = await confirmAction(`Delete ${site.name}?`, 'This also deletes all of its visits, photos and jobs. It can’t be undone.');
    if (!ok) return;
    setBusy(true);
    const { error: err } = await supabase.from('sites').delete().eq('id', site.id);
    setBusy(false);
    if (err) return setError('Couldn’t delete the site, please try again.');
    await reload(true);
    router.dismissTo('/sites');
  }

  return (
    <Screen>
      <Field label="Name" value={v.name} onChangeText={set('name')} autoCapitalize="words" />
      <Field label="Address" value={v.address} onChangeText={set('address')} placeholder="Street, town, postcode" />
      <Field label="Contact" value={v.contact} onChangeText={set('contact')} placeholder="Name and phone number" />
      <Field label="Contact email" value={v.contact_email} onChangeText={set('contact_email')} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} inputMode="email" />
      <Field label="Notes" value={v.notes} onChangeText={set('notes')} multiline style={{ minHeight: 90, textAlignVertical: 'top' }} placeholder="Access, where tools are kept, gate codes…" />
      {error ? <Message tone="error">{error}</Message> : null}
      <Button title={site ? 'Save changes' : 'Add site'} onPress={save} busy={busy} />
      {site && isAdmin ? (
        <View style={{ marginTop: 32 }}>
          <Button variant="danger" title="Delete site" onPress={remove} disabled={busy} />
        </View>
      ) : null}
    </Screen>
  );
}
