// Web map (MapLibre GL + free OpenFreeMap tiles). The native app uses sites-map.tsx.
import 'maplibre-gl/dist/maplibre-gl.css';

import type { FeatureCollection } from 'geojson';
import maplibregl, { type GeoJSONSource, type Map as MLMap } from 'maplibre-gl';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { View } from 'react-native';

import { Brand, PIN_COLOURS } from '@/constants/theme';
import { PLYMOUTH, type LatLng } from '@/lib/geo';

import type { LocationPickerProps, MapPin, SitesMapProps } from './sites-map.types';

// OpenFreeMap: free OpenStreetMap vector tiles, no key, no usage limits.
const STYLE = 'https://tiles.openfreemap.org/styles/liberty';

function toGeoJSON(pins: MapPin[]): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: pins.map((p) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      properties: { id: p.id, name: p.name, colour: PIN_COLOURS[p.status] },
    })),
  };
}

export function SitesMap({ pins, selectedId, onSelect }: SitesMapProps) {
  const el = useRef<HTMLDivElement | null>(null);
  const map = useRef<MLMap | null>(null);
  const loaded = useRef(false);
  const fitted = useRef(false);
  const latest = useRef({ pins, onSelect, selectedId });
  useLayoutEffect(() => {
    latest.current = { pins, onSelect, selectedId };
  });

  const fit = () => {
    const m = map.current;
    const ps = latest.current.pins;
    if (!m || !loaded.current || fitted.current || ps.length === 0) return;
    fitted.current = true;
    if (ps.length === 1) {
      m.jumpTo({ center: [ps[0].lng, ps[0].lat], zoom: 14 });
      return;
    }
    const b = new maplibregl.LngLatBounds();
    ps.forEach((p) => b.extend([p.lng, p.lat]));
    m.fitBounds(b, { padding: 60, maxZoom: 14, duration: 0 });
  };

  useEffect(() => {
    if (!el.current) return;
    const m = new maplibregl.Map({
      container: el.current,
      style: STYLE,
      center: [PLYMOUTH.lng, PLYMOUTH.lat],
      zoom: 10,
      attributionControl: { compact: true },
    });
    map.current = m;
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    m.addControl(new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: true }), 'top-right');

    m.on('load', () => {
      m.addSource('sites', { type: 'geojson', data: toGeoJSON(latest.current.pins) });
      m.addLayer({
        id: 'site-pins',
        type: 'circle',
        source: 'sites',
        paint: {
          'circle-color': ['get', 'colour'],
          'circle-radius': ['case', ['==', ['get', 'id'], latest.current.selectedId ?? ''], 12, 9],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2.5,
        },
      });
      m.addLayer({
        id: 'site-labels',
        type: 'symbol',
        source: 'sites',
        minzoom: 11,
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Noto Sans Regular'],
          'text-size': 12,
          'text-offset': [0, 1.1],
          'text-anchor': 'top',
          'text-optional': true,
        },
        paint: { 'text-color': Brand.header, 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 },
      });
      loaded.current = true;
      fit();
    });

    m.on('click', (e) => {
      const hit = m.queryRenderedFeatures(e.point, { layers: ['site-pins'] })[0];
      latest.current.onSelect((hit?.properties?.id as string | undefined) ?? null);
    });
    m.on('mouseenter', 'site-pins', () => (m.getCanvas().style.cursor = 'pointer'));
    m.on('mouseleave', 'site-pins', () => (m.getCanvas().style.cursor = ''));

    return () => {
      m.remove();
      map.current = null;
      loaded.current = false;
    };
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m || !loaded.current) return;
    (m.getSource('sites') as GeoJSONSource | undefined)?.setData(toGeoJSON(pins));
    fit();
  }, [pins]);

  useEffect(() => {
    const m = map.current;
    if (!m || !loaded.current) return;
    m.setPaintProperty('site-pins', 'circle-radius', ['case', ['==', ['get', 'id'], selectedId ?? ''], 12, 9]);
  }, [selectedId]);

  return (
    <View style={{ flex: 1 }}>
      <div ref={el} style={{ position: 'absolute', inset: 0 }} />
    </View>
  );
}

/** Map with a draggable pin for choosing a site's location. Tap the map to move the pin. */
export function LocationPicker({ value, onChange }: LocationPickerProps) {
  const el = useRef<HTMLDivElement | null>(null);
  const map = useRef<MLMap | null>(null);
  const marker = useRef<maplibregl.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  useLayoutEffect(() => {
    onChangeRef.current = onChange;
  });

  const place = (pos: LatLng) => {
    const m = map.current;
    if (!m) return;
    if (!marker.current) {
      marker.current = new maplibregl.Marker({ color: Brand.urgent, draggable: true }).setLngLat([pos.lng, pos.lat]).addTo(m);
      marker.current.on('dragend', () => {
        const ll = marker.current!.getLngLat();
        onChangeRef.current({ lat: ll.lat, lng: ll.lng });
      });
    } else {
      marker.current.setLngLat([pos.lng, pos.lat]);
    }
  };

  useEffect(() => {
    if (!el.current) return;
    const start = value ?? PLYMOUTH;
    const m = new maplibregl.Map({
      container: el.current,
      style: STYLE,
      center: [start.lng, start.lat],
      zoom: value ? 16 : 11,
      attributionControl: { compact: true },
    });
    map.current = m;
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    if (value) place(value);
    m.on('click', (e) => onChangeRef.current({ lat: e.lngLat.lat, lng: e.lngLat.lng }));
    return () => {
      m.remove();
      map.current = null;
      marker.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Follow changes from GPS / address search / taps.
  useEffect(() => {
    const m = map.current;
    if (!m || !value) return;
    place(value);
    const c = m.getCenter();
    const far = Math.abs(c.lat - value.lat) > 0.002 || Math.abs(c.lng - value.lng) > 0.003;
    if (far) m.flyTo({ center: [value.lng, value.lat], zoom: Math.max(m.getZoom(), 16), duration: 600 });
  }, [value]);

  return (
    <View style={{ flex: 1 }}>
      <div ref={el} style={{ position: 'absolute', inset: 0 }} />
    </View>
  );
}
