import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Text, TextInput, View } from 'react-native';

import { Button, Field, Message, Screen, confirmAction } from '@/components/ui';
import { useColors } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { dayLabel } from '@/lib/invoice';
import { isValidISODate, todayISO } from '@/lib/logic';
import { compressPhoto } from '@/lib/photos';
import { supabase } from '@/lib/supabase';

const BUCKET = 'receipts';

export default function MaterialForm() {
  const c = useColors();
  const { session } = useAuth();
  const params = useLocalSearchParams<{ id?: string; date?: string }>();
  const [loading, setLoading] = useState(!!params.id);
  const [date, setDate] = useState(params.date && isValidISODate(params.date) ? params.date : todayISO());
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [receiptPath, setReceiptPath] = useState<string | null>(null); // saved receipt
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [newReceipt, setNewReceipt] = useState<string | null>(null); // local, not yet uploaded
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!params.id) return;
    supabase
      .from('expenses')
      .select('*')
      .eq('id', params.id)
      .single()
      .then(async ({ data }) => {
        if (data) {
          setDate(data.date);
          setDescription(data.description);
          setAmount(Number(data.amount).toFixed(2));
          setReceiptPath(data.receipt_path);
          if (data.receipt_path) {
            const s = await supabase.storage.from(BUCKET).createSignedUrl(data.receipt_path, 3600);
            setReceiptUrl(s.data?.signedUrl ?? null);
          }
        }
        setLoading(false);
      });
  }, [params.id]);

  async function pickReceipt(source: 'camera' | 'library') {
    setError('');
    if (source === 'camera' && Platform.OS !== 'web') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return setError('Camera permission is off. Choose a photo instead, or turn it on in your phone’s settings.');
    }
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
    const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (res.canceled) return;
    try {
      const a = res.assets[0];
      setNewReceipt(await compressPhoto(a.uri, a.width, a.height));
    } catch {
      setError('Couldn’t read that photo. Please try another.');
    }
  }

  async function save() {
    setError('');
    const amt = Number(amount.replace('£', '').replace(',', '.'));
    if (!isValidISODate(date)) return setError('Please enter the date as YYYY-MM-DD.');
    if (date > todayISO()) return setError('The date can’t be in the future.');
    if (!description.trim()) return setError('Please say what you bought.');
    if (!(amt > 0)) return setError('Please enter the cost, e.g. 23.40');
    setBusy(true);
    let path = receiptPath;
    if (newReceipt && session) {
      const body = await (await fetch(newReceipt)).arrayBuffer();
      const p = `${session.user.id}/${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}.jpg`;
      const up = await supabase.storage.from(BUCKET).upload(p, body, { contentType: 'image/jpeg' });
      if (up.error) {
        setBusy(false);
        return setError('Couldn’t upload the receipt photo. Check your signal and try again.');
      }
      path = p;
    }
    const row = { date, description: description.trim(), amount: Math.round(amt * 100) / 100, receipt_path: path };
    const res = params.id ? await supabase.from('expenses').update(row).eq('id', params.id) : await supabase.from('expenses').insert(row);
    setBusy(false);
    if (res.error) return setError(res.error.message.includes('invoiced') ? 'That month has already been invoiced, so it can’t be changed.' : 'Couldn’t save, please try again.');
    if (newReceipt && receiptPath && receiptPath !== path) supabase.storage.from(BUCKET).remove([receiptPath]);
    router.back();
  }

  async function remove() {
    if (!params.id || !(await confirmAction(`Delete “${description}”?`, 'It will be removed from this month’s invoice.'))) return;
    setBusy(true);
    const { error: err } = await supabase.from('expenses').delete().eq('id', params.id);
    setBusy(false);
    if (err) return setError('Couldn’t delete, please try again.');
    if (receiptPath) supabase.storage.from(BUCKET).remove([receiptPath]);
    router.back();
  }

  if (loading) {
    return (
      <Screen center>
        <ActivityIndicator color={c.accent} />
      </Screen>
    );
  }

  const shown = newReceipt ?? receiptUrl;
  return (
    <Screen>
      <Stack.Screen options={{ title: params.id ? 'Edit materials' : 'Add materials' }} />
      <Field label="What you bought" value={description} onChangeText={setDescription} placeholder="e.g. Tree ties, 2 rolls" />
      <Field label="Cost (£)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" inputMode="decimal" placeholder="23.40" />
      <Text style={{ color: c.muted, fontSize: 13, marginBottom: 4 }}>Date bought</Text>
      <TextInput
        value={date}
        onChangeText={setDate}
        accessibilityLabel="Date bought, YYYY-MM-DD"
        maxLength={10}
        keyboardType="numbers-and-punctuation"
        style={{ borderWidth: 1, borderColor: c.line, backgroundColor: c.card, color: c.ink, borderRadius: 10, padding: 12, fontSize: 16 }}
      />
      {isValidISODate(date) ? <Text style={{ color: c.muted, marginTop: 4, marginBottom: 12 }}>{dayLabel(date)}</Text> : null}

      <Text style={{ color: c.muted, fontSize: 13, marginBottom: 4 }}>Receipt photo (optional)</Text>
      {shown ? <Image source={shown} style={{ width: 140, height: 180, borderRadius: 10, marginBottom: 8, backgroundColor: c.line }} contentFit="cover" /> : null}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
        <Button style={{ flex: 1 }} variant="ghost" title={shown ? '📷 Retake' : '📷 Take photo'} onPress={() => pickReceipt('camera')} />
        <Button style={{ flex: 1 }} variant="ghost" title="🖼 Choose photo" onPress={() => pickReceipt('library')} />
      </View>

      {error ? <Message tone="error">{error}</Message> : null}
      <Button title="Save" onPress={save} busy={busy} />
      {params.id ? (
        <View style={{ marginTop: 24 }}>
          <Button variant="danger" title="Delete" onPress={remove} disabled={busy} />
        </View>
      ) : null}
    </Screen>
  );
}
