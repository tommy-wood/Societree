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

const THUMB_EDGE = 400;

/** Small preview (400 px on the longest side) for lists, so they don't download full photos. */
export async function makeThumbnail(uri: string): Promise<string> {
  const probe = await ImageManipulator.manipulate(uri).renderAsync();
  const ctx = ImageManipulator.manipulate(uri);
  if (Math.max(probe.width, probe.height) > THUMB_EDGE) {
    ctx.resize(probe.width >= probe.height ? { width: THUMB_EDGE } : { height: THUMB_EDGE });
  }
  const img = await ctx.renderAsync();
  return (await img.saveAsync({ format: SaveFormat.JPEG, compress: 0.6 })).uri;
}

/** Upload one (already compressed) photo for a visit, plus its small preview, and record them. */
export async function uploadVisitPhoto(visitId: string, uri: string): Promise<void> {
  const id = randomId();
  const path = `${visitId}/${id}.jpg`;
  const body = await (await fetch(uri)).arrayBuffer();
  const up = await supabase.storage.from(PHOTO_BUCKET).upload(path, body, { contentType: 'image/jpeg', upsert: false });
  if (up.error) throw up.error;

  // The preview is a nice-to-have: if it fails, the full photo is still saved.
  let thumbPath: string | null = `${visitId}/${id}.thumb.jpg`;
  try {
    const thumb = await (await fetch(await makeThumbnail(uri))).arrayBuffer();
    const t = await supabase.storage.from(PHOTO_BUCKET).upload(thumbPath, thumb, { contentType: 'image/jpeg', upsert: false });
    if (t.error) thumbPath = null;
  } catch {
    thumbPath = null;
  }

  const row = await supabase.from('visit_photos').insert({ visit_id: visitId, storage_path: path, thumb_path: thumbPath });
  if (row.error) {
    await supabase.storage.from(PHOTO_BUCKET).remove(thumbPath ? [path, thumbPath] : [path]);
    throw row.error;
  }
}

/** A time-limited link to one private photo (used when someone taps a preview). */
export async function signedPhotoUrl(path: string, expiresIn = 3600): Promise<string | null> {
  const { data } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrl(path, expiresIn);
  return data?.signedUrl ?? null;
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
