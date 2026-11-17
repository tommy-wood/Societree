import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';

import { LocationPicker } from '@/components/sites-map';
import { Button, Message, Screen } from '@/components/ui';
import { useColors } from '@/constants/theme';
import { useData } from '@/lib/data';
import { currentPosition, saveSiteLocation, searchPlaces, type LatLng, type Place } from '@/lib/geo';

export default function SetLocation() {
  const c = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { sites, reload } = useData();
  const site = sites.find((s) => s.id === id);

  const [pos, setPos] = useState<LatLng | null>(site?.lat != null && site?.lng != null ? { lat: site.lat, lng: site.lng } : null);
  const [query, setQuery] = useState(site ? defaultQuery(site.name, site.address) : '');
  const [results, setResults] = useState<Place[] | null>(null);
  const [busy, setBusy] = useState<'' | 'gps' | 'search' | 'save'>('');
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  async function useGps() {
    setError('');
    setBusy('gps');
    const r = await currentPosition();
    setBusy('');
    if (!r.ok) return setError(r.error);
    setPos(r.pos);
    setResults(null);
    setNote(r.accuracy ? `Got your location (to within about ${Math.round(r.accuracy)} m). Drag the pin if it’s not quite right.` : 'Got your location.');
  }

  async function search() {
    setError('');
    setNote('');
    setBusy('search');
    try {
      const r = await searchPlaces(query);
      setResults(r);
      if (r.length === 1) choose(r[0]);
      if (r.length === 0) setError('Nothing found. Try a postcode, a street name, or a nearby school or park.');
    } catch {
      setError('Couldn’t search right now. Check your signal and try again.');
    } finally {
      setBusy('');
    }
  }

  function choose(p: Place) {
    setPos(p.pos);
    setNote('Moved the pin there. Drag it, or tap the map, to put it exactly on the forest.');
  }

  async function save() {
    if (!pos) return setError('Set the location first.');
    setBusy('save');
    const { error: err } = await saveSiteLocation(id, pos);
    setBusy('');
    if (err) return setError('Couldn’t save the location, please try again.');
    await reload(true);
    router.back();
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: site ? `Location: ${site.name}` : 'Set location' }} />
      <Button title="📍 Use my current location" onPress={useGps} busy={busy === 'gps'} />
      <Text style={{ color: c.muted, fontSize: 13, marginTop: 6, marginBottom: 14 }}>Best when you’re standing at the forest.</Text>

      <Text style={{ color: c.muted, fontSize: 13, marginBottom: 4 }}>Or search for an address or postcode</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={search}
          returnKeyType="search"
          accessibilityLabel="Address or postcode"
          placeholder="e.g. PL4 9AA or Beaumont Park"
          placeholderTextColor={c.muted}
          style={{ flex: 1, borderWidth: 1, borderColor: c.line, backgroundColor: c.card, color: c.ink, borderRadius: 10, padding: 12, fontSize: 16 }}
        />
        <Button size="small" title="Search" onPress={search} busy={busy === 'search'} disabled={!query.trim()} />
      </View>
      {results && results.length > 1 ? (
        <View style={{ marginTop: 8, borderWidth: 1, borderColor: c.line, borderRadius: 10, backgroundColor: c.card }}>
          {results.map((r, i) => (
            <Pressable
              key={`${r.pos.lat},${r.pos.lng},${i}`}
              accessibilityRole="button"
              onPress={() => choose(r)}
              style={({ pressed }) => ({ padding: 12, borderTopWidth: i ? 1 : 0, borderTopColor: c.line, opacity: pressed ? 0.7 : 1 })}>
              <Text style={{ color: c.ink }} numberOfLines={2}>
                {r.label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {error ? <Message tone="error">{error}</Message> : null}
      {note ? <Message>{note}</Message> : null}

      <View style={{ height: 340, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: c.line, marginTop: 12, marginBottom: 12 }}>
        <LocationPicker value={pos} onChange={setPos} />
      </View>
      <Text style={{ color: c.muted, fontSize: 13, marginBottom: 12 }}>
        {pos ? `Pin: ${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}` : 'Tap the map to drop a pin.'}
      </Text>
      {busy === 'save' ? <ActivityIndicator color={c.accent} /> : <Button title="Save location" onPress={save} disabled={!pos} />}
    </Screen>
  );
}

/** "Name, address" works best for OpenStreetMap search; a bare postcode district like "PL4" doesn't, so use the town. */
function defaultQuery(name: string, address: string) {
  const a = address.trim();
  if (!a || /^[A-Z]{1,2}\d{1,2}[A-Z]?$/i.test(a)) return `${name}, Plymouth`;
  return `${name}, ${a}`;
}
