// Native placeholder. The interactive map currently runs in the web app
// (sites-map.web.tsx); a native map comes with the Android build (step 8).
import { Text, View } from 'react-native';

import { useColors } from '@/constants/theme';

import type { LocationPickerProps, SitesMapProps } from './sites-map.types';

export function SitesMap({ pins }: SitesMapProps) {
  const c = useColors();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: c.bg }}>
      <Text style={{ color: c.ink, fontWeight: '700', fontSize: 16, marginBottom: 6 }}>Map coming to the phone app</Text>
      <Text style={{ color: c.muted, textAlign: 'center' }}>
        {pins.length} forests have a location. Open Societree in your phone’s browser to see them on the map.
      </Text>
    </View>
  );
}

export function LocationPicker({ value }: LocationPickerProps) {
  const c = useColors();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: c.card }}>
      <Text style={{ color: c.muted, textAlign: 'center' }}>
        {value ? `Pin at ${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}` : 'Use your current location or search for the address.'}
      </Text>
    </View>
  );
}
