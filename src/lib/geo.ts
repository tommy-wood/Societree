import * as Location from 'expo-location';

import { isValidLatLng } from './logic';
import { supabase } from './supabase';

export type LatLng = { lat: number; lng: number };

/** Roughly Plymouth: where the map opens when there's nothing to show yet. */
export const PLYMOUTH: LatLng = { lat: 50.3755, lng: -4.1427 };

/** The phone's current position, or an error message people can act on. */
export async function currentPosition(): Promise<{ ok: true; pos: LatLng; accuracy: number | null } | { ok: false; error: string }> {
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) {
      return { ok: false, error: 'Location permission is off. Turn it on for Societree (or your browser) in your phone’s settings, then try again.' };
    }
    const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    return { ok: true, pos: { lat: p.coords.latitude, lng: p.coords.longitude }, accuracy: p.coords.accuracy ?? null };
  } catch {
    return { ok: false, error: 'Couldn’t get your location. Make sure location is switched on and try again outside.' };
  }
}

export type Place = { label: string; pos: LatLng };

/**
 * Look up an address or postcode with OpenStreetMap's free Nominatim service.
 * Their usage policy allows light use (about one search a second, not as-you-type),
 * so we only search when someone presses Search.
 */
export async function searchPlaces(query: string): Promise<Place[]> {
  const q = query.trim();
  if (!q) return [];
  // Look in Devon and Cornwall first; only if nothing turns up, search the whole UK.
  const local = await nominatim(q, true);
  return local.length ? local : nominatim(q, false);
}

async function nominatim(q: string, bounded: boolean): Promise<Place[]> {
  const params = new URLSearchParams({
    q,
    format: 'jsonv2',
    countrycodes: 'gb',
    limit: '6',
    viewbox: '-5.8,51.25,-2.85,49.9', // Devon and Cornwall
    bounded: bounded ? '1' : '0',
    'accept-language': 'en-GB',
  });
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`search failed (${res.status})`);
  const rows = (await res.json()) as { display_name: string; lat: string; lon: string }[];
  return rows
    .map((r) => ({ label: r.display_name, pos: { lat: Number(r.lat), lng: Number(r.lon) } }))
    .filter((p) => isValidLatLng(p.pos.lat, p.pos.lng));
}

/** Save a site's location (rounded to ~1 m). */
export async function saveSiteLocation(siteId: string, pos: LatLng) {
  const round = (n: number) => Math.round(n * 1e5) / 1e5;
  return supabase.from('sites').update({ lat: round(pos.lat), lng: round(pos.lng) }).eq('id', siteId);
}
