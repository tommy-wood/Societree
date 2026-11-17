import { Image } from 'expo-image';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, Modal, Pressable, Text, TextInput, View } from 'react-native';

import { EmptyState, LogVisitFab, PriorityDot } from '@/components/sites';
import { Button, Card, Message, Screen, SectionTitle } from '@/components/ui';
import { useColors } from '@/constants/theme';
import { useData, type Site } from '@/lib/data';
import { directionsUrl, formatDate, visitedText } from '@/lib/logic';
import { signedPhotoUrls } from '@/lib/photos';
import { supabase, type Tables } from '@/lib/supabase';

type Visit = Tables<'visits'> & {
  visit_photos: { id: string; storage_path: string }[];
  profiles: { name: string } | null;
};
type Job = Tables<'jobs'>;

export default function SiteDetail() {
  const c = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { sites, reload } = useData();
  const ranked = sites.find((s) => s.id === id);

  const [site, setSite] = useState<Site | null>(ranked ?? null);
  const [visits, setVisits] = useState<Visit[] | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [newJob, setNewJob] = useState('');
  const [addingJob, setAddingJob] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [s, v, j] = await Promise.all([
      supabase.from('sites').select('*').eq('id', id).maybeSingle(),
      supabase
        .from('visits')
        .select('*, visit_photos(id, storage_path), profiles!visits_logged_by_fkey(name)')
        .eq('site_id', id)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase.from('jobs').select('*').eq('site_id', id).order('created_at'),
    ]);
    if (s.error || v.error || j.error) {
      setError('Couldn’t load this site. Check your signal and pull down to try again.');
      return;
    }
    setError('');
    setSite(s.data);
    setVisits((v.data ?? []) as Visit[]);
    setJobs(j.data ?? []);
    const paths = (v.data ?? []).flatMap((x) => x.visit_photos.map((p) => p.storage_path));
    setUrls(await signedPhotoUrls(paths));
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function addJob() {
    const text = newJob.trim();
    if (!text) return;
    setAddingJob(true);
    const { data, error: err } = await supabase.from('jobs').insert({ site_id: id, text }).select().single();
    setAddingJob(false);
    if (err) return setError('Couldn’t add that job, please try again.');
    setJobs((js) => [...js, data]);
    setNewJob('');
    reload(true);
  }

  async function toggleJob(job: Job) {
    setJobs((js) => js.map((j) => (j.id === job.id ? { ...j, done: !j.done } : j)));
    const { error: err } = await supabase.from('jobs').update({ done: !job.done }).eq('id', job.id);
    if (err) {
      setJobs((js) => js.map((j) => (j.id === job.id ? job : j)));
      setError('Couldn’t update that job, please try again.');
    }
    reload(true);
  }

  if (!site) {
    return (
      <Screen center>
        <Stack.Screen options={{ title: '' }} />
        {error ? <Message tone="error">{error}</Message> : visits ? <EmptyState>This site no longer exists.</EmptyState> : <ActivityIndicator color={c.accent} />}
      </Screen>
    );
  }

  const sortedJobs = [...jobs].sort((a, b) => Number(a.done) - Number(b.done));

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          title: site.name,
          headerRight: () => (
            <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/site/[id]/edit', params: { id: site.id } })} hitSlop={10} style={{ paddingHorizontal: 12, paddingVertical: 6 }}>
              <Text style={{ color: '#fff', fontWeight: '600', fontSize: 16 }}>Edit</Text>
            </Pressable>
          ),
        }}
      />
      <Screen onRefresh={load} fabSpace>
        {error ? <Message tone="error">{error}</Message> : null}
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <PriorityDot priority={site.priority} size={14} />
            <Text style={{ color: c.ink, fontSize: 20, fontWeight: '700', flex: 1 }}>{site.name}</Text>
          </View>
          <Text style={{ color: c.muted, marginTop: 4 }}>
            {site.priority ? `${site.priority[0].toUpperCase()}${site.priority.slice(1)} priority · ` : ''}
            {visitedText(site.last_visit)}
          </Text>
          <Text style={{ color: c.muted, marginTop: 4 }}>
            {site.address || 'No address yet'}
            {site.contact ? ` · ${site.contact}` : ''}
          </Text>
          {site.contact_email ? (
            <Text accessibilityRole="link" onPress={() => Linking.openURL(`mailto:${site.contact_email}`)} style={{ color: c.accent, marginTop: 4 }}>
              {site.contact_email}
            </Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/site/[id]/location', params: { id: site.id } })}
            hitSlop={6}
            style={{ marginTop: 6, alignSelf: 'flex-start' }}>
            <Text style={{ color: c.accent, fontWeight: '600' }}>
              {site.lat != null && site.lng != null ? '📍 On the map · change location' : '📍 Not on the map yet · set location'}
            </Text>
          </Pressable>
          {site.notes ? <Text style={{ color: c.ink, marginTop: 8, lineHeight: 21 }}>{site.notes}</Text> : null}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <Button style={{ flex: 1 }} title="+ Log visit" onPress={() => router.push({ pathname: '/log-visit', params: { siteId: site.id } })} />
            <Button style={{ flex: 1 }} variant="ghost" title="Directions" onPress={() => Linking.openURL(directionsUrl(site))} />
          </View>
        </Card>

        <SectionTitle>Jobs to do</SectionTitle>
        <Card>
          {sortedJobs.map((j) => (
            <Pressable
              key={j.id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: j.done }}
              onPress={() => toggleJob(j)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }}>
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 6,
                  borderWidth: 2,
                  borderColor: j.done ? c.accent : c.muted,
                  backgroundColor: j.done ? c.accent : 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                {j.done ? <Text style={{ color: c.accentInk, fontWeight: '900', fontSize: 14 }}>✓</Text> : null}
              </View>
              <Text style={{ flex: 1, color: j.done ? c.muted : c.ink, textDecorationLine: j.done ? 'line-through' : 'none', fontSize: 16 }}>{j.text}</Text>
            </Pressable>
          ))}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: sortedJobs.length ? 8 : 0 }}>
            <TextInput
              value={newJob}
              onChangeText={setNewJob}
              placeholder="e.g. Top up trees, tighten fence"
              placeholderTextColor={c.muted}
              accessibilityLabel="New job"
              onSubmitEditing={addJob}
              returnKeyType="done"
              style={{ flex: 1, borderWidth: 1, borderColor: c.line, backgroundColor: c.bg, color: c.ink, borderRadius: 10, padding: 10, fontSize: 16 }}
            />
            <Button size="small" title="Add" onPress={addJob} busy={addingJob} disabled={!newJob.trim()} />
          </View>
        </Card>

        <SectionTitle>Visit history{visits ? ` (${visits.length})` : ''}</SectionTitle>
        {!visits ? (
          <ActivityIndicator color={c.accent} />
        ) : visits.length === 0 ? (
          <EmptyState>No visits yet</EmptyState>
        ) : (
          visits.map((v) => (
            <Card key={v.id}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <PriorityDot priority={v.priority_at_visit} />
                <Text style={{ color: c.ink, fontWeight: '700' }}>{formatDate(v.date)}</Text>
                <Text style={{ color: c.muted, marginLeft: 'auto' }}>{v.profiles?.name || v.legacy_logged_by || ''}</Text>
              </View>
              {v.work_carried_out ? <Text style={{ color: c.ink, marginTop: 6, lineHeight: 21 }}>{v.work_carried_out}</Text> : null}
              {v.notes ? <Text style={{ color: c.muted, marginTop: 6, lineHeight: 20 }}>{v.notes}</Text> : null}
              {v.visit_photos.length > 0 ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {v.visit_photos.map((p) => (
                    <Pressable key={p.id} accessibilityRole="imagebutton" accessibilityLabel="Open photo" onPress={() => urls[p.storage_path] && setViewing(urls[p.storage_path])}>
                      <Image source={urls[p.storage_path]} style={{ width: 72, height: 72, borderRadius: 8, backgroundColor: c.line }} contentFit="cover" transition={150} />
                    </Pressable>
                  ))}
                </View>
              ) : v.legacy_photo_count > 0 ? (
                <Text style={{ color: c.muted, marginTop: 6 }}>
                  📷 {v.legacy_photo_count} photo{v.legacy_photo_count > 1 ? 's' : ''} (from old app)
                </Text>
              ) : null}
            </Card>
          ))
        )}
      </Screen>
      <LogVisitFab siteId={site.id} />

      <Modal visible={!!viewing} transparent animationType="fade" onRequestClose={() => setViewing(null)}>
        <Pressable accessibilityLabel="Close photo" onPress={() => setViewing(null)} style={{ flex: 1, backgroundColor: '#000e', justifyContent: 'center' }}>
          {viewing ? <Image source={viewing} style={{ width: '100%', height: '85%' }} contentFit="contain" /> : null}
        </Pressable>
      </Modal>
    </View>
  );
}
