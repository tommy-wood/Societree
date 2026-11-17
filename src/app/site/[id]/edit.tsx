import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator } from 'react-native';

import { SiteForm } from '@/components/site-form';
import { Message, Screen } from '@/components/ui';
import { useColors } from '@/constants/theme';
import type { Site } from '@/lib/data';
import { supabase } from '@/lib/supabase';

export default function EditSite() {
  const c = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [site, setSite] = useState<Site | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase
      .from('sites')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error: err }) => (err ? setError('Couldn’t load this site.') : setSite(data)));
  }, [id]);

  return (
    <>
      <Stack.Screen options={{ title: 'Edit site' }} />
      {site ? (
        <SiteForm site={site} />
      ) : (
        <Screen center>{error ? <Message tone="error">{error}</Message> : <ActivityIndicator color={c.accent} />}</Screen>
      )}
    </>
  );
}
