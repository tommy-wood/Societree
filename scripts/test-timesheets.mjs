#!/usr/bin/env node
// Timesheet and invoice rules. LOCAL SUPABASE ONLY (creates and deletes test
// users). Needs an empty profiles table, like test-rls.mjs:
//
//   npm run test:timesheets

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
async function user(name) {
  const c = createClient(url, publishable, opts);
  const { data, error } = await c.auth.signUp({ email: `${name}${stamp}@example.test`, password: 'test-password-123', options: { data: { name } } });
  if (error) throw error;
  return { c, id: data.user.id };
}
const tommy = await user('Tommy'); // first user: admin, also a contractor
const titus = await user('Titus');
const bethan = await user('Bethan');
const vol = await user('Volunteer');
for (const u of [titus, bethan, vol]) await tommy.c.from('profiles').update({ role: 'volunteer' }).eq('id', u.id);

// Only admins can choose who signs off invoices.
const selfSignOff = await bethan.c.from('profiles').update({ can_sign_off: true }).eq('id', bethan.id);
ok(!!selfSignOff.error, 'a volunteer cannot make themselves a sign-off person');
const makeFinance = await tommy.c.from('profiles').update({ can_sign_off: true }).eq('id', bethan.id).select();
ok(makeFinance.data?.[0]?.can_sign_off === true, 'admin can make Bethan the sign-off person');

// Rates
const volRate = await vol.c.from('contractor_rates').insert({ user_id: vol.id, hourly_rate: 99 });
ok(!!volRate.error, 'a volunteer cannot set a rate');
const setRates = await tommy.c.from('contractor_rates').insert([
  { user_id: tommy.id, hourly_rate: 17 },
  { user_id: titus.id, hourly_rate: 15 },
]);
ok(!setRates.error, 'admin can set hourly rates');
const titusRaise = await titus.c.from('contractor_rates').update({ hourly_rate: 50 }).eq('user_id', titus.id).select();
ok((titusRaise.data ?? []).length === 0, 'a contractor cannot change their own rate');
const titusSeesRates = await titus.c.from('contractor_rates').select('user_id, hourly_rate');
ok(titusSeesRates.data?.length === 1 && Number(titusSeesRates.data[0].hourly_rate) === 15, 'a contractor sees only their own rate');
const bethanRate = await bethan.c.from('contractor_rates').update({ hourly_rate: 15.5 }).eq('user_id', titus.id).select();
ok(Number(bethanRate.data?.[0]?.hourly_rate) === 15.5, 'the sign-off person can change a rate');
await bethan.c.from('contractor_rates').update({ hourly_rate: 15 }).eq('user_id', titus.id);

// Days and materials (in a past month so the test doesn't depend on today's date)
const month = '2026-10-01';
const d1 = await titus.c.from('work_days').insert({ date: '2026-10-06', hours: 7.5, miles: 12, description: 'Leigham, Plaistow' }).select().single();
await titus.c.from('work_days').insert({ date: '2026-10-07', hours: 6, miles: 0, description: 'Sherford' });
ok(!d1.error && d1.data.user_id === titus.id, 'a contractor can add a day (user filled in automatically)');
const dup = await titus.c.from('work_days').insert({ date: '2026-10-06', hours: 1 });
ok(!!dup.error, 'only one entry per person per day');
const forOther = await titus.c.from('work_days').insert({ user_id: tommy.id, date: '2026-10-06', hours: 8 });
ok(!!forOther.error, 'a contractor cannot add hours for someone else');
const tooMany = await titus.c.from('work_days').insert({ date: '2026-10-08', hours: 25 });
ok(!!tooMany.error, 'hours must be between 0 and 24');
const mat = await titus.c.from('expenses').insert({ date: '2026-10-07', description: 'Tree ties', amount: 23.4 }).select().single();
ok(!mat.error, 'a contractor can add materials');
await tommy.c.from('work_days').insert({ date: '2026-10-06', hours: 8, miles: 30, description: 'Leigham' });

const tommySeesTitus = await tommy.c.from('work_days').select('id').eq('user_id', titus.id);
ok(tommySeesTitus.data?.length === 0, 'an admin who does not sign off cannot see other people’s hours');
const volSees = await vol.c.from('work_days').select('id');
ok(volSees.data?.length === 0, 'a volunteer cannot see anyone’s hours');
const bethanSees = await bethan.c.from('work_days').select('id');
ok(bethanSees.data?.length === 3, 'the sign-off person sees everyone’s hours');

// Private details
await titus.c.from('contractor_details').insert({ invoice_name: 'Titus Jones', address: '1 Oak Lane, Plymouth', bank_sort_code: '12-34-56', bank_account_number: '12345678' });
const adminDetails = await tommy.c.from('contractor_details').select('*').eq('user_id', titus.id);
ok(adminDetails.data?.length === 0, 'an admin cannot see someone’s bank details');
const bethanDetails = await bethan.c.from('contractor_details').select('bank_sort_code').eq('user_id', titus.id);
ok(bethanDetails.data?.[0]?.bank_sort_code === '12-34-56', 'the sign-off person can see bank details');
const editOthers = await tommy.c.from('contractor_details').update({ bank_account_number: '99999999' }).eq('user_id', titus.id).select();
ok((editOthers.data ?? []).length === 0, 'nobody else can change someone’s bank details');

