#!/usr/bin/env node
// Off-site backup of Societree to Cloudflare R2 (S3-compatible).
//
// 1. Uploads the database export made just before (backup/*.sql) to
//    database/YYYY-MM-DD/ in the bucket, gzipped.
// 2. Copies every photo and receipt that isn't in the bucket yet to
//    files/<storage bucket>/<path>. Nothing is ever deleted from the backup,
//    so photos removed from the app are still kept here.
//
// Run weekly by .github/workflows/backup.yml. Needs:
//   SUPABASE_SECRET_KEY                    read all files (bypasses RLS)
//   R2_ACCOUNT_ID or R2_ENDPOINT           where to send them
//   R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
//   SUPABASE_URL (optional, defaults to the live project)

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';

const env = (k, fallback) => {
  const v = process.env[k] ?? fallback;
  if (!v) {
    console.error(`Missing ${k}`);
    process.exit(1);
  }
  return v;
};

const SUPABASE_URL = env('SUPABASE_URL', 'https://zbdbtgqbdzgjmxwhoxns.supabase.co');
const supabase = createClient(SUPABASE_URL, env('SUPABASE_SECRET_KEY'), { auth: { persistSession: false } });
const endpoint = process.env.R2_ENDPOINT || `https://${env('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`;
const BUCKET = env('R2_BUCKET');
const s3 = new S3Client({
  region: process.env.R2_REGION || 'auto',
  endpoint,
  forcePathStyle: true,
  credentials: { accessKeyId: env('R2_ACCESS_KEY_ID'), secretAccessKey: env('R2_SECRET_ACCESS_KEY') },
});
const DUMP_DIR = process.argv[2] || 'backup';
const STORAGE_BUCKETS = ['visit-photos', 'receipts'];
const today = new Date().toISOString().slice(0, 10);

async function existingKeys(prefix) {
  const keys = new Set();
  let token;
  do {
    const res = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix, ContinuationToken: token }));
    for (const o of res.Contents ?? []) keys.add(o.Key);
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return keys;
}

/** Every file path in a storage bucket (folders are listed one level at a time). */
async function listStorage(bucket, folder = '') {
  const out = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.storage.from(bucket).list(folder, { limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw new Error(`list ${bucket}/${folder}: ${error.message}`);
    for (const item of data) {
      const p = folder ? `${folder}/${item.name}` : item.name;
      if (item.id === null) out.push(...(await listStorage(bucket, p))); // a folder
      else out.push({ path: p, type: item.metadata?.mimetype || 'application/octet-stream' });
    }
    if (data.length < 1000) break;
  }
  return out;
}

async function main() {
  // 1. Database export
  const dumps = (await readdir(DUMP_DIR)).filter((f) => f.endsWith('.sql'));
  if (dumps.length === 0) throw new Error(`No .sql files in ${DUMP_DIR}/`);
  for (const f of dumps) {
    const body = gzipSync(await readFile(path.join(DUMP_DIR, f)));
    await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: `database/${today}/${f}.gz`, Body: body, ContentType: 'application/gzip' }));
    console.log(`✓ database/${today}/${f}.gz (${Math.round(body.length / 1024)} KB)`);
  }

  // 2. Photos and receipts (only new ones)
  const summary = { date: today, database: dumps, files: {} };
  for (const bucket of STORAGE_BUCKETS) {
    const have = await existingKeys(`files/${bucket}/`);
    const files = await listStorage(bucket);
    let copied = 0;
    let bytes = 0;
    for (const f of files) {
      const key = `files/${bucket}/${f.path}`;
      if (have.has(key)) continue;
      const { data, error } = await supabase.storage.from(bucket).download(f.path);
      if (error) throw new Error(`download ${bucket}/${f.path}: ${error.message}`);
      const body = Buffer.from(await data.arrayBuffer());
      await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: f.type }));
      copied++;
      bytes += body.length;
    }
    summary.files[bucket] = { total: files.length, copiedThisRun: copied };
    console.log(`✓ ${bucket}: ${files.length} files, ${copied} new copied (${Math.round(bytes / 1024)} KB)`);
  }

  await s3.send(
    new PutObjectCommand({ Bucket: BUCKET, Key: `database/${today}/summary.json`, Body: JSON.stringify(summary, null, 2), ContentType: 'application/json' }),
  );
  console.log('Backup complete.');
}

main().catch((e) => {
  console.error('Backup FAILED:', e.message ?? e);
  process.exit(1);
});
