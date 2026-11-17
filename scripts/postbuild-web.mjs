#!/usr/bin/env node
// After `expo export --platform web`: give the service worker the list of app
// files to save on install (so the app opens with no signal) and a build id,
// so each deploy replaces the previous cache.
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const dist = path.resolve(process.argv[2] ?? 'dist');

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}

const files = (await walk(path.join(dist, '_expo', 'static')))
  .map((f) => '/' + path.relative(dist, f).split(path.sep).join('/'))
  .filter((f) => /\.(js|css)$/.test(f))
  .sort();

const hash = createHash('sha256');
for (const f of files) hash.update(f);
hash.update(await readFile(path.join(dist, 'index.html')));
const buildId = hash.digest('hex').slice(0, 12);

const swPath = path.join(dist, 'sw.js');
let sw = await readFile(swPath, 'utf8');
if (!sw.includes('/*__PRECACHE__*/ []') || !sw.includes('__BUILD_ID__')) {
  console.error('sw.js placeholders not found; was it already processed?');
  process.exit(1);
}
sw = sw.replace('/*__PRECACHE__*/ []', JSON.stringify(files)).replace('__BUILD_ID__', buildId);
await writeFile(swPath, sw);
console.log(`sw.js: build ${buildId}, ${files.length} files to precache`);