// Submit
const nothing = await vol.c.rpc('submit_invoice', { p_month: month });
ok(!!nothing.error, 'cannot invoice without a rate');
const future = await titus.c.rpc('submit_invoice', { p_month: '2099-01-01' });
ok(!!future.error, 'cannot invoice a future month');
const sub = await titus.c.rpc('submit_invoice', { p_month: month });
ok(!sub.error, `Titus can send his October invoice${sub.error ? ` (${sub.error.message})` : ''}`);
let inv = (await titus.c.from('invoices').select('*').eq('id', sub.data).single()).data;
ok(
  Number(inv.hours) === 13.5 && Number(inv.labour_total) === 202.5 && Number(inv.mileage_total) === 5.4 && Number(inv.materials_total) === 23.4 && Number(inv.total) === 231.3,
  `totals: 13.5 h × £15 + 12 mi × 45p + £23.40 materials = £${inv.total}`,
);
ok(inv.contractor.bank_sort_code === '12-34-56' && inv.contractor.name === 'Titus Jones', 'invoice includes his details');
ok(inv.lines.days.length === 2 && inv.lines.materials.length === 1, 'invoice lists his days and materials');
const again = await titus.c.rpc('submit_invoice', { p_month: month });
ok(!!again.error, 'cannot send the same month twice');
const tommyCantSee = await tommy.c.from('invoices').select('id');
ok(tommyCantSee.data?.length === 0, 'other contractors cannot see Titus’s invoice');

// Locked month
const editLocked = await titus.c.from('work_days').update({ hours: 10 }).eq('id', d1.data.id);
ok(!!editLocked.error, 'an invoiced month cannot be edited');
const addLocked = await titus.c.from('work_days').insert({ date: '2026-10-20', hours: 4 });
ok(!!addLocked.error, 'no new days can be added to an invoiced month');
const otherMonth = await titus.c.from('work_days').insert({ date: '2026-11-02', hours: 4 });
ok(!otherMonth.error, 'other months stay open');
const directEdit = await titus.c.from('invoices').update({ total: 9999 }).eq('id', inv.id).select();
ok((directEdit.data ?? []).length === 0, 'nobody can edit an invoice’s figures directly');

// Review
const titusApproves = await titus.c.rpc('review_invoice', { p_id: inv.id, p_action: 'approve' });
ok(!!titusApproves.error, 'a contractor cannot sign off an invoice');
const noReason = await bethan.c.rpc('review_invoice', { p_id: inv.id, p_action: 'return', p_reason: ' ' });
ok(!!noReason.error, 'sending back needs a reason');
const ret = await bethan.c.rpc('review_invoice', { p_id: inv.id, p_action: 'return', p_reason: 'The 7th was 6.5 hours' });
ok(!ret.error, 'Bethan can send it back with a note');
const fix = await titus.c.from('work_days').update({ hours: 6.5 }).eq('date', '2026-10-07').select();
ok(fix.data?.length === 1, 'once sent back, the month can be corrected');
const resub = await titus.c.rpc('submit_invoice', { p_month: month });
const inv2 = (await titus.c.from('invoices').select('*').eq('id', resub.data).single()).data;
ok(inv2.number === inv.number && Number(inv2.total) === 238.8 && inv2.status === 'submitted', `resent with the same number (${inv2.number}) and new total £${inv2.total}`);
const paidEarly = await bethan.c.rpc('review_invoice', { p_id: inv.id, p_action: 'paid' });
ok(!!paidEarly.error, 'cannot mark as paid before it is signed off');
const approve = await bethan.c.rpc('review_invoice', { p_id: inv.id, p_action: 'approve' });
ok(!approve.error, 'Bethan can sign it off');
const withdraw = await titus.c.rpc('withdraw_invoice', { p_id: inv.id });
ok(!!withdraw.error, 'a signed-off invoice cannot be taken back by the contractor');
const paid = await bethan.c.rpc('review_invoice', { p_id: inv.id, p_action: 'paid' });
inv = (await bethan.c.from('invoices').select('status, approved_by, paid_at').eq('id', inv.id).single()).data;
ok(!paid.error && inv.status === 'paid' && inv.approved_by === bethan.id && !!inv.paid_at, 'Bethan can mark it paid');

// Withdraw (Tommy's own invoice)
const tSub = await tommy.c.rpc('submit_invoice', { p_month: month });
const tW = await tommy.c.rpc('withdraw_invoice', { p_id: tSub.data });
const tInv = (await tommy.c.from('invoices').select('status, total').eq('id', tSub.data).single()).data;
ok(!tW.error && tInv.status === 'returned' && Number(tInv.total) === 149.5, `Tommy (8 h × £17 + 30 mi × 45p = £${tInv.total}) can take back an unsigned invoice`);

// Receipts
const jpeg = new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' });
const up = await titus.c.storage.from('receipts').upload(`${titus.id}/r1.jpg`, jpeg);
ok(!up.error, 'a contractor can upload a receipt to their own folder');
const upOther = await titus.c.storage.from('receipts').upload(`${tommy.id}/r1.jpg`, jpeg);
ok(!!upOther.error, 'nobody can upload into someone else’s receipts');
const bethanDl = await bethan.c.storage.from('receipts').download(`${titus.id}/r1.jpg`);
ok(!bethanDl.error, 'the sign-off person can open receipts');
const volDl = await vol.c.storage.from('receipts').download(`${titus.id}/r1.jpg`);
ok(!!volDl.error, 'others cannot open receipts');

// Clean up
await service.storage.from('receipts').remove([`${titus.id}/r1.jpg`]);
for (const u of [titus, bethan, vol, tommy]) await service.auth.admin.deleteUser(u.id);

console.log(failures ? `\n${failures} check(s) failed` : '\nAll timesheet checks passed');
process.exit(failures ? 1 : 0);
