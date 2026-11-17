// Small shared building blocks, styled after the prototype's CSS.
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand, useColors } from '@/constants/theme';

export function Screen({ children, scroll = true, center = false }: { children: ReactNode; scroll?: boolean; center?: boolean }) {
  const c = useColors();
  const body = <View style={[styles.inner, center && styles.center]}>{children}</View>;
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {scroll ? (
        <ScrollView contentContainerStyle={[{ flexGrow: 1 }, center && styles.center]} keyboardShouldPersistTaps="handled">
          {body}
        </ScrollView>
      ) : (
        body
      )}
    </View>
  );
}

/** Full-screen page with the dark-green brand band, for screens outside the tabs (sign-in etc). */
export function BrandScreen({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const c = useColors();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: Brand.header }}>
        <View style={styles.brandBar}>
          <Text style={{ fontSize: 30 }}>🌳</Text>
          <View>
            <Text style={styles.brandTitle}>Societree</Text>
            <Text style={styles.brandSub}>Forest care</Text>
          </View>
        </View>
      </SafeAreaView>
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <Text style={[styles.h1, { color: c.ink }]}>{title}</Text>
        {subtitle ? <Text style={{ color: c.muted, marginBottom: 16 }}>{subtitle}</Text> : null}
        {children}
      </ScrollView>
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return <View style={[styles.card, { backgroundColor: c.card, borderColor: c.line }, style]}>{children}</View>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  const c = useColors();
  return <Text style={[styles.section, { color: c.muted }]}>{children}</Text>;
}

type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  title: string;
  variant?: 'primary' | 'ghost' | 'danger';
  size?: 'normal' | 'small';
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({ title, variant = 'primary', size = 'normal', busy, disabled, style, ...rest }: ButtonProps) {
  const c = useColors();
  const bg = variant === 'primary' ? c.accent : variant === 'danger' ? Brand.urgent : 'transparent';
  const fg = variant === 'primary' ? c.accentInk : variant === 'danger' ? '#fff' : c.accent;
  const off = disabled || busy;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={off}
      style={({ pressed }) => [
        styles.btn,
        size === 'small' && styles.btnSmall,
        { backgroundColor: bg, borderColor: variant === 'ghost' ? c.line : bg, opacity: off ? 0.6 : pressed ? 0.8 : 1 },
        style,
      ]}
      {...rest}>
      {busy ? <ActivityIndicator color={fg} /> : <Text style={[styles.btnText, size === 'small' && { fontSize: 14 }, { color: fg }]}>{title}</Text>}
    </Pressable>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const c = useColors();
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ color: c.muted, fontSize: 13, marginBottom: 4 }}>{label}</Text>
      <TextInput
        placeholderTextColor={c.muted}
        style={[styles.input, { color: c.ink, backgroundColor: c.card, borderColor: c.line }]}
        {...props}
      />
    </View>
  );
}

export function Message({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'error' | 'success' }) {
  const c = useColors();
  const color = tone === 'error' ? Brand.urgent : tone === 'success' ? Brand.low : c.muted;
  return <Text style={{ color, marginVertical: 8, lineHeight: 20 }}>{children}</Text>;
}

export function LinkText({ children, onPress }: { children: ReactNode; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable accessibilityRole="link" onPress={onPress} hitSlop={10} style={{ paddingVertical: 10 }}>
      <Text style={{ color: c.accent, fontWeight: '600', textAlign: 'center' }}>{children}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  inner: { width: '100%', maxWidth: 640, alignSelf: 'center', padding: 16, paddingBottom: 40 },
  center: { justifyContent: 'center' },
  brandBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
  brandTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  brandSub: { color: Brand.headerSubtle, fontSize: 12 },
  h1: { fontSize: 22, fontWeight: '700', marginTop: 8, marginBottom: 6 },
  card: { borderWidth: 1, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 10 },
  section: { fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 18, marginBottom: 8, marginHorizontal: 2 },
  btn: { borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, minHeight: 48 },
  btnSmall: { paddingVertical: 8, paddingHorizontal: 12, minHeight: 36 },
  btnText: { fontSize: 16, fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 16 },
});
