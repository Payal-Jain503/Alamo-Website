import { test } from 'node:test';
import assert from 'node:assert/strict';
import { quoteStay } from '../src/pricing.js';
import { HOMES } from '../src/server/homes.js';

const stay = { checkIn: '2026-11-18', checkOut: '2026-11-20', guests: 2 };
const home = (id: string) => HOMES.find((h) => h.id === id)!;

test('Invitation Oak charges the client’s rates, with the pet fee only when a pet comes', () => {
  const plan = home('san-antonio-3-bedroom').plan;
  const without = quoteStay(plan, stay, [], '2026-11-03');
  const withPet = quoteStay(plan, { ...stay, pets: 1 }, [], '2026-11-03');
  assert.ok(without.ok && withPet.ok);
  assert.equal(without.quote.nightsTotal, 35_000);
  assert.deepEqual(without.quote.fees.map((f) => f.amount), [15_000]);
  assert.deepEqual(withPet.quote.fees.map((f) => f.label), ['Cleaning fee', 'Pet fee']);
  assert.ok(withPet.quote.total > without.quote.total);
});

test('a home with no pet fee turns pets away', () => {
  const r = quoteStay(home('sitio-plains').plan, { ...stay, pets: 1 }, [], '2026-11-03');
  assert.equal(r.ok, false);
});

test('every home has a unique id', () => {
  assert.equal(new Set(HOMES.map((h) => h.id)).size, HOMES.length);
});
