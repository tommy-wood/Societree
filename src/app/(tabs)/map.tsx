import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SitesMap } from '@/components/sites-map';
import type { MapPin } from '@/components/sites-map.types';
import { PriorityDot } from '@/components/sites';
import { Button, Message } from '@/components/ui';
import { PIN_COLOURS, PIN_LABELS, useColors } from '@/constants/theme';
import { useData, useRefreshOnFocus } from '@/lib/data';
import { directionsUrl, pinStatus, visitedText, type PinStatus } from '@/lib/logic';

const ORDER: PinStatus[] = ['urgent', 'medium', 'overdue', 'ok'];

export default function MapScreen() {
  const c = useColors();
  const { sites, overdueDays, error } = useData();
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showMissing, setShowMissing] = useState(false);
  useRefreshOnFocus();

  const located = sites.filter((s) => s.lat != null && s.lng != null);
  const missing = sites.filter((s) => s.lat == null || s.lng == null);
  const pins = useMemo<MapPin[]>(
    () =>
      located
        .filter((s) => !attentionOnly || s.needsAttention)
        .map((s) => ({ id: s.id, name: s.name, lat: s.lat as number, lng: s.lng as number, status: pinStatus(s, overdueDays) })),
    [located, attentionOnly, overdueDays],
  );
  const selected = sites.find((s) => s.id === selectedId) ?? null;

  const overlay = { backgroundColor: c.card, borderColor: c.line, borderWidth: 1, borderRadius: 12, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, elevation: 3 };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <SitesMap pins={pins} selectedId={selectedId} onSelect={setSelectedId} />

      {/* Key and filter */}
      <View pointerEvents="box-none" style={{ position: 'absolute', top: 10, left: 10, right: 60, gap: 8, alignItems: 'flex-start' }}>
        <View style={[overlay, { padding: 10, gap: 4 }]} accessibilityLabel="Map key">
          {ORDER.map((k) => (
            <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: PIN_COLOURS[k], borderWidth: 1.5, borderColor: '#fff' }} />
              <Text style={{ color: c.ink, fontSize: 12 }}>{PIN_LABELS[k]}</Text>
            </View>
          ))}
        </View>
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: attentionOnly }}
          onPress={() => setAttentionOnly(!attentionOnly)}
          style={[overlay, { paddingVertical: 8, paddingHorizontal: 12, backgroundColor: attentionOnly ? c.accent : c.card, borderColor: attentionOnly ? c.accent : c.line }]}>
          <Text style={{ color: attentionOnly ? c.accentInk : c.ink, fontWeight: '600', fontSize: 13 }}>
            {attentionOnly ? '✓ ' : ''}Needs attention only
          </Text>
        </Pressable>
      </View>

      {error ? (
        <View style={{ position: 'absolute', top: 10, left: 10, right: 60 }}>
          <Message tone="error">{error}</Message>
        </View>
      ) : null}

      {/* Bottom: selected site card, or the "not on the map yet" button */}
      <View pointerEvents="box-none" style={{ position: 'absolute', left: 10, right: 10, bottom: 12 }}>
        {selected ? (
          <View style={[overlay, { padding: 14 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <PriorityDot priority={selected.priority} />
              <Text style={{ color: c.ink, fontWeight: '700', fontSize: 17, flex: 1 }} numberOfLines={1}>
                {selected.name}
              </Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => setSelectedId(null)} hitSlop={12}>
                <Text style={{ color: c.muted, fontSize: 18 }}>✕</Text>
              </Pressable>
            </View>
            <Text style={{ color: c.muted, marginTop: 2 }}>
              {PIN_LABELS[pinStatus(selected, overdueDays)]} · {visitedText(selected.last_visit)}
              {selected.openJobs ? ` · ${selected.openJobs} open job${selected.openJobs > 1 ? 's' : ''}` : ''}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              <Button style={{ flex: 1 }} size="small" title="Open site" onPress={() => router.push({ pathname: '/site/[id]', params: { id: selected.id } })} />
              <Button style={{ flex: 1 }} size="small" variant="ghost" title="Log visit" onPress={() => router.push({ pathname: '/log-visit', params: { siteId: selected.id } })} />
              <Button style={{ flex: 1 }} size="small" variant="ghost" title="Directions" onPress={() => Linking.openURL(directionsUrl(selected))} />
            </View>
          </View>
        ) : missing.length > 0 ? (
          <Pressable accessibilityRole="button" onPress={() => setShowMissing(true)} style={[overlay, { padding: 12, alignSelf: 'flex-start' }]}>
            <Text style={{ color: c.ink, fontWeight: '600' }}>
              📍 {missing.length} forest{missing.length > 1 ? 's' : ''} not on the map yet
            </Text>
            <Text style={{ color: c.accent, fontSize: 13, marginTop: 2 }}>Tap to add their locations</Text>
          </Pressable>
        ) : null}
      </View>

      <Modal visible={showMissing} animationType="slide" onRequestClose={() => setShowMissing(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 8 }}>
            <Text style={{ color: c.ink, fontWeight: '700', fontSize: 18, flex: 1 }}>Not on the map yet ({missing.length})</Text>
            <Button size="small" variant="ghost" title="Close" onPress={() => setShowMissing(false)} />
          </View>
          <Text style={{ color: c.muted, paddingHorizontal: 16, marginBottom: 8 }}>
            Tap a forest to set its location: search the address, use your phone’s GPS when you’re there, or drop a pin.
          </Text>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
            {missing
              .slice()
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((s) => (
                <Pressable
                  key={s.id}
                  accessibilityRole="button"
                  onPress={() => {
                    setShowMissing(false);
                    router.push({ pathname: '/site/[id]/location', params: { id: s.id } });
                  }}
                  style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: c.line, opacity: pressed ? 0.7 : 1 })}>
                  <PriorityDot priority={s.priority} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: c.ink, fontSize: 16 }}>{s.name}</Text>
                    {s.address ? <Text style={{ color: c.muted, fontSize: 13 }}>{s.address}</Text> : null}
                  </View>
                  <Text style={{ color: c.accent, fontWeight: '600' }}>Set ›</Text>
                </Pressable>
              ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}
