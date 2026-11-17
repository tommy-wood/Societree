/// <reference types="node" />
// Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  addDaysISO,
  daysSince,
  directionsUrl,
  formatDate,
  isLowStock,
  isOverdue,
  isValidISODate,
  needsAttention,
  score,
  todayISO,
  visitedText,
} from './logic.ts';

const now = new Date(2026, 10, 17, 15, 30); // 17 Nov 2026, local time

test('daysSince counts whole local days', () => {
  assert.equal(daysSince('2026-11-17', now), 0);
  assert.equal(daysSince('2026-11-16', now), 1);
  assert.equal(daysSince('2026-10-13', now), 35);
  assert.equal(daysSince(null, now), null);
  assert.equal(daysSince('', now), null);
});

test('overdue after the threshold, or never visited', () => {
  assert.equal(isOverdue({ priority: 'low', last_visit: '2026-10-13' }, 35, now), false); // exactly 35 days
  assert.equal(isOverdue({ priority: 'low', last_visit: '2026-10-12' }, 35, now), true); // 36 days
  assert.equal(isOverdue({ priority: null, last_visit: null }, 35, now), true);
  assert.equal(isOverdue({ priority: 'low', last_visit: '2026-10-12' }, 60, now), false); // setting respected
});

test('score follows the brief', () => {
  // urgent, visited 26 days ago, not overdue, no jobs -> 300 + 2.6
  assert.equal(score({ priority: 'urgent', last_visit: '2026-10-22' }, 0, 35, now), 302.6);
  // medium + 2 open jobs, visited 12 days ago
  assert.equal(score({ priority: 'medium', last_visit: '2026-11-05' }, 2, 35, now), 221.2);
  // never visited: overdue 100 + 6 (capped)
  assert.equal(score({ priority: null, last_visit: null }, 0, 35, now), 106);
  // urgent beats medium beats overdue-only
  const u = score({ priority: 'urgent', last_visit: '2026-11-16' }, 0, 35, now);
  const m = score({ priority: 'medium', last_visit: '2026-11-10' }, 0, 35, now);
  const o = score({ priority: null, last_visit: null }, 0, 35, now);
  assert.ok(u > m && m > o);
});

test('needsAttention', () => {
  assert.equal(needsAttention({ priority: 'low', last_visit: '2026-11-10' }, 0, 35, now), false);
  assert.equal(needsAttention({ priority: 'low', last_visit: '2026-11-10' }, 1, 35, now), true);
  assert.equal(needsAttention({ priority: 'medium', last_visit: '2026-11-10' }, 0, 35, now), true);
  assert.equal(needsAttention({ priority: null, last_visit: null }, 0, 35, now), true);
});

test('low stock only when a threshold is set', () => {
  assert.equal(isLowStock({ quantity: 0, low_at: 12 }), true);
  assert.equal(isLowStock({ quantity: 2, low_at: 2 }), false);
  assert.equal(isLowStock({ quantity: 0, low_at: 0 }), false); // Biochar
});

test('dates', () => {
  assert.equal(todayISO(now), '2026-11-17');
  assert.equal(addDaysISO('2026-11-01', -1), '2026-10-31');
  assert.equal(formatDate('2026-11-05', now), '5 Nov');
  assert.equal(formatDate('2025-12-25', now), '25 Dec 2025');
  assert.equal(formatDate(null, now), 'never');
  assert.equal(visitedText('2026-11-16', now), 'Visited 16 Nov · yesterday');
  assert.equal(visitedText(null, now), 'Never visited');
  assert.equal(isValidISODate('2026-02-29'), false);
  assert.equal(isValidISODate('2026-11-17'), true);
  assert.equal(isValidISODate('17/11/2026'), false);
});

test('directions use GPS when known, otherwise name and address', () => {
  assert.match(directionsUrl({ name: 'Leigham', address: '', lat: null, lng: null }), /query=Leigham%20Plymouth$/);
  assert.match(directionsUrl({ name: 'X', address: '', lat: 50.4, lng: -4.1 }), /query=50\.4%2C-4\.1$/);
});
