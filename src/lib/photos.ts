import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { supabase } from './supabase';

export const PHOTO_BUCKET = 'visit-photos';
const MAX_EDGE = 1600; // px on the longest side
const QUALITY = 0.7;

/** Resize to at most 1600px and re-encode as JPEG (also converts HEIC). Typically 150-400 KB. */
export async function compressPhoto(uri: string, width?: number, height?: number): Promise<string> {
  const ctx = ImageManipulator.manipulate(uri);
  if (width && height && Math.max(width, height) > MAX_EDGE) {
    ctx.resize(width >= height ? { width: MAX_EDGE } : { height: MAX_EDGE });
  } else if (!width || !height) {
    ctx.resize({ width: MAX_EDGE }); // unknown size: cap the width
  }
  const img = await ctx.renderAsync();
  const out = await img.saveAsync({ format: SaveFormat.JPEG, compress: QUALITY });
  return out.uri;
}

function randomId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/** Upload one (already compressed) photo for a visit and record it. */
export async function uploadVisitPhoto(visitId: string, uri: string): Promise<void> {
  const body = await (await fetch(uri)).arrayBuffer();
  const path = `${visitId}/${randomId()}.jpg`;
  const up = await supabase.storage.from(PHOTO_BUCKET).upload(path, body, { contentType: 'image/jpeg', upsert: false });
  if (up.error) throw up.error;
  const row = await supabase.from('visit_photos').insert({ visit_id: visitId, storage_path: path });
  if (row.error) {
    await supabase.storage.from(PHOTO_BUCKET).remove([path]);
    throw row.error;
  }
}

/** Time-limited links for private photos, keyed by storage path. */
export async function signedPhotoUrls(paths: string[], expiresIn = 3600): Promise<Record<string, string>> {
  if (!paths.length) return {};
  const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(paths, expiresIn);
  if (error || !data) return {};
  const out: Record<string, string> = {};
  for (const d of data) if (d.path && d.signedUrl) out[d.path] = d.signedUrl;
  return out;
}
