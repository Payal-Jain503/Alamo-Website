import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyFeedResult, emptyState, syncProperty, type FeedState } from '../src/sync.js';
import type { Property } from '../src/types.js';
import { block } from './helpers.js';

const now = new Date('2026-10-29T12:00:00Z');
const today = '2026-10-29';

function stateWith(...blocks: ReturnType<typeof block>[]): FeedState {
  return { ...emptyState('airbnb'), blocks, lastSuccessAt: '2026-10-29T11:50:00Z' };
}

test('a new reservation is added', () => {
  const nov = block({ start: '2026-11-02', end: '2026-11-06' });
  const out = applyFeedResult(emptyState('airbnb'), { ok: true, blocks: [nov] }, now, today);
  assert.equal(out.status, 'updated');
  assert.deepEqual(out.added, [nov]);
  assert.deepEqual(out.state.blocks, [nov]);
});

test('a cancellation removes its dates on the next read', () => {
  const a = block({ start: '2026-11-02', end: '2026-11-06' });
  const b = block({ start: '2026-11-20', end: '2026-11-22' });
  const out = applyFeedResult(stateWith(a, b), { ok: true, blocks: [a] }, now, today);
  assert.deepEqual(out.removed, [b]);
  assert.deepEqual(out.state.blocks, [a]);
});

test('changed dates count as one removal and one addition', () => {
  const before = block({ uid: 'r1', start: '2026-11-02', end: '2026-11-06' });
  const after = block({ uid: 'r1', start: '2026-11-03', end: '2026-11-07' });
  const out = applyFeedResult(stateWith(before), { ok: true, blocks: [after] }, now, today);
  assert.deepEqual([out.added, out.removed], [[after], [before]]);
});

test('a failed read keeps every booked date', () => {
  const a = block({ start: '2026-11-02', end: '2026-11-06' });
  const out = applyFeedResult(stateWith(a), { ok: false, error: 'HTTP 503' }, now, today);
  assert.equal(out.status, 'kept-after-error');
  assert.deepEqual(out.state.blocks, [a]);
  assert.equal(out.state.consecutiveFailures, 1);
  assert.equal(out.alert, false);
});

test('the owner is alerted after 3 failures in a row, and the counter resets on success', () => {
  let state = stateWith(block({ start: '2026-11-02', end: '2026-11-06' }));
  const alerts: boolean[] = [];
  for (let i = 0; i < 3; i++) {
    const out = applyFeedResult(state, { ok: false, error: 'timeout' }, now, today);
    alerts.push(out.alert);
    state = out.state;
  }
  assert.deepEqual(alerts, [false, false, true]);
  const ok = applyFeedResult(state, { ok: true, blocks: state.blocks }, now, today);
  assert.equal(ok.state.consecutiveFailures, 0);
});

test('a sudden empty calendar is not believed until it happens twice', () => {
  const a = block({ start: '2026-11-02', end: '2026-11-06' });
  const first = applyFeedResult(stateWith(a), { ok: true, blocks: [] }, now, today);
  assert.equal(first.status, 'kept-suspicious-empty');
  assert.deepEqual(first.state.blocks, [a]);

  const second = applyFeedResult(first.state, { ok: true, blocks: [] }, now, today);
  assert.equal(second.status, 'updated');
  assert.deepEqual(second.state.blocks, []);
  assert.deepEqual(second.removed, [a]);
});

test('past stays dropping off the feed are not treated as a suspicious empty', () => {
  const past = block({ start: '2026-10-01', end: '2026-10-05' });
  const out = applyFeedResult(stateWith(past), { ok: true, blocks: [] }, now, today);
  assert.equal(out.status, 'updated');
});

test('syncProperty reads every feed and survives one of them failing', async () => {
  const files: Record<string, string> = {
    'https://example.test/airbnb.ics': readFileSync('fixtures/airbnb-sample.ics', 'utf8'),
  };
  const fetchImpl = (async (url: string) =>
    files[url] ? new Response(files[url]) : new Response('Gateway timeout', { status: 504 })) as typeof fetch;

  const property: Property = {
    id: 'sa-5br',
    name: 'San Antonio 5BR',
    timeZone: 'America/Chicago',
    feeds: [
      { source: 'airbnb', url: 'https://example.test/airbnb.ics' },
      { source: 'vrbo', url: 'https://example.test/vrbo.ics' },
    ],
  };
  const vrboBefore = { ...emptyState('vrbo'), blocks: [block({ source: 'vrbo', start: '2026-11-09', end: '2026-11-13' })] };

  const [airbnb, vrbo] = await syncProperty(property, { vrbo: vrboBefore }, { fetchImpl, now });
  assert.equal(airbnb?.status, 'updated');
  assert.equal(airbnb?.state.blocks.length, 5);
  assert.equal(vrbo?.status, 'kept-after-error');
  assert.equal(vrbo?.state.lastError, 'HTTP 504');
  assert.deepEqual(vrbo?.state.blocks, vrboBefore.blocks);
});

test('an HTML page served with status 200 is treated as a failure', async () => {
  const fetchImpl = (async () => new Response('<html>Please log in</html>')) as unknown as typeof fetch;
  const property: Property = { id: 'p', name: 'P', timeZone: 'America/Chicago', feeds: [{ source: 'airbnb', url: 'https://x.test/a.ics' }] };
  const [out] = await syncProperty(property, { airbnb: stateWith(block({ start: '2026-11-02', end: '2026-11-06' })) }, { fetchImpl, now });
  assert.equal(out?.status, 'kept-after-error');
  assert.equal(out?.state.blocks.length, 1);
});
