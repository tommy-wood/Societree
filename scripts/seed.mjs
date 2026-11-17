#!/usr/bin/env node
// Load seed/societree-seed-data.json into Supabase.
//
//   npm run seed            # refuses to run if sites/visits/stock already have rows
//   npm run seed -- --reset # DELETES all sites, visits, jobs, photos rows and stock first
//
// Needs (in .env.local or the shell):
//   EXPO_PUBLIC_SUPABASE_URL   https://<project-ref>.supabase.co
//   SUPABASE_SECRET_KEY        secret key (sb_secret_...) or legacy service_role key.
//                              Bypasses RLS: never put it in the app or commit it.

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const seedPath = path.join(root, 'seed', 'societree-seed-data.json');
const reset = process.argv.includes('--reset');

const url = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error(
    'Missing EXPO_PUBLIC_SUPABASE_URL and/or SUPABASE_SECRET_KEY.\n' +
      'Put them in .env.local (see .env.example) or pass them on the command line.',
  );
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const PRIORITIES = new Set(['low', 'medium', 'urgent']);
const priority = (p) => (PRIORITIES.has((p ?? '').trim().toLowerCase()) ? p.trim().toLowerCase() : null);
const text = (s) => (s ?? '').toString(); // keep line breaks as-is
const date = (d) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null);

function check(error, what) {
  if (error) {
    console.error(`✗ ${what}: ${error.message}`);
    process.exit(1);
  }
}

async function count(table) {
  const { count: n, error } = await db.from(table).select('*', { count: 'exact', head: true });
  check(error, `count ${table}`);
  return n ?? 0;
}

