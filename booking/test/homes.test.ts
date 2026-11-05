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

test('each home pays its own occupancy tax, and 30-night stays pay none', () => {
  const rate = (id: string) => home(id).plan.taxes.reduce((s, t) => s + t.rateBps, 0);
  assert.equal(rate('crimson'), 1700);
  assert.equal(rate('oat-st'), 1700);
  assert.equal(rate('rolling'), 600);
  assert.equal(rate('grey-woodpecker'), 800);
  assert.deepEqual(home('oat-st').plan.taxes.map((t) => t.rateBps), [600, 400, 700]);
  const long = quoteStay(home('amber-crest').plan, { checkIn: '2026-12-01', checkOut: '2026-12-31', guests: 2 }, [], '2026-11-03');
  assert.ok(long.ok);
  assert.deepEqual(long.quote.taxes, []);
});

test('21630 Longwood has its cleaning, guest and pet fees', () => {
  const p = home('21630-longwood').plan;
  assert.equal(p.cleaningFee, 16_000);
  assert.equal(p.includedGuests, 10);
  assert.equal(p.extraGuestNightly, 1_500);
  assert.equal(p.petFee, 5_000);
});

test('Austin Burton includes 4 guests, then charges $50 per extra guest', () => {
  const p = home('austin-burton').plan;
  assert.equal(p.includedGuests, 4);
  assert.equal(p.extraGuestNightly, 5_000);
});

test('max guests follows the client list and never drops below included guests', () => {
  const all = HOMES;
  for (const h of all) assert.ok(h.plan.maxGuests >= h.plan.includedGuests, h.id);
  assert.equal(HOMES.find((h) => h.id === 'austin-burton')!.plan.maxGuests, 4);
  assert.equal(HOMES.find((h) => h.id === 'longhorn-creek')!.plan.maxGuests, 7);
  assert.equal(HOMES.find((h) => h.id === 'amber-crest')!.plan.maxGuests, 11);
});

test('clay oak charges $25 per extra guest and allows 16', () => {
  const h = HOMES.find((x) => x.id === 'clay-oak')!;
  assert.equal(h.plan.extraGuestNightly, 2_500);
  assert.equal(h.plan.maxGuests, 16);
});
