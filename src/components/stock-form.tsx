import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, Field, Message, Screen, confirmAction } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useData, type StockItem } from '@/lib/data';
import { supabase } from '@/lib/supabase';

/** Add a stock item, or edit one (admins can also delete). */
export function StockForm({ item }: { item?: StockItem }) {
  const { isAdmin } = useAuth();
  const { reload } = useData();
  const [name, setName] = useState(item?.name ?? '');
  const [quantity, setQuantity] = useState(String(item?.quantity ?? 1));
  const [lowAt, setLowAt] = useState(String(item?.low_at ?? 0));
  const [unit, setUnit] = useState(item?.unit ?? '');
  const [keptAt, setKeptAt] = useState(item?.kept_at ?? '');
  const [notes, setNotes] = useState(item?.notes ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const whole = (s: string) => (/^\d+$/.test(s.trim()) ? Number(s.trim()) : NaN);

  async function save() {
    setError('');
    const q = whole(quantity);
    const l = whole(lowAt || '0');
    if (!name.trim()) return setError('Please give the item a name.');
    if (Number.isNaN(q)) return setError('Quantity must be a whole number (0 or more).');
    if (Number.isNaN(l)) return setError('“Low at” must be a whole number. Use 0 for no warning.');
    const row = { name: name.trim(), quantity: q, low_at: l, unit: unit.trim(), kept_at: keptAt.trim(), notes: notes.trim() };
    setBusy(true);
    const { error: err } = item ? await supabase.from('stock_items').update(row).eq('id', item.id) : await supabase.from('stock_items').insert(row);
    setBusy(false);
    if (err) return setError('Couldn’t save, please try again.');
    await reload(true);
    router.back();
  }

  async function remove() {
    if (!item) return;
    if (!(await confirmAction(`Delete ${item.name}?`, 'It will disappear from the stock list for everyone.'))) return;
    setBusy(true);
    const { error: err } = await supabase.from('stock_items').delete().eq('id', item.id);
    setBusy(false);
    if (err) return setError('Couldn’t delete, please try again.');
    await reload(true);
    router.back();
  }

  return (
    <Screen>
      <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. Tree ties" />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Field label="Quantity" value={quantity} onChangeText={setQuantity} keyboardType="number-pad" inputMode="numeric" />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Low at (0 = no warning)" value={lowAt} onChangeText={setLowAt} keyboardType="number-pad" inputMode="numeric" />
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Field label="Unit" value={unit} onChangeText={setUnit} placeholder="rolls, each, bags…" />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Kept at" value={keptAt} onChangeText={setKeptAt} placeholder="Polytunnel" />
        </View>
      </View>
      <Field label="Notes" value={notes} onChangeText={setNotes} multiline style={{ minHeight: 70, textAlignVertical: 'top' }} />
      {error ? <Message tone="error">{error}</Message> : null}
      <Button title={item ? 'Save changes' : 'Add item'} onPress={save} busy={busy} />
      {item && isAdmin ? (
        <View style={{ marginTop: 32 }}>
          <Button variant="danger" title="Delete item" onPress={remove} disabled={busy} />
        </View>
      ) : null}
    </Screen>
  );
}
