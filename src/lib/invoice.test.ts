/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { addMonths, dayLabel, gbp, invoiceHtml, invoiceTotals, lastDayOfMonth, monthLabel, monthOf } from './invoice.ts';

test('totals match the database rules', () => {
  const days = [
    { date: '2026-10-06', hours: 7.5, miles: 12, description: 'Leigham' },
    { date: '2026-10-07', hours: 6, miles: 0, description: 'Sherford' },
  ];
  const t = invoiceTotals(days, [{ date: '2026-10-07', description: 'Tree ties', amount: 23.4 }], 15, 0.45);
  assert.deepEqual(t, { hours: 13.5, labour: 202.5, miles: 12, mileage: 5.4, materials: 23.4, total: 231.3 });
  assert.equal(invoiceTotals([{ date: '2026-10-06', hours: 8, miles: 30, description: '' }], [], 17).total, 149.5);
  assert.equal(invoiceTotals([], [], 15).total, 0);
});

test('money and months', () => {
  assert.equal(gbp(1234.5), '£1,234.50');
  assert.equal(monthOf('2026-11-17'), '2026-11-01');
  assert.equal(addMonths('2026-01-01', -1), '2025-12-01');
  assert.equal(addMonths('2026-12-01', 1), '2027-01-01');
  assert.equal(monthLabel('2026-11-01'), 'November 2026');
  assert.equal(lastDayOfMonth('2026-02-01'), '2026-02-28');
  assert.equal(dayLabel('2026-11-06'), 'Fri 6 Nov');
});

test('invoice html escapes text and hides empty bank details', () => {
  const html = invoiceHtml({
    number: 'INV-1001',
    month: '2026-10-01',
    issued: '2026-11-01',
    to: 'Societree',
    contractor: { name: 'A <b>', address: '', phone: '', email: '', bank_account_name: '', bank_sort_code: '', bank_account_number: '' },
    hourlyRate: 15,
    mileageRate: 0.45,
    days: [{ date: '2026-10-06', hours: 7.5, miles: 12, description: 'Weeding & <mulch>' }],
    materials: [],
    totals: invoiceTotals([{ date: '2026-10-06', hours: 7.5, miles: 12, description: '' }], [], 15),
  });
  assert.ok(html.includes('A &lt;b&gt;') && html.includes('Weeding &amp; &lt;mulch&gt;'));
  assert.ok(!html.includes('Payment to'));
  assert.ok(html.includes('£117.90') && html.includes('No VAT charged.'));
});
