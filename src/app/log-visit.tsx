import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PriorityDot } from '@/components/sites';
import { Button, Field, Message, Screen } from '@/components/ui';
import { Brand, priorityColor, useColors, type Priority } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { useData } from '@/lib/data';
import { addDaysISO, formatDate, isValidISODate, todayISO } from '@/lib/logic';
import { compressPhoto, uploadVisitPhoto } from '@/lib/photos';
import { supabase } from '@/lib/supabase';

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'urgent', label: 'Urgent' },
];
const MAX_PHOTOS = 10;

export default function LogVisit() {
  const c = useColors();
  const { siteId: initialSite } = useLocalSearchParams<{ siteId?: string }>();
  const { session } = useAuth();
  const { sites, reload } = useData();
  const byName = useMemo(() => [...sites].sort((a, b) => a.name.localeCompare(b.name)), [sites]);

  const [siteId, setSiteId] = useState<string | undefined>(initialSite);
  const site = sites.find((s) => s.id === siteId);
  const [date, setDate] = useState(todayISO());
  const [priority, setPriority] = useState<Priority | null>(null); // null = use the site's current priority
  const [work, setWork] = useState('');
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [preparing, setPreparing] = useState(false);
  const [picking, setPicking] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [savedWithProblems, setSavedWithProblems] = useState(false);

  const effectivePriority: Priority = priority ?? ((site?.priority as Priority | null) || 'low');
  const today = todayISO();
  const yesterday = addDaysISO(today, -1);

  async function addPhotos(source: 'camera' | 'library') {
    setError('');
    if (source === 'camera' && Platform.OS !== 'web') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return setError('Camera permission is off. You can turn it on in your phone’s settings, or choose photos instead.');
    }
    const opts: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      quality: 1,
      allowsMultipleSelection: source === 'library',
      selectionLimit: MAX_PHOTOS - photos.length,
    };
    const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (res.canceled) return;
    setPreparing(true);
    try {
      const out: string[] = [];
      for (const a of res.assets.slice(0, MAX_PHOTOS - photos.length)) out.push(await compressPhoto(a.uri, a.width, a.height));
      setPhotos((p) => [...p, ...out]);
    } catch {
      setError('Couldn’t read that photo. Please try another.');
    } finally {
      setPreparing(false);
    }
  }

  async function save() {
    setError('');
    if (!siteId) return setError('Please choose the site.');
    if (!isValidISODate(date)) return setError('Please enter the date as YYYY-MM-DD, e.g. ' + today + '.');
    if (date > today) return setError('The date can’t be in the future.');
    if (!work.trim()) return setError('Please add what was done.');

    setStatus('Saving visit…');
    const { data: visit, error: err } = await supabase
      .from('visits')
      .insert({ site_id: siteId, date, priority_at_visit: effectivePriority, work_carried_out: work.trim(), notes: notes.trim(), logged_by: session?.user.id })
      .select('id')
      .single();
    if (err || !visit) {
      setStatus('');
      return setError('Couldn’t save the visit. Check your signal and try again. Nothing was lost: your notes are still here.');
    }

    let failed = 0;
    for (let i = 0; i < photos.length; i++) {
      setStatus(`Uploading photo ${i + 1} of ${photos.length}…`);
      try {
        await uploadVisitPhoto(visit.id, photos[i]);
      } catch {
        failed++;
      }
    }
    setStatus('');
    await reload(true);
    if (failed) {
      setSavedWithProblems(true);
      setError(`The visit was saved, but ${failed} photo${failed > 1 ? 's' : ''} didn’t upload. You can add them by logging another visit later.`);
      return;
    }
    router.back();
  }

  const saving = !!status;

  return (
    <Screen>
      <Text style={{ color: c.muted, fontSize: 13, marginBottom: 4 }}>Site</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={site ? `Site: ${site.name}. Change` : 'Choose site'}
        onPress={() => setPicking(true)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: c.line, backgroundColor: c.card, borderRadius: 10, padding: 12, marginBottom: 12, minHeight: 48 }}>
        {site ? <PriorityDot priority={site.priority} /> : null}
        <Text style={{ color: site ? c.ink : c.muted, fontSize: 16, flex: 1 }}>{site ? site.name : 'Choose a site…'}</Text>
        <Text style={{ color: c.muted }}>▾</Text>
      </Pressable>

      <Text style={{ color: c.muted, fontSize: 13, marginBottom: 4 }}>Date</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12, alignItems: 'center' }}>
        <Button size="small" variant={date === today ? 'primary' : 'ghost'} title="Today" onPress={() => setDate(today)} />
        <Button size="small" variant={date === yesterday ? 'primary' : 'ghost'} title="Yesterday" onPress={() => setDate(yesterday)} />
        <TextInput
          value={date}
          onChangeText={setDate}
          accessibilityLabel="Visit date, YYYY-MM-DD"
          placeholder="YYYY-MM-DD"
          placeholderTextColor={c.muted}
          maxLength={10}
          keyboardType="numbers-and-punctuation"
          style={{ flex: 1, borderWidth: 1, borderColor: c.line, backgroundColor: c.card, color: c.ink, borderRadius: 10, padding: 10, fontSize: 16, minWidth: 110 }}
        />
      </View>
      {isValidISODate(date) && date !== today && date !== yesterday ? <Text style={{ color: c.muted, marginTop: -6, marginBottom: 12 }}>{formatDate(date)}</Text> : null}

      <Text style={{ color: c.muted, fontSize: 13, marginBottom: 4 }}>Priority now</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }} accessibilityRole="radiogroup">
        {PRIORITIES.map((p) => {
          const on = effectivePriority === p.value;
          return (
            <Pressable
              key={p.value}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              onPress={() => setPriority(p.value)}
              style={{
                flex: 1,
                minHeight: 44,
                borderRadius: 10,
                borderWidth: 2,
                borderColor: on ? priorityColor(p.value) : c.line,
                backgroundColor: on ? priorityColor(p.value) : c.card,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Text style={{ color: on ? '#fff' : c.ink, fontWeight: '600' }}>{p.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Field label="Work carried out" value={work} onChangeText={setWork} multiline placeholder="Weeded path, fixed fence…" style={{ minHeight: 100, textAlignVertical: 'top' }} />
      <Field label="Notes / what’s needed next" value={notes} onChangeText={setNotes} multiline style={{ minHeight: 80, textAlignVertical: 'top' }} />

      <Text style={{ color: c.muted, fontSize: 13, marginBottom: 4 }}>Photos {photos.length ? `(${photos.length})` : ''}</Text>
      {photos.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
          {photos.map((uri, i) => (
            <View key={uri}>
              <Image source={uri} style={{ width: 72, height: 72, borderRadius: 8 }} contentFit="cover" />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove photo ${i + 1}`}
                hitSlop={8}
                onPress={() => setPhotos((p) => p.filter((x) => x !== uri))}
                style={{ position: 'absolute', top: -6, right: -6, width: 24, height: 24, borderRadius: 12, backgroundColor: Brand.header, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>✕</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}
      {preparing ? (
        <ActivityIndicator color={c.accent} style={{ marginVertical: 12 }} />
      ) : photos.length < MAX_PHOTOS ? (
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
          <Button style={{ flex: 1 }} variant="ghost" title="📷 Take photo" onPress={() => addPhotos('camera')} disabled={saving} />
          <Button style={{ flex: 1 }} variant="ghost" title="🖼 Choose photos" onPress={() => addPhotos('library')} disabled={saving} />
        </View>
      ) : (
        <Message>That’s the maximum of {MAX_PHOTOS} photos for one visit.</Message>
      )}

      {error ? <Message tone="error">{error}</Message> : null}
      {status ? <Message>{status}</Message> : null}
      {savedWithProblems ? <Button title="Close" onPress={() => router.back()} /> : <Button title="Save visit" onPress={save} busy={saving} disabled={preparing} />}

      <Modal visible={picking} animationType="slide" onRequestClose={() => setPicking(false)}>
        <SitePicker
          sites={byName}
          onPick={(id) => {
            setSiteId(id);
            setPriority(null);
            setPicking(false);
          }}
          onClose={() => setPicking(false)}
        />
      </Modal>
    </Screen>
  );
}

function SitePicker({ sites, onPick, onClose }: { sites: { id: string; name: string; priority: string | null }[]; onPick: (id: string) => void; onClose: () => void }) {
  const c = useColors();
  const [q, setQ] = useState('');
  const list = sites.filter((s) => s.name.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 8 }}>
        <TextInput
          value={q}
          onChangeText={setQ}
          autoFocus
          placeholder="Search sites"
          placeholderTextColor={c.muted}
          accessibilityLabel="Search sites"
          style={{ flex: 1, borderWidth: 1, borderColor: c.line, backgroundColor: c.card, color: c.ink, borderRadius: 10, padding: 12, fontSize: 16 }}
        />
        <Button size="small" variant="ghost" title="Cancel" onPress={onClose} />
      </View>
      <FlatList
        data={list}
        keyExtractor={(s) => s.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            onPress={() => onPick(item.id)}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: c.line, opacity: pressed ? 0.7 : 1 })}>
            <PriorityDot priority={item.priority} />
            <Text style={{ color: c.ink, fontSize: 16 }}>{item.name}</Text>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}
