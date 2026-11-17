import { StyleSheet, Text, View } from 'react-native';

import { useColors } from '@/constants/theme';
import { supabaseConfigured } from '@/lib/supabase';

/** Temporary screen body until the real screens land (build order step 4/5). */
export function Placeholder({ title, step }: { title: string; step: string }) {
  const c = useColors();
  return (
    <View style={[styles.wrap, { backgroundColor: c.bg }]}>
      <Text style={[styles.title, { color: c.ink }]}>{title}</Text>
      <Text style={{ color: c.muted, textAlign: 'center' }}>Coming in build step {step}.</Text>
      {!supabaseConfigured && (
        <Text style={{ color: c.muted, textAlign: 'center', marginTop: 16 }}>
          Supabase isn’t configured yet: copy .env.example to .env.local and fill it in.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  title: { fontSize: 20, fontWeight: '700' },
});
