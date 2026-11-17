#!/usr/bin/env node
// Copy photos and receipts from the R2 backup back into Supabase Storage.
// Use after restoring the database (see BACKUP.md). Existing files are left
// alone unless you pass --overwrite.
//
// Same settings as scripts/backup.mjs (SUPABASE_URL, SUPABASE_SECRET_KEY,
// R2_ACCOUNT_ID or R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET).

import { GetObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';

const env = (k, fallback) => {
  const v = process.env[k] ?? fallback;
  if (!v) {
    console.error(`Missing ${k}`);
    process.exit(1);
  }
  return v;
};
const overwrite = process.argv.includes('--overwrite');
const supabase = createClient(env('SUPABASE_URL', 'https://zbdbtgqbdzgjmxwhoxns.supabase.co'), env('SUPABASE_SECRET_KEY'), { auth: { persistSession: false } });
const BUCKET = env('R2_BUCKET');
const s3 = new S3Client({
  region: process.env.R2_REGION || 'auto',
  endpoint: process.env.R2_ENDPOINT || `https://${env('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
  forcePathStyle: true,
  credentials: { accessKeyId: env('R2_ACCESS_KEY_ID'), secretAccessKey: env('R2_SECRET_ACCESS_KEY') },
});

let restored = 0;
let skipped = 0;
let token;
do {
  const page = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: 'files/', ContinuationToken: token }));
  for (const o of page.Contents ?? []) {
    const [, bucket, ...rest] = o.Key.split('/');
    const filePath = rest.join('/');
    if (!bucket || !filePath) continue;
    const obj = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: o.Key }));
    const body = Buffer.from(await obj.Body.transformToByteArray());
    const { error } = await supabase.storage.from(bucket).upload(filePath, body, { contentType: obj.ContentType || 'image/jpeg', upsert: overwrite });
    if (error && /exists|Duplicate/i.test(error.message)) skipped++;
    else if (error) throw new Error(`${bucket}/${filePath}: ${error.message}`);
    else restored++;
  }
  token = page.IsTruncated ? page.NextContinuationToken : undefined;
} while (token);
console.log(`Restored ${restored} file(s); ${skipped} already there.`);
