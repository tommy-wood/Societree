import { router } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { Pressable, Text } from 'react-native';

import { Brand, useColors } from '@/constants/theme';

function icon(glyph: string) {
  return function TabIcon() {
    return <Text style={{ fontSize: 20 }}>{glyph}</Text>;
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
        tabBarStyle: { backgroundColor: c.card, borderTopColor: c.line },
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
      <Tabs.Screen name="stock" options={{ title: 'Stock', tabBarIcon: icon('📦') }} />
    </Tabs>
  );
}
