import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { EmptyState } from '@/components/sites';
import { Button, Message, Screen } from '@/components/ui';
import { Brand, useColors } from '@/constants/theme';
import { useData, useRefreshOnFocus, type StockItem } from '@/lib/data';
import { isLowStock } from '@/lib/logic';
import { supabase } from '@/lib/supabase';

export default function Stock() {
  const c = useColors();
  const { loading, error: loadError, stock, reload, patchStock } = useData();
  const [lowOnly, setLowOnly] = useState(false);
  const [error, setError] = useState('');
  // One request at a time per item, so quick taps are saved in order.
  const queues = useRef<Record<string, Promise<void>>>({});
  useRefreshOnFocus();

  function change(item: StockItem, delta: number) {
    const next = Math.max(0, item.quantity + delta);
    if (next === item.quantity) return;
    patchStock(item.id, { quantity: next });
    setError('');
    const prev = queues.current[item.id] ?? Promise.resolve();
    queues.current[item.id] = prev.then(async () => {
      const { error: err } = await supabase.from('stock_items').update({ quantity: next }).eq('id', item.id);
      if (err) {
        setError(`Couldn’t update ${item.name}. Check your signal and try again.`);
        await reload(true);
      }
    });
  }

  const lowCount = stock.filter(isLowStock).length;
  const list = stock
    .filter((i) => !lowOnly || isLowStock(i))
    .sort((a, b) => Number(isLowStock(b)) - Number(isLowStock(a)) || a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));

  return (
    <Screen onRefresh={() => reload(true)}>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        <Button style={{ flex: 1 }} size="small" variant={lowOnly ? 'ghost' : 'primary'} title={`All (${stock.length})`} onPress={() => setLowOnly(false)} />
        <Button style={{ flex: 1 }} size="small" variant={lowOnly ? 'primary' : 'ghost'} title={`Low (${lowCount})`} onPress={() => setLowOnly(true)} />
        <Button style={{ flex: 1 }} size="small" variant="ghost" title="+ Item" onPress={() => router.push('/stock/new')} />
      </View>
      {loadError || error ? <Message tone="error">{error || loadError}</Message> : null}
      {loading ? (
        <ActivityIndicator color={c.accent} style={{ marginTop: 40 }} />
      ) : list.length === 0 ? (
        <EmptyState>{lowOnly ? 'Nothing is running low 🎉' : 'No stock items yet'}</EmptyState>
      ) : (
        list.map((i) => {
          const low = isLowStock(i);
          const details = [i.kept_at, i.low_at ? `low at ${i.low_at}` : '', i.unit].filter(Boolean).join(' · ');
          return (
            <View
              key={i.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                borderWidth: 1,
                borderColor: low ? Brand.urgent : c.line,
                backgroundColor: c.card,
                borderRadius: 14,
                paddingVertical: 10,
                paddingLeft: 14,
                paddingRight: 10,
                marginBottom: 10,
              }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Edit ${i.name}`}
                onPress={() => router.push({ pathname: '/stock/[id]', params: { id: i.id } })}
                style={{ flex: 1, minWidth: 0, paddingVertical: 4 }}>
                <Text style={{ color: c.ink, fontWeight: '700', fontSize: 16 }}>
                  {i.name}
                  {low ? <Text style={{ color: Brand.urgent, fontWeight: '600', fontSize: 13 }}>  Low</Text> : null}
                </Text>
                {details ? <Text style={{ color: c.muted, fontSize: 14 }}>{details}</Text> : null}
              </Pressable>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <QtyButton label="−" a11y={`One fewer ${i.name}`} disabled={i.quantity === 0} onPress={() => change(i, -1)} />
                <Text accessibilityLabel={`${i.quantity} ${i.unit}`} style={{ color: low ? Brand.urgent : c.ink, fontWeight: '700', fontSize: 18, minWidth: 34, textAlign: 'center' }}>
                  {i.quantity}
                </Text>
                <QtyButton label="+" a11y={`One more ${i.name}`} onPress={() => change(i, 1)} />
              </View>
            </View>
          );
        })
      )}
    </Screen>
  );
}

function QtyButton({ label, a11y, onPress, disabled }: { label: string; a11y: string; onPress: () => void; disabled?: boolean }) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      disabled={disabled}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: c.line,
        backgroundColor: pressed ? c.line : c.bg,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.4 : 1,
      })}>
      <Text style={{ color: c.ink, fontSize: 22, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}
