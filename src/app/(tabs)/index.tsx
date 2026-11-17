import { router } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';

import { InstallBanner } from '@/components/install-banner';
import { EmptyState, LogVisitFab, SiteCard, StatTile } from '@/components/sites';
import { Button, Card, Message, Screen, SectionTitle } from '@/components/ui';
import { useColors } from '@/constants/theme';
import { useData, useRefreshOnFocus } from '@/lib/data';
import { isLowStock } from '@/lib/logic';

const SHOW = 8;

export default function Today() {
  const c = useColors();
  const { loading, error, sites, stock, reload } = useData();
  useRefreshOnFocus();

  if (loading) {
    return (
      <Screen center>
        <ActivityIndicator color={c.accent} />
      </Screen>
    );
  }

  if (error && sites.length === 0) {
    return (
      <View style={{ flex: 1 }}>
        <Screen onRefresh={() => reload(true)} fabSpace>
          <Message tone="error">{error}</Message>
        </Screen>
        <LogVisitFab />
      </View>
    );
  }

  const attention = sites.filter((s) => s.needsAttention);
  const low = stock.filter(isLowStock);
  const urgent = sites.filter((s) => s.priority === 'urgent').length;
  const overdue = sites.filter((s) => s.overdue).length;
  const openJobs = sites.reduce((n, s) => n + s.openJobs, 0);

  return (
    <View style={{ flex: 1 }}>
      <Screen onRefresh={() => reload(true)} fabSpace>
        {error ? <Message tone="error">{error}</Message> : null}
        <InstallBanner />
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
          <StatTile value={urgent} label="Urgent" />
          <StatTile value={overdue} label="Overdue" />
          <StatTile value={openJobs} label="Open jobs" />
          <StatTile value={low.length} label="Low stock" onPress={() => router.navigate('/stock')} />
        </View>

        <SectionTitle>Needs attention</SectionTitle>
        {attention.length === 0 ? (
          <EmptyState>All sites are up to date 🎉</EmptyState>
        ) : (
          attention.slice(0, SHOW).map((s) => <SiteCard key={s.id} site={s} />)
        )}
        {attention.length > SHOW && <Button variant="ghost" title={`See all ${attention.length}`} onPress={() => router.navigate('/sites')} />}

        {low.length > 0 && (
          <>
            <SectionTitle>Running low</SectionTitle>
            <Card>
              {low.slice(0, 6).map((i, n) => (
                <View
                  key={i.id}
                  style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderTopWidth: n ? 1 : 0, borderTopColor: c.line }}>
                  <Text style={{ color: c.ink, flex: 1 }}>{i.name}</Text>
                  <Text style={{ color: c.muted }}>
                    {i.quantity} / {i.low_at} {i.unit}
                  </Text>
                </View>
              ))}
            </Card>
          </>
        )}
      </Screen>
      <LogVisitFab />
    </View>
  );
}
