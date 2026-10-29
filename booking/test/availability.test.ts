import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkAvailability, findDoubleBookings, nightMap } from '../src/availability.js';
import { parseFeed } from '../src/parseFeed.js';
import { block } from './helpers.js';

const stay = block({ start: '2026-11-02', end: '2026-11-06' });

test('check-out day is free for the next guest', () => {
  assert.equal(checkAvailability([stay], '2026-11-06', '2026-11-08').available, true);
});

test('a stay ending on the existing check-in day is free', () => {
  assert.equal(checkAvailability([stay], '2026-10-30', '2026-11-02').available, true);
});

test('any overlapping night makes the stay unavailable', () => {
  for (const [inDay, outDay] of [
    ['2026-11-05', '2026-11-07'],
    ['2026-11-01', '2026-11-03'],
    ['2026-11-03', '2026-11-04'],
    ['2026-10-30', '2026-11-10'],
  ] as const) {
    const result = checkAvailability([stay], inDay, outDay);
    assert.equal(result.available, false, `${inDay} to ${outDay}`);
    assert.deepEqual(result.conflicts, [stay]);
  }
});

test('nightMap lists only the nights in range', () => {
  const map = nightMap([stay], '2026-11-04', '2026-11-30');
  assert.deepEqual([...map.keys()], ['2026-11-04', '2026-11-05']);
});

test('a VRBO booking mirrored as an Airbnb block is not a double booking', () => {
  const vrbo = block({ source: 'vrbo', start: '2026-11-09', end: '2026-11-13' });
  const mirror = block({ source: 'airbnb', kind: 'blocked', start: '2026-11-09', end: '2026-11-13' });
  assert.deepEqual(findDoubleBookings([vrbo, mirror]), []);
});

test('guest reservations on two sites for the same night are flagged', () => {
  const a = block({ source: 'airbnb', start: '2026-12-18', end: '2026-12-20' });
  const v = block({ source: 'vrbo', start: '2026-12-19', end: '2026-12-23' });
  assert.deepEqual(findDoubleBookings([a, v]), [{ start: '2026-12-19', end: '2026-12-20', blocks: [a, v] }]);
});

test('back-to-back reservations on two sites are fine', () => {
  const a = block({ source: 'airbnb', start: '2026-12-18', end: '2026-12-20' });
  const v = block({ source: 'vrbo', start: '2026-12-20', end: '2026-12-23' });
  assert.deepEqual(findDoubleBookings([a, v]), []);
});

test('the sample calendars contain exactly one double booking', () => {
  const tz = 'America/Chicago';
  const blocks = [
    ...parseFeed(readFileSync('fixtures/airbnb-sample.ics', 'utf8'), 'airbnb', tz).blocks,
    ...parseFeed(readFileSync('fixtures/vrbo-sample.ics', 'utf8'), 'vrbo', tz).blocks,
  ];
  const found = findDoubleBookings(blocks);
  assert.equal(found.length, 1);
  assert.deepEqual([found[0]?.start, found[0]?.end], ['2026-12-19', '2026-12-20']);
});
