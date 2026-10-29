import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FeedFormatError, parseFeed } from '../src/parseFeed.js';
import { ics, vevent } from './helpers.js';

const TZ = 'America/Chicago';

test('reads the sample Airbnb export, telling reservations from blocks', () => {
  const { blocks, warnings } = parseFeed(readFileSync('fixtures/airbnb-sample.ics', 'utf8'), 'airbnb', TZ);
  assert.equal(blocks.length, 5);
  assert.deepEqual(warnings, []);
  assert.deepEqual(
    blocks.map((b) => [b.start, b.end, b.kind]),
    [
      ['2026-11-02', '2026-11-06', 'reservation'],
      ['2026-11-09', '2026-11-13', 'blocked'],
      ['2026-11-25', '2026-11-29', 'reservation'],
      ['2026-12-18', '2026-12-20', 'reservation'],
      ['2026-12-28', '2027-01-02', 'reservation'],
    ],
  );
});

test('reads the sample VRBO export', () => {
  const { blocks } = parseFeed(readFileSync('fixtures/vrbo-sample.ics', 'utf8'), 'vrbo', TZ);
  assert.deepEqual(
    blocks.map((b) => [b.start, b.end, b.kind]),
    [
      ['2026-11-09', '2026-11-13', 'reservation'],
      ['2026-11-20', '2026-11-22', 'blocked'],
      ['2026-12-19', '2026-12-23', 'reservation'],
    ],
  );
});

test('all-day dates do not shift with the server time zone', () => {
  const text = ics(vevent({ UID: 'a', 'DTSTART;VALUE=DATE': '20261105', 'DTEND;VALUE=DATE': '20261108', SUMMARY: 'Reserved' }));
  const [b] = parseFeed(text, 'airbnb', TZ).blocks;
  assert.equal(b?.start, '2026-11-05');
  assert.equal(b?.end, '2026-11-08');
});

test('timed events use the property time zone', () => {
  // 21:00 UTC on 10 Nov is 15:00 in San Antonio; 17:00 UTC on 12 Nov is 11:00.
  const text = ics(vevent({ UID: 'b', DTSTART: '20261110T210000Z', DTEND: '20261112T170000Z', SUMMARY: 'Booked' }));
  const [b] = parseFeed(text, 'other', TZ).blocks;
  assert.deepEqual([b?.start, b?.end], ['2026-11-10', '2026-11-12']);
});

test('a late-evening UTC start lands on the earlier local date', () => {
  // 02:00 UTC on 6 Nov is 20:00 on 5 Nov in Texas.
  const text = ics(vevent({ UID: 'c', DTSTART: '20261106T020000Z', DTEND: '20261108T170000Z', SUMMARY: 'Reserved' }));
  assert.equal(parseFeed(text, 'other', TZ).blocks[0]?.start, '2026-11-05');
});

test('an event with no end blocks one night', () => {
  const text = ics(vevent({ UID: 'd', 'DTSTART;VALUE=DATE': '20261201', SUMMARY: 'Blocked' }));
  assert.equal(parseFeed(text, 'vrbo', TZ).blocks[0]?.end, '2026-12-02');
});

test('cancelled events are ignored', () => {
  const text = ics(vevent({ UID: 'e', 'DTSTART;VALUE=DATE': '20261201', 'DTEND;VALUE=DATE': '20261203', STATUS: 'CANCELLED', SUMMARY: 'Reserved' }));
  assert.equal(parseFeed(text, 'vrbo', TZ).blocks.length, 0);
});

test('folded long lines are read correctly', () => {
  const text = ics(
    ['BEGIN:VEVENT', 'UID:f', 'DTSTART;VALUE=DATE:20261201', 'DTEND;VALUE=DATE:20261203', 'SUMMARY:Res', ' erved', 'END:VEVENT'].join('\r\n'),
  );
  const [b] = parseFeed(text, 'airbnb', TZ).blocks;
  assert.equal(b?.summary, 'Reserved');
  assert.equal(b?.kind, 'reservation');
});

test('a valid calendar with no events gives no blocks', () => {
  assert.deepEqual(parseFeed(ics(), 'airbnb', TZ).blocks, []);
});

test('an HTML error page is rejected instead of read as an empty calendar', () => {
  assert.throws(() => parseFeed('<html><body>Service unavailable</body></html>', 'airbnb', TZ), FeedFormatError);
});

test('a cut-off download is rejected', () => {
  const full = readFileSync('fixtures/airbnb-sample.ics', 'utf8');
  assert.throws(() => parseFeed(full.slice(0, full.length / 2), 'airbnb', TZ), FeedFormatError);
});
