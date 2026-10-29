import { test } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryNightStore, isFree } from '../src/holds.js';

const now = new Date('2026-10-29T15:00:00Z');
const in15 = new Date(now.getTime() + 15 * 60_000);

test('50 guests racing for the same dates: exactly one gets them', async () => {
  const store = new InMemoryNightStore();
  const results = await Promise.all(
    Array.from({ length: 50 }, (_, i) => store.claim('sa-5br', '2026-12-18', '2026-12-21', `h_${i}`, in15, now)),
  );
  assert.equal(results.filter((r) => r.ok).length, 1);
  const winner = results.findIndex((r) => r.ok);
  for (const n of ['2026-12-18', '2026-12-19', '2026-12-20']) assert.equal((await store.get('sa-5br', n))?.holdId, `h_${winner}`);
});

test('overlapping stays race too: one wins, the other gets nothing', async () => {
  const store = new InMemoryNightStore();
  const [a, b] = await Promise.all([
    store.claim('sa-5br', '2026-12-18', '2026-12-21', 'h_a', in15, now),
    store.claim('sa-5br', '2026-12-20', '2026-12-23', 'h_b', in15, now),
  ]);
  assert.equal(a.ok, true);
  assert.deepEqual(b, { ok: false, takenNights: ['2026-12-20'] });
  // All or nothing: the loser left no nights behind.
  assert.equal(await store.get('sa-5br', '2026-12-21'), undefined);
  assert.equal(await store.get('sa-5br', '2026-12-22'), undefined);
});

test('check-out day can be claimed by the next guest, and other homes are separate', async () => {
  const store = new InMemoryNightStore();
  assert.ok((await store.claim('sa-5br', '2026-12-18', '2026-12-21', 'h_a', in15, now)).ok);
  assert.ok((await store.claim('sa-5br', '2026-12-21', '2026-12-23', 'h_b', in15, now)).ok);
  assert.ok((await store.claim('houston-5br', '2026-12-18', '2026-12-21', 'h_c', in15, now)).ok);
});

test('an expired hold frees its nights, but a booking never expires', async () => {
  const store = new InMemoryNightStore();
  await store.claim('sa-5br', '2026-12-18', '2026-12-21', 'h_a', in15, now);
  const later = new Date(in15.getTime() + 1);
  assert.equal((await store.claim('sa-5br', '2026-12-18', '2026-12-21', 'h_b', in15, now)).ok, false);
  assert.equal((await store.claim('sa-5br', '2026-12-18', '2026-12-21', 'h_b', new Date(later.getTime() + 900_000), later)).ok, true);

  await store.confirm('sa-5br', '2026-12-18', '2026-12-21', 'h_b', 'AC-1');
  const muchLater = new Date('2027-06-01T00:00:00Z');
  assert.equal((await store.claim('sa-5br', '2026-12-18', '2026-12-21', 'h_c', muchLater, muchLater)).ok, false);
  assert.equal(isFree(await store.get('sa-5br', '2026-12-19'), muchLater), false);
});

test('confirm needs every night to still belong to the hold', async () => {
  const store = new InMemoryNightStore();
  await store.claim('sa-5br', '2026-12-18', '2026-12-21', 'h_a', in15, now);
  assert.equal(await store.confirm('sa-5br', '2026-12-18', '2026-12-21', 'h_other', 'AC-X'), false);
  // Late but untouched: still confirms.
  assert.equal(await store.confirm('sa-5br', '2026-12-18', '2026-12-21', 'h_a', 'AC-A'), true);
  assert.deepEqual(await store.get('sa-5br', '2026-12-18'), { status: 'booked', holdId: 'h_a', bookingId: 'AC-A' });

  // Expired and taken by someone else: refused.
  await store.claim('sa-5br', '2027-01-04', '2027-01-06', 'h_b', in15, now);
  const later = new Date(in15.getTime() + 60_000);
  await store.claim('sa-5br', '2027-01-05', '2027-01-07', 'h_c', new Date(later.getTime() + 900_000), later);
  assert.equal(await store.confirm('sa-5br', '2027-01-04', '2027-01-06', 'h_b', 'AC-B'), false);
});

test('release only frees nights owned by that hold', async () => {
  const store = new InMemoryNightStore();
  await store.claim('sa-5br', '2026-12-18', '2026-12-21', 'h_a', in15, now);
  await store.release('sa-5br', '2026-12-18', '2026-12-21', 'h_b');
  assert.equal((await store.get('sa-5br', '2026-12-18'))?.holdId, 'h_a');
  await store.release('sa-5br', '2026-12-18', '2026-12-21', 'h_a');
  assert.equal(await store.get('sa-5br', '2026-12-18'), undefined);
});
