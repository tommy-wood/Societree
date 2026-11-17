#!/usr/bin/env node
// Row Level Security checks. LOCAL SUPABASE ONLY: it creates throwaway users
// and test rows. Run after `npx supabase start` and `npm run seed`:
//
//   npm run test:rls
//
// The first user created in a fresh database becomes admin, so run this
// against a freshly reset local DB (`npx supabase db reset` then seed).

import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const publishable = process.env.EXPO_PUBLIC_SUPABASE_KEY;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(url)) {
  console.error(`Refusing to run against ${url}: this script is for a local Supabase only.`);
  process.exit(1);
}
if (!publishable || !secret) {
  console.error('Set EXPO_PUBLIC_SUPABASE_KEY and SUPABASE_SECRET_KEY (from `npx supabase status`).');
  process.exit(1);
}

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(url, secret, opts);
let failures = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) failures++;
};

async function user(email) {
  const c = createClient(url, publishable, opts);
  const { data, error } = await c.auth.signUp({ email, password: 'test-password-123', options: { data: { name: email.split('@')[0] } } });
  if (error) throw error;
  return { c, id: data.user.id };
}

const { count: profileCount } = await service.from('profiles').select('*', { count: 'exact', head: true });
if (profileCount) {
  console.error(`Database already has ${profileCount} profile(s); run \`npx supabase db reset\` and seed first.`);
  process.exit(1);
}

const stamp = Date.now();
const admin = await user(`admin${stamp}@example.test`);
const vol = await user(`vol${stamp}@example.test`);
const anon = createClient(url, publishable, opts);

// profiles / roles
const { data: profs } = await service.from('profiles').select('id, role, name').in('id', [admin.id, vol.id]);
ok(profs.find((p) => p.id === admin.id)?.role === 'admin', 'first user becomes admin');
ok(profs.find((p) => p.id === vol.id)?.role === 'pending', 'second user starts as pending');
ok(profs.find((p) => p.id === vol.id)?.name === `vol${stamp}`, 'profile name taken from sign-up metadata');

// pending users see nothing until approved
const pendSites = await vol.c.from('sites').select('id');
ok(pendSites.data?.length === 0, 'pending user cannot read sites');
const pendProfiles = await vol.c.from('profiles').select('id');
ok(pendProfiles.data?.length === 1 && pendProfiles.data[0].id === vol.id, 'pending user can read only their own profile');
const pendVisit = await vol.c.from('visits').insert({ site_id: (await service.from('sites').select('id').limit(1).single()).data.id, work_carried_out: 'x' });
ok(!!pendVisit.error, 'pending user cannot log a visit');
const pendStock = await vol.c.from('stock_items').select('id');
ok(pendStock.data?.length === 0, 'pending user cannot read stock');
const adminSeesPending = await admin.c.from('profiles').select('id, role').eq('id', vol.id);
ok(adminSeesPending.data?.[0]?.role === 'pending', 'admin can see pending users');
const lastAdmin = await admin.c.from('profiles').update({ role: 'volunteer' }).eq('id', admin.id);
ok(!!lastAdmin.error, 'the last admin cannot demote themselves');
const approve = await admin.c.from('profiles').update({ role: 'volunteer' }).eq('id', vol.id).select();
ok(approve.data?.[0]?.role === 'volunteer', 'admin can approve a pending user as volunteer');

// legacy visit linking
const volLink = await vol.c.rpc('link_legacy_visits', { p_legacy_name: 'Beth Rose', p_profile_id: vol.id });
ok(!!volLink.error, 'volunteer cannot link old visits');
const adminLink = await admin.c.rpc('link_legacy_visits', { p_legacy_name: 'Beth Rose', p_profile_id: vol.id });
ok(adminLink.data === 2, `admin can link old visits to a profile (${adminLink.data} linked)`);
await service.from('visits').update({ logged_by: null }).eq('legacy_logged_by', 'Beth Rose');

const selfPromote = await vol.c.from('profiles').update({ role: 'admin' }).eq('id', vol.id);
ok(!!selfPromote.error, 'volunteer cannot make themselves admin');
const rename = await vol.c.from('profiles').update({ name: 'Vol Renamed' }).eq('id', vol.id).select();
ok(!rename.error && rename.data.length === 1, 'volunteer can change their own name');
const renameOther = await vol.c.from('profiles').update({ name: 'hacked' }).eq('id', admin.id).select();
ok(renameOther.data?.length === 0, "volunteer cannot change someone else's profile");

// reads
const anonSites = await anon.from('sites').select('id');
ok((anonSites.data ?? []).length === 0, 'signed-out users see no sites');
const volSites = await vol.c.from('sites').select('id, slug, priority, last_visit');
ok(volSites.data?.length === 22, `volunteer can read all sites (${volSites.data?.length})`);

// sites
const volAddSite = await vol.c.from('sites').insert({ name: 'Volunteer site' });
ok(!!volAddSite.error, 'volunteer cannot add a site');
const adminAddSite = await admin.c.from('sites').insert({ name: 'RLS test site' }).select().single();
ok(!adminAddSite.error, 'admin can add a site');
const testSite = adminAddSite.data;
const volLocate = await vol.c.from('sites').update({ lat: 50.3755, lng: -4.1427 }).eq('id', testSite.id).select();
ok(volLocate.data?.length === 1, 'volunteer can set a site location');

