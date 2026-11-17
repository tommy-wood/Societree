import type { LatLng } from '@/lib/geo';
import type { PinStatus } from '@/lib/logic';

export type MapPin = { id: string; name: string; lat: number; lng: number; status: PinStatus };

export type SitesMapProps = {
  pins: MapPin[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
};

export type LocationPickerProps = {
  value: LatLng | null;
  onChange: (pos: LatLng) => void;
};
