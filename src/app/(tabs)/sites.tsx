import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, TextInput, View } from 'react-native';

import { EmptyState, LogVisitFab, SiteCard } from '@/components/sites';
import { Button, Message, Screen } from '@/components/ui';
import { useColors } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { useData, useRefreshOnFocus } from '@/lib/data';

export default function Sites() {
  const c = useColors();
  const { isAdmin } = useAuth();
  const { loading, error, sites, reload } = useData();
  const [q, setQ] = useState('');
  useRefreshOnFocus();

  const term = q.trim().toLowerCase();
  const list = term ? sites.filter((s) => s.name.toLowerCase().includes(term) || s.address.toLowerCase().includes(term)) : sites;

  return (
    <View style={{ flex: 1 }}>
      <Screen onRefresh={() => reload(true)} fabSpace>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search sites"
            placeholderTextColor={c.muted}
            accessibilityLabel="Search sites"
            autoCorrect={false}
            clearButtonMode="while-editing"
            style={{ flex: 1, borderWidth: 1, borderColor: c.line, backgroundColor: c.card, color: c.ink, borderRadius: 10, padding: 12, fontSize: 16 }}
          />
          {isAdmin && <Button title="+ Site" onPress={() => router.push('/site/new')} />}
        </View>
        {error ? <Message tone="error">{error}</Message> : null}
        {loading ? (
          <ActivityIndicator color={c.accent} style={{ marginTop: 40 }} />
        ) : list.length ? (
          list.map((s) => <SiteCard key={s.id} site={s} />)
        ) : (
          <EmptyState>{term ? 'No sites found' : 'No sites yet'}</EmptyState>
        )}
      </Screen>
      <LogVisitFab />
    </View>
  );
}
