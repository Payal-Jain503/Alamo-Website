import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildExportCalendar } from '../src/exportFeed.js';
import { parseFeed } from '../src/parseFeed.js';
import type { Property } from '../src/types.js';
import { block } from './helpers.js';

const property: Property = { id: 'sa-5br', name: 'San Antonio 5BR', timeZone: 'America/Chicago', feeds: [] };

test('exports direct bookings and owner blocks as all-day events', () => {
  const text = buildExportCalendar(property, [
    block({ source: 'direct', uid: 'AC-1001', start: '2026-11-14', end: '2026-11-17', summary: 'Jane Doe' }),
    block({ source: 'owner', kind: 'blocked', uid: 'OWN-1', start: '2026-11-20', end: '2026-11-21' }),
  ]);
  assert.match(text, /DTSTART;VALUE=DATE:20261114/);
  assert.match(text, /DTEND;VALUE=DATE:20261117/);
  assert.match(text, /DTSTART;VALUE=DATE:20261120/);
  assert.match(text, /UID:AC-1001@alamocityrental\.com/);
});

test('never exports imported Airbnb or VRBO dates, so calendars cannot echo', () => {
  const text = buildExportCalendar(property, [
    block({ source: 'airbnb', start: '2026-11-02', end: '2026-11-06' }),
    block({ source: 'vrbo', start: '2026-11-09', end: '2026-11-13' }),
  ]);
  assert.doesNotMatch(text, /BEGIN:VEVENT/);
});

test('guest names never appear in the exported calendar', () => {
  const text = buildExportCalendar(property, [
    block({ source: 'direct', uid: 'AC-1002', start: '2026-11-14', end: '2026-11-17', summary: 'Jane Doe' }),
  ]);
  assert.doesNotMatch(text, /Jane/);
  assert.match(text, /SUMMARY:Reserved/);
});

test('our export reads back to the same dates', () => {
  const original = block({ source: 'direct', uid: 'AC-1003', start: '2026-12-30', end: '2027-01-02' });
  const text = buildExportCalendar(property, [original]);
  const [read] = parseFeed(text, 'direct', property.timeZone).blocks;
  assert.deepEqual([read?.start, read?.end, read?.kind], [original.start, original.end, 'reservation']);
});
