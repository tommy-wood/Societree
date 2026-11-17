#!/usr/bin/env node
// maplibre-gl v6 runs its map rendering in a separate worker file that the
// Expo bundler doesn't copy. Put it in public/ (served as-is and included in
// the web build) so src/components/sites-map.web.tsx can point at it.
// Runs automatically after `npm install` / `npm ci`.
import { copyFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'node_modules', 'maplibre-gl', 'dist', 'maplibre-gl-worker.mjs');
const destDir = path.join(root, 'public', 'maplibre');
mkdirSync(destDir, { recursive: true });
copyFileSync(src, path.join(destDir, 'maplibre-gl-worker.mjs'));
console.log('copied maplibre-gl worker to public/maplibre/');
