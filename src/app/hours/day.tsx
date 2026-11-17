import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, TextInput, View } from 'react-native';

import { Button, Field, Message, Screen, confirmAction } from '@/components/ui';
import { useColors } from '@/constants/theme';
import { dayLabel } from '@/lib/invoice';
import { addDaysISO, isValidISODate, todayISO } from '@/lib/logic';
import { supabase } from '@/lib/supabase';

const QUICK_HOURS = [4, 6, 7, 7.5, 8];

export default function DayForm() {
  const c = useColors();
  const params = useLocalSearchParams<{ id?: string; date?: string }>();
  const [loading, setLoading] = useState(!!params.id);
  const [date, setDate] = useState(params.date && isValidISODate(params.date) ? params.date : todayISO());
  const [hours, setHours] = useState('');
  const [miles, setMiles] = useState('');
  const [description, setDescription] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!params.id) return;
    supabase
      .from('work_days')
      .select('*')
      .eq('id', params.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setDate(data.date);
          setHours(String(Number(data.hours)));
          setMiles(Number(data.miles) ? String(Number(data.miles)) : '');
          setDescription(data.description);
        }
        setLoading(false);
      });
  }, [params.id]);

  // Forests anyone logged a visit to on this day, as one-tap notes.
  useEffect(() => {
    let live = true;
    const q = isValidISODate(date) ? supabase.from('visits').select('sites(name)').eq('date', date) : Promise.resolve({ data: [] as { sites: unknown }[] });
    q.then(({ data }) => {
      if (!live) return;
      const names = (data ?? []).map((v) => (v.sites as { name: string } | null)?.name).filter((n): n is string => !!n);
      setSuggestions([...new Set(names)].sort());
    });
    return () => {
      live = false;
    };
  }, [date]);

  function addSuggestion(name: string) {
    setDescription((d) => (d.toLowerCase().includes(name.toLowerCase()) ? d : d.trim() ? `${d.trim()}, ${name}` : name));
  }

  async function save() {
    setError('');
    const h = Number(hours.replace(',', '.'));
    const m = miles.trim() ? Number(miles.replace(',', '.')) : 0;
    if (!isValidISODate(date)) return setError('Please enter the date as YYYY-MM-DD.');
    if (date > todayISO()) return setError('The date can’t be in the future.');
    if (!(h > 0 && h <= 24)) return setError('Hours must be more than 0 and no more than 24 (use .5 for half an hour).');
    if (!(m >= 0)) return setError('Miles must be a number (or leave it empty).');
    setBusy(true);
    const row = { date, hours: Math.round(h * 100) / 100, miles: Math.round(m * 10) / 10, description: description.trim() };
    const res = params.id ? await supabase.from('work_days').update(row).eq('id', params.id) : await supabase.from('work_days').insert(row);
    setBusy(false);
    if (res.error) {
      if (res.error.code === '23505') return setError(`You already have hours for ${dayLabel(date)}. Go back and tap that day to change it.`);
      if (res.error.message.includes('invoiced')) return setError('That month has already been invoiced, so it can’t be changed.');
      return setError('Couldn’t save, please try again.');
    }
    router.back();
  }

  async function remove() {
    if (!params.id || !(await confirmAction(`Delete ${dayLabel(date)}?`, 'The hours and miles for this day will be removed.'))) return;
    setBusy(true);
    const { error: err } = await supabase.from('work_days').delete().eq('id', params.id);
    setBusy(false);
    if (err) return setError('Couldn’t delete, please try again.');
    router.back();
  }

  if (loading) {
    return (
      <Screen center>
        <ActivityIndicator color={c.accent} />
      </Screen>
    );
  }

  const today = todayISO();
  const yesterday = addDaysISO(today, -1);
  return (
    <Screen>
      <Stack.Screen options={{ title: params.id ? 'Edit day' : 'Add a day' }} />
      <Text style={{ color: c.muted, fontSize: 13, marginBottom: 4 }}>Date</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12, alignItems: 'center' }}>
        <Button size="small" variant={date === today ? 'primary' : 'ghost'} title="Today" onPress={() => setDate(today)} />
        <Button size="small" variant={date === yesterday ? 'primary' : 'ghost'} title="Yesterday" onPress={() => setDate(yesterday)} />
        <TextInput
          value={date}
          onChangeText={setDate}
          accessibilityLabel="Date, YYYY-MM-DD"
          maxLength={10}
          keyboardType="numbers-and-punctuation"
          style={{ flex: 1, borderWidth: 1, borderColor: c.line, backgroundColor: c.card, color: c.ink, borderRadius: 10, padding: 10, fontSize: 16, minWidth: 110 }}
        />
      </View>
      {isValidISODate(date) ? <Text style={{ color: c.muted, marginTop: -6, marginBottom: 12 }}>{dayLabel(date)}</Text> : null}

      <Text style={{ color: c.muted, fontSize: 13, marginBottom: 4 }}>Hours worked</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
        {QUICK_HOURS.map((h) => (
          <Button key={h} size="small" variant={Number(hours) === h ? 'primary' : 'ghost'} title={String(h)} onPress={() => setHours(String(h))} />
        ))}
      </View>
      <Field label="Or type the hours" value={hours} onChangeText={setHours} keyboardType="decimal-pad" inputMode="decimal" placeholder="e.g. 6.5" />
      <Field label="Miles driven for work (paid per mile)" value={miles} onChangeText={setMiles} keyboardType="decimal-pad" inputMode="decimal" placeholder="0" />

      <Field label="What you did" value={description} onChangeText={setDescription} multiline placeholder="e.g. Weeding at Leigham and Plaistow" style={{ minHeight: 70, textAlignVertical: 'top' }} />
      {suggestions.length > 0 ? (
        <View style={{ marginTop: -4, marginBottom: 12 }}>
          <Text style={{ color: c.muted, fontSize: 13, marginBottom: 6 }}>Visits logged that day (tap to add):</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {suggestions.map((s) => (
              <Button key={s} size="small" variant="ghost" title={`+ ${s}`} onPress={() => addSuggestion(s)} />
            ))}
          </View>
        </View>
      ) : null}

      {error ? <Message tone="error">{error}</Message> : null}
      <Button title="Save" onPress={save} busy={busy} />
      {params.id ? (
        <View style={{ marginTop: 24 }}>
          <Button variant="danger" title="Delete this day" onPress={remove} disabled={busy} />
        </View>
      ) : null}
    </Screen>
  );
}
