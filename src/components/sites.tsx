import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Brand, priorityColor, useColors, type Priority } from '@/constants/theme';
import type { RankedSite } from '@/lib/data';
import { visitedText } from '@/lib/logic';

export function PriorityDot({ priority, size = 12 }: { priority: string | null | undefined; size?: number }) {
  return (
    <View
      accessibilityLabel={`Priority ${priority ?? 'not set'}`}
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: priorityColor(priority as Priority) }}
    />
  );
}

export function Chip({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'urgent' | 'medium' }) {
  const c = useColors();
  const bg = tone === 'urgent' ? Brand.urgent : tone === 'medium' ? Brand.medium : c.line;
  const fg = tone === 'neutral' ? c.ink : '#fff';
  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      <Text style={{ color: fg, fontSize: 12, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

export function SiteCard({ site }: { site: RankedSite }) {
  const c = useColors();
  const jobs = site.openJobs ? ` · ${site.openJobs} open job${site.openJobs > 1 ? 's' : ''}` : '';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${site.name}. ${visitedText(site.last_visit)}${jobs}`}
      onPress={() => router.push({ pathname: '/site/[id]', params: { id: site.id } })}
      style={({ pressed }) => [styles.card, { backgroundColor: c.card, borderColor: c.line, opacity: pressed ? 0.85 : 1 }]}>
      <PriorityDot priority={site.priority} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: c.ink, fontWeight: '700', fontSize: 16 }} numberOfLines={1}>
          {site.name}
        </Text>
        <Text style={{ color: c.muted, fontSize: 14 }}>
          {visitedText(site.last_visit)}
          {jobs}
        </Text>
      </View>
      {site.priority === 'urgent' ? <Chip label="Urgent" tone="urgent" /> : site.overdue ? <Chip label="Overdue" /> : null}
    </Pressable>
  );
}

export function StatTile({ value, label, onPress }: { value: number; label: string; onPress?: () => void }) {
  const c = useColors();
  return (
    <Pressable
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={`${value} ${label}`}
      onPress={onPress}
      style={[styles.stat, { backgroundColor: c.card, borderColor: c.line }]}>
      <Text style={{ color: c.ink, fontSize: 24, fontWeight: '700' }}>{value}</Text>
      <Text style={{ color: c.muted, fontSize: 11 }} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Floating "+ Log visit" button. */
export function LogVisitFab({ siteId }: { siteId?: string }) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Log a visit"
      onPress={() => router.push({ pathname: '/log-visit', params: siteId ? { siteId } : {} })}
      style={({ pressed }) => [styles.fab, { backgroundColor: c.accent, opacity: pressed ? 0.85 : 1 }]}>
      <Text style={{ color: c.accentInk, fontWeight: '700', fontSize: 16 }}>+ Log visit</Text>
    </Pressable>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  const c = useColors();
  return <Text style={{ color: c.muted, textAlign: 'center', paddingVertical: 40, paddingHorizontal: 10 }}>{children}</Text>;
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 10, minHeight: 60 },
  chip: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 99 },
  stat: { flex: 1, borderWidth: 1, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 4, alignItems: 'center' },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    borderRadius: 99,
    paddingVertical: 14,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
