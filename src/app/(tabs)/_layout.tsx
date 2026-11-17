import { router } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { Platform, Pressable, Text } from 'react-native';

import { Brand, useColors } from '@/constants/theme';

function icon(glyph: string) {
  return function TabIcon() {
    return <Text style={{ fontSize: 20, lineHeight: 24 }}>{glyph}</Text>;
  };
}

export default function TabLayout() {
  const c = useColors();
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: Brand.header },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.muted,
        // Web has no safe-area inset to pad the bar, so give the emoji icon + label room.
        tabBarStyle: { backgroundColor: c.card, borderTopColor: c.line, ...(Platform.OS === 'web' ? { height: 60, paddingTop: 4, paddingBottom: 6 } : null) },
        tabBarLabelStyle: { fontSize: 12 },
        headerRight: () => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Your account"
            onPress={() => router.push('/account')}
            hitSlop={10}
            style={{ paddingHorizontal: 16, paddingVertical: 6 }}>
            <Text style={{ fontSize: 22 }}>👤</Text>
          </Pressable>
        ),
      }}>
      <Tabs.Screen name="index" options={{ title: 'Today', headerTitle: '🌳 Societree', tabBarIcon: icon('🏠') }} />
      <Tabs.Screen name="sites" options={{ title: 'Sites', tabBarIcon: icon('📍') }} />
      <Tabs.Screen name="map" options={{ title: 'Map', tabBarIcon: icon('🗺️') }} />
      <Tabs.Screen name="stock" options={{ title: 'Stock', tabBarIcon: icon('📦') }} />
    </Tabs>
  );
}