async function main() {
  const data = JSON.parse(await readFile(seedPath, 'utf8'));
  console.log(`Seed file: ${data.source} (exported ${data.exported})`);
  console.log(`  ${data.sites.length} sites, ${data.visits.length} visits, ${data.stock_items.length} stock items, ${(data.jobs ?? []).length} jobs\n`);

  // ---- 0. Guard against double-seeding ------------------------------------
  const existing = {
    sites: await count('sites'),
    visits: await count('visits'),
    stock_items: await count('stock_items'),
  };
  const hasData = Object.values(existing).some((n) => n > 0);
  if (hasData && !reset) {
    console.error(
      `Database already has data (${existing.sites} sites, ${existing.visits} visits, ` +
        `${existing.stock_items} stock items).\nRe-run with --reset to wipe and reload. ` +
        'That deletes ALL sites, visits, jobs and stock, including anything logged in the app.',
    );
    process.exit(1);
  }
  if (reset && hasData) {
    console.log('--reset: deleting existing sites (cascades to visits, photos rows, jobs) and stock…');
    const all = '00000000-0000-0000-0000-000000000000';
    check((await db.from('sites').delete().neq('id', all)).error, 'delete sites');
    check((await db.from('stock_items').delete().neq('id', all)).error, 'delete stock');
  }

  // ---- 1. Sites -----------------------------------------------------------
  const siteRows = data.sites.map((s) => ({
    slug: s.id,
    name: text(s.name).trim(),
    address: text(s.address),
    contact: text(s.contact),
    contact_email: text(s.contact_email),
    notes: text(s.notes),
    priority: priority(s.priority),
    last_visit: null, // filled by the visits trigger, then confirmed in step 3
  }));
  const { data: sites, error: siteErr } = await db.from('sites').insert(siteRows).select('id, slug');
  check(siteErr, 'insert sites');
  const siteId = new Map(sites.map((s) => [s.slug, s.id]));
  console.log(`✓ ${sites.length} sites`);

  // ---- 2. Visits ----------------------------------------------------------
  // The Base44 export lists same-day visits newest first. Give each one a
  // created_at that preserves that order, and insert oldest first so the
  // visits trigger ends with the newest visit's priority on the site.
  const n = data.visits.length;
  const visitRows = data.visits.map((v, i) => {
    const sid = siteId.get(v.site_id);
    if (!sid) {
      console.error(`✗ Visit references unknown site slug "${v.site_id}"`);
      process.exit(1);
    }
    const d = date(v.date);
    if (!d) {
      console.error(`✗ Visit for "${v.site_id}" has a bad date "${v.date}"`);
      process.exit(1);
    }
    const createdAt = new Date(Date.parse(`${d}T12:00:00Z`) + (n - i) * 1000).toISOString();
    return {
      site_id: sid,
      date: d,
      priority_at_visit: priority(v.priority),
      work_carried_out: text(v.work_carried_out),
      notes: text(v.notes),
      logged_by: null,
      legacy_logged_by: text(v.logged_by).trim() || null,
      legacy_photo_count: Number(v.photo_count) || 0,
      created_at: createdAt,
    };
  });
  visitRows.sort((a, b) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at));
  // One row at a time so the trigger sees them strictly in order.
  for (const row of visitRows) {
    check((await db.from('visits').insert(row)).error, `insert visit (${row.date})`);
  }
  console.log(`✓ ${visitRows.length} visits`);

  // ---- 3. Site priority / last_visit: the export is the source of truth ---
  // A few sites had their priority set by hand in Base44 (e.g. Beaumont park
  // is "medium" although its latest visit was "low"). Re-apply the exported
  // values and report where they differ from what the visit trigger derived.
  const { data: derived, error: dErr } = await db.from('sites').select('id, slug, name, priority, last_visit');
  check(dErr, 'read sites');
  const bySlug = new Map(derived.map((s) => [s.slug, s]));
  const diffs = [];
  for (const s of data.sites) {
    const got = bySlug.get(s.id);
    const want = { priority: priority(s.priority), last_visit: date(s.last_visit) };
    if (got.priority !== want.priority || got.last_visit !== want.last_visit) {
      diffs.push(
        `  ${got.name}: visits gave ${got.priority ?? '—'} / ${got.last_visit ?? 'never'}, ` +
          `export says ${want.priority ?? '—'} / ${want.last_visit ?? 'never'}`,
      );
      check((await db.from('sites').update(want).eq('id', got.id)).error, `update site ${s.id}`);
    }
  }
  console.log(diffs.length ? `✓ site priorities restored from export:\n${diffs.join('\n')}` : '✓ site priorities match visits');

  // ---- 4. Stock -----------------------------------------------------------
  const stockRows = data.stock_items.map((i) => ({
    name: text(i.name).trim(),
    quantity: Math.max(0, Math.trunc(Number(i.quantity) || 0)),
    unit: text(i.unit),
    low_at: Math.max(0, Math.trunc(Number(i.low_at) || 0)),
    kept_at: text(i.kept_at),
    notes: text(i.notes),
  }));
  check((await db.from('stock_items').insert(stockRows)).error, 'insert stock');
  console.log(`✓ ${stockRows.length} stock items`);

  // ---- 5. Jobs (optional in the seed file) --------------------------------
  const jobRows = (data.jobs ?? []).map((j) => {
    const sid = siteId.get(j.site_id);
    if (!sid) {
      console.error(`✗ Job references unknown site slug "${j.site_id}"`);
      process.exit(1);
    }
    return { site_id: sid, text: text(j.text).trim(), done: Boolean(j.done), created_by: null };
  });
  if (jobRows.length) {
    check((await db.from('jobs').insert(jobRows)).error, 'insert jobs');
    console.log(`✓ ${jobRows.length} jobs`);
  }

  // ---- 6. Summary ---------------------------------------------------------
  const low = stockRows.filter((i) => i.low_at > 0 && i.quantity < i.low_at);
  console.log(
    `\nDone: ${await count('sites')} sites, ${await count('visits')} visits, ${await count('stock_items')} stock items.`,
  );
  console.log(`Low stock: ${low.map((i) => `${i.name} (${i.quantity}/${i.low_at})`).join(', ') || 'none'}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
