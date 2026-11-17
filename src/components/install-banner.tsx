import { Pressable, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import { useColors } from '@/constants/theme';
import { useInstallOffer } from '@/lib/pwa';

/** "Add Societree to your home screen" card, shown on the web only. */
export function InstallBanner() {
  const c = useColors();
  const { kind, install, dismiss } = useInstallOffer();
  if (!kind) return null;
  return (
    <View style={{ backgroundColor: c.card, borderColor: c.accent, borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
        <Text style={{ color: c.ink, fontWeight: '700', fontSize: 16, flex: 1 }}>Add Societree to your home screen</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Hide this tip" onPress={dismiss} hitSlop={12}>
          <Text style={{ color: c.muted, fontSize: 18 }}>✕</Text>
        </Pressable>
      </View>
      {kind === 'prompt' ? (
        <>
          <Text style={{ color: c.muted, marginTop: 4, marginBottom: 10 }}>It opens like a normal app, full screen, with its own icon.</Text>
          <Button size="small" title="Install the app" onPress={install} />
        </>
      ) : kind === 'ios' ? (
        <Text style={{ color: c.muted, marginTop: 4, lineHeight: 20 }}>
          In Safari, tap the Share button <Text style={{ fontWeight: '700' }}>(□↑)</Text>, then <Text style={{ fontWeight: '700' }}>Add to Home Screen</Text>. If you opened this link from
          WhatsApp or an email, first choose <Text style={{ fontWeight: '700' }}>Open in Safari</Text>.
        </Text>
      ) : (
        <Text style={{ color: c.muted, marginTop: 4, lineHeight: 20 }}>
          Open this link in <Text style={{ fontWeight: '700' }}>Chrome</Text>, then tap the menu <Text style={{ fontWeight: '700' }}>(⋮)</Text> and choose{' '}
          <Text style={{ fontWeight: '700' }}>Install app</Text> or <Text style={{ fontWeight: '700' }}>Add to Home screen</Text>. (Links opened inside WhatsApp or
          email apps can’t be installed: use “Open in Chrome” first.)
        </Text>
      )}
    </View>
  );
}
