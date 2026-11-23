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

test('austin burton cleaning fee is $120 and pet fee $50', () => {
  const h = HOMES.find((x) => x.id === 'austin-burton')!;
  assert.equal(h.plan.cleaningFee, 12_000);
  assert.equal(h.plan.petFee, 5_000);
});

test('the $1 payment-test home charges exactly $1.00 a night, with no fees or tax', () => {
  const r = quoteStay(home('test-one-dollar').plan, { checkIn: '2026-12-01', checkOut: '2026-12-02', guests: 2 }, [], '2026-11-17');
  assert.ok(r.ok);
  assert.equal(r.quote.total, 100);
  assert.deepEqual(r.quote.fees, []);
  assert.deepEqual(r.quote.taxes, []);
});

test('mid-term homes charge exactly their monthly price for 30 nights, and a fair share for longer stays', () => {
  const thirty = { checkIn: '2027-01-10', checkOut: '2027-02-09', guests: 2 };
  for (const [id, monthly] of [['almadin', 550_000], ['amber-crest', 440_000], ['austin-burton', 260_000], ['clay-oak', 540_000]] as const) {
    const q = quoteStay(home(id).plan, thirty, [], '2026-11-20');
    assert.ok(q.ok, id);
    assert.equal(q.quote.nightsTotal, monthly, id);
    assert.equal(q.quote.nights.reduce((s, n) => s + n.nightly, 0), monthly, id);
  }
  const fortyFive = quoteStay(home('almadin').plan, { ...thirty, checkOut: '2027-02-24' }, [], '2026-11-20');
  assert.ok(fortyFive.ok);
  assert.equal(fortyFive.quote.nightsTotal, 825_000);
});

test('the pet fee is taxed like the rest of the stay', () => {
  const q = quoteStay(home('hideaway').plan, { checkIn: '2027-01-12', checkOut: '2027-01-14', guests: 2, pets: 1 }, [], '2026-11-20');
  assert.ok(q.ok);
  // $562 nights + $180 cleaning + $50 pet = $792, taxed at 6% + 2% + 9%.
  assert.deepEqual(q.quote.taxes.map((t) => t.amount), [4_752, 1_584, 7_128]);
});

test('homes with placeholder rates cannot be quoted or booked online until the client confirms real fees', async () => {
  const { BookingService, InMemoryFeedStore } = await import('../src/server/service.js');
  const { InMemoryHoldRepository } = await import('../src/checkout.js');
  const { InMemoryNightStore } = await import('../src/holds.js');
  const paused = ['colt-river', 'pendant-pass-theater', 'westmark-azim', 'southern-knoll'];
  for (const id of paused) assert.equal(home(id).onlineBooking, false, id);
  assert.equal(HOMES.filter((h) => h.onlineBooking === false).length, paused.length);
  const svc = new BookingService({
    homes: HOMES,
    nights: new InMemoryNightStore(),
    holds: new InMemoryHoldRepository(),
    feeds: new InMemoryFeedStore(),
    payments: { authorize: async () => ({ paymentId: 'p', clientSecret: 'c' }), capture: async () => {}, cancel: async () => {}, refund: async () => {}, authorizedAmount: async () => undefined },
    alerts: { send: async () => {} },
    secrets: { quoteSecret: 'quote-secret-that-is-long-enough-12345', exportSecret: 'x', feedUrls: {} },
    now: () => new Date('2026-11-20T12:00:00Z'),
  });
  const q = await svc.quote({ homeId: 'colt-river', checkIn: '2027-01-12', checkOut: '2027-01-14', guests: 2 });
  assert.equal(q.status, 422);
  assert.deepEqual((q.body as { error: string }).error, 'online-booking-off');
  const avail = await svc.availability('colt-river');
  assert.equal(avail.status, 200);
  assert.equal((avail.body as { bookable?: boolean }).bookable, false);
  assert.equal(((await svc.availability('hideaway')).body as { bookable?: boolean }).bookable, undefined);
  assert.equal((await svc.reserve({ signed: { homeId: 'colt-river', quote: {} } as never, guest: { name: 'A', email: 'a@b.co' } })).status, 409);
});
