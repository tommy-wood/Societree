#!/usr/bin/env node
// Pre-approved people (invites). LOCAL SUPABASE ONLY; needs an empty profiles table.
//
//   npm run test:invites

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

const { count } = await service.from('profiles').select('*', { count: 'exact', head: true });
if (count) {
  console.error(`Database already has ${count} profile(s); run \`npx supabase db reset\` first.`);
  process.exit(1);
}

const stamp = Date.now();
const email = (n) => `${n}${stamp}@example.test`;
async function signUp(name) {
  const c = createClient(url, publishable, opts);
  const { data, error } = await c.auth.signUp({ email: email(name), password: 'test-password-123', options: { data: { name } } });
  if (error) throw error;
  return { c, id: data.user.id };
}
const profile = async (id) => (await service.from('profiles').select('role, can_sign_off, name').eq('id', id).single()).data;
const rate = async (id) => (await service.from('contractor_rates').select('hourly_rate').eq('user_id', id).maybeSingle()).data?.hourly_rate;

const admin = await signUp('admin');
const adminInvite = await admin.c.from('invites').insert({ email: email('admin'), role: 'volunteer' });
ok(!adminInvite.error, 'admin can add someone to the pre-approved list');

const ins = await admin.c.from('invites').insert([
  { email: email('titus'), name: 'Titus', role: 'volunteer', can_sign_off: false, hourly_rate: 15 },
  { email: email('bethan'), name: 'Bethan', role: 'admin', can_sign_off: true, hourly_rate: null },
]);
if (ins.error) console.log('  insert error:', ins.error.message);
ok(!ins.error, 'admin pre-approves Titus (volunteer, £15/h) and Bethan (admin, signs off)');
const upper = await admin.c.from('invites').insert({ email: 'Ryan@Example.test' });
ok(!!upper.error, 'emails must be stored in lower case (the app lower-cases them)');

// Sign-up with an already-confirmed email (local Supabase auto-confirms).
const titus = await signUp('titus');
let p = await profile(titus.id);
ok(p.role === 'volunteer' && Number(await rate(titus.id)) === 15, 'Titus is approved with his £15 rate as soon as he signs up');
const used = (await admin.c.from('invites').select('used_at, used_by').eq('email', email('titus')).single()).data;
ok(!!used.used_at && used.used_by === titus.id, 'his invite is marked as used');

// Normal hosted case: the account exists unconfirmed, then the email is confirmed.
const { data: b } = await service.auth.admin.createUser({ email: email('bethan'), password: 'test-password-123', email_confirm: false, user_metadata: { name: 'Beth' } });
p = await profile(b.user.id);
ok(p.role === 'pending' && !p.can_sign_off, 'before confirming her email, Bethan has no access (an invite can’t be claimed without the inbox)');
await service.auth.admin.updateUserById(b.user.id, { email_confirm: true });
p = await profile(b.user.id);
ok(p.role === 'admin' && p.can_sign_off === true, 'after confirming, Bethan is an admin who signs off invoices');
ok(p.name === 'Beth', 'a name she typed herself is kept');

// Not on the list
const stranger = await signUp('stranger');
ok((await profile(stranger.id)).role === 'pending', 'someone not on the list still waits for approval');
const sees = await stranger.c.from('invites').select('email');
ok((sees.data ?? []).length === 0, 'pending users cannot see the list');
await admin.c.from('profiles').update({ role: 'volunteer' }).eq('id', stranger.id);
const volSees = await stranger.c.from('invites').select('email');
ok((volSees.data ?? []).length === 0, 'volunteers cannot see the list');
const volAdds = await stranger.c.from('invites').insert({ email: 'evil@example.test', role: 'admin' });
ok(!!volAdds.error, 'volunteers cannot add to the list');

// The first admin is never demoted by an invite
ok((await profile(admin.id)).role === 'admin', 'an invite never demotes an existing admin');

// Rpc not exposed
const rpc = await admin.c.rpc('apply_invite', { p_user: admin.id, p_email: email('admin') });
ok(!!rpc.error, 'the invite function cannot be called through the API');

for (const id of [admin.id, titus.id, b.user.id, stranger.id]) await service.auth.admin.deleteUser(id);
await service.from('invites').delete().like('email', `%${stamp}%`);
console.log(failures ? `\n${failures} check(s) failed` : '\nAll invite checks passed');
process.exit(failures ? 1 : 0);