// visits + trigger
const v1 = await vol.c
  .from('visits')
  .insert({ site_id: testSite.id, date: '2026-11-10', priority_at_visit: 'urgent', work_carried_out: 'test', logged_by: vol.id })
  .select()
  .single();
ok(!v1.error, 'volunteer can log a visit');
let site = (await vol.c.from('sites').select('priority, last_visit').eq('id', testSite.id).single()).data;
ok(site.priority === 'urgent' && site.last_visit === '2026-11-10', 'new visit sets site priority and last_visit');

await vol.c.from('visits').insert({ site_id: testSite.id, date: '2026-11-01', priority_at_visit: 'low', work_carried_out: 'older', logged_by: vol.id });
site = (await vol.c.from('sites').select('priority, last_visit').eq('id', testSite.id).single()).data;
ok(site.priority === 'urgent' && site.last_visit === '2026-11-10', 'an older visit does not overwrite the site');

const spoof = await vol.c.from('visits').insert({ site_id: testSite.id, work_carried_out: 'spoof', logged_by: admin.id });
ok(!!spoof.error, 'volunteer cannot log a visit as someone else');
const dflt = await vol.c.from('visits').insert({ site_id: testSite.id, date: '2026-10-01', work_carried_out: 'default logged_by' }).select().single();
ok(dflt.data?.logged_by === vol.id, 'logged_by defaults to the signed-in user');

const volDel = await vol.c.from('visits').delete().eq('id', v1.data.id).select();
ok(volDel.data?.length === 0, 'volunteer cannot delete a visit');
const adminDel = await admin.c.from('visits').delete().eq('id', v1.data.id).select();
ok(adminDel.data?.length === 1, 'admin can delete a visit');
site = (await vol.c.from('sites').select('priority, last_visit').eq('id', testSite.id).single()).data;
ok(site.priority === 'low' && site.last_visit === '2026-11-01', 'deleting the newest visit recomputes the site');

// jobs
const job = await vol.c.from('jobs').insert({ site_id: testSite.id, text: 'Tighten fence' }).select().single();
ok(!job.error && job.data.created_by === vol.id, 'volunteer can add a job');
const tick = await admin.c.from('jobs').update({ done: true }).eq('id', job.data.id).select().single();
ok(tick.data?.completed_by === admin.id && !!tick.data?.completed_at, 'ticking a job records who and when');

// stock
const item = (await vol.c.from('stock_items').select('id, quantity').limit(1).single()).data;
const bump = await vol.c.from('stock_items').update({ quantity: item.quantity + 1 }).eq('id', item.id).select();
ok(bump.data?.length === 1, 'volunteer can change stock quantity');
const neg = await vol.c.from('stock_items').update({ quantity: -1 }).eq('id', item.id);
ok(!!neg.error, 'stock quantity cannot go negative');
const volStockDel = await vol.c.from('stock_items').delete().eq('id', item.id).select();
ok(volStockDel.data?.length === 0, 'volunteer cannot delete stock items');

// settings
const volSetting = await vol.c.from('app_settings').update({ value: 10 }).eq('key', 'overdue_days').select();
ok(volSetting.data?.length === 0, 'volunteer cannot change settings');
const overdue = await vol.c.from('app_settings').select('value').eq('key', 'overdue_days').single();
ok(overdue.data?.value === 35, 'overdue threshold setting is 35 days');

// internal function is not exposed
const rpc = await vol.c.rpc('recompute_site_from_visits', { p_site_id: testSite.id });
ok(!!rpc.error, 'internal recompute function is not callable via the API');

// storage
const path = `${dflt.data.id}/test.jpg`;
const up = await vol.c.storage.from('visit-photos').upload(path, new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' }));
ok(!up.error, `volunteer can upload a photo${up.error ? ` (${up.error.message})` : ''}`);
const photoRow = await vol.c.from('visit_photos').insert({ visit_id: dflt.data.id, storage_path: path }).select().single();
ok(!photoRow.error, 'volunteer can record the photo against the visit');
const anonPhoto = await anon.storage.from('visit-photos').download(path);
ok(!!anonPhoto.error, 'signed-out users cannot download photos');

// promote
const promote = await admin.c.from('profiles').update({ role: 'admin' }).eq('id', vol.id).select();
ok(promote.data?.[0]?.role === 'admin', 'admin can promote a volunteer');

// clean up test data (users cascade to profiles; test site cascades to visits/jobs/photo rows)
await service.storage.from('visit-photos').remove([path]);
await service.from('sites').delete().eq('id', testSite.id);
await service.from('stock_items').update({ quantity: item.quantity }).eq('id', item.id);
await service.auth.admin.deleteUser(admin.id);
await service.auth.admin.deleteUser(vol.id);

console.log(failures ? `\n${failures} check(s) failed` : '\nAll RLS checks passed');
process.exit(failures ? 1 : 0);
