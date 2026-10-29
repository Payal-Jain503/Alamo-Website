import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatUsd, priceNight, quoteStay, type RatePlan } from '../src/pricing.js';
import { block } from './helpers.js';

// Example rates only. Real lodging tax rates are confirmed with the client's accountant.
const plan: RatePlan = {
  baseNightly: 25_000,
  weekendNightly: 32_000,
  minStay: 2,
  maxNights: 60,
  minNoticeDays: 1,
  bookingWindowDays: 540,
  cleaningFee: 17_500,
  petFee: 7_500,
  maxGuests: 12,
  includedGuests: 10,
  extraGuestNightly: 2_000,
  taxes: [
    { name: 'Texas hotel occupancy tax (6%)', rateBps: 600, appliesTo: ['nights', 'cleaning', 'extraGuests'] },
    { name: 'City hotel occupancy tax (example 9%)', rateBps: 900, appliesTo: ['nights', 'cleaning', 'extraGuests'] },
  ],
};

const today = '2026-10-29'; // Thursday

test('weeknights use the base rate and Friday and Saturday use the weekend rate', () => {
  assert.equal(priceNight(plan, '2026-11-05').nightly, 25_000); // Thu
  assert.equal(priceNight(plan, '2026-11-06').nightly, 32_000); // Fri
  assert.equal(priceNight(plan, '2026-11-07').nightly, 32_000); // Sat
  assert.equal(priceNight(plan, '2026-11-08').nightly, 25_000); // Sun
});

test('seasons and synced PriceLabs prices take over, in that order', () => {
  const p: RatePlan = {
    ...plan,
    seasons: [
      { start: '2026-12-18', end: '2027-01-03', nightly: 40_000, weekendNightly: 45_000, minStay: 4, label: 'Holidays' },
      { start: '2026-12-31', end: '2027-01-01', nightly: 60_000, minStay: 3, label: 'New Year' },
    ],
    nightlyOverrides: { '2026-12-25': { nightly: 55_000, minStay: 5 } },
  };
  assert.deepEqual(priceNight(p, '2026-12-21'), { nightly: 40_000, minStay: 4 });
  assert.deepEqual(priceNight(p, '2026-12-19'), { nightly: 45_000, minStay: 4 }); // Saturday in season
  assert.deepEqual(priceNight(p, '2026-12-31'), { nightly: 60_000, minStay: 3 }); // later season wins
  assert.deepEqual(priceNight(p, '2026-12-25'), { nightly: 55_000, minStay: 5 }); // synced price wins
  assert.deepEqual(priceNight(p, '2027-01-03'), { nightly: 25_000, minStay: 2 }); // season end is exclusive
});

test('a weekend stay adds up nights, cleaning and taxes', () => {
  // Fri 6 Nov to Sun 8 Nov: two weekend nights.
  const r = quoteStay(plan, { checkIn: '2026-11-06', checkOut: '2026-11-08', guests: 6 }, [], today);
  assert.ok(r.ok);
  const q = r.quote;
  assert.equal(q.nightsTotal, 64_000);
  assert.deepEqual(q.fees, [{ label: 'Cleaning fee', amount: 17_500 }]);
  // Taxable: 640 + 175 = 815.00. 6% = 48.90, 9% = 73.35.
  assert.deepEqual(q.taxes.map((t) => t.amount), [4_890, 7_335]);
  assert.equal(q.total, 64_000 + 17_500 + 4_890 + 7_335);
  assert.equal(formatUsd(q.total), '$937.25');
});

test('extra guests and pets are separate lines; pets are not taxed in this plan', () => {
  const r = quoteStay(plan, { checkIn: '2026-11-09', checkOut: '2026-11-12', guests: 12, pets: 1 }, [], today);
  assert.ok(r.ok);
  assert.deepEqual(r.quote.fees, [
    { label: 'Cleaning fee', amount: 17_500 },
    { label: 'Extra guests (2 × 3 nights)', amount: 12_000 },
    { label: 'Pet fee', amount: 7_500 },
  ]);
  const taxable = 75_000 + 17_500 + 12_000;
  assert.equal(r.quote.taxes[0]!.amount, Math.round(taxable * 0.06));
});

test('tax is rounded half up to the cent', () => {
  const p: RatePlan = { ...plan, weekendNightly: undefined, cleaningFee: 0, baseNightly: 10_025, minStay: 1, taxes: [{ name: 'Tax', rateBps: 600, appliesTo: ['nights'] }] };
  const r = quoteStay(p, { checkIn: '2026-11-02', checkOut: '2026-11-03', guests: 2 }, [], today);
  assert.ok(r.ok);
  assert.equal(r.quote.taxes[0]!.amount, 602); // 601.5 → 602
});

test('booked nights make the stay unavailable, but check-out day is free', () => {
  const booked = [block({ source: 'airbnb', start: '2026-11-10', end: '2026-11-13' })];
  const clash = quoteStay(plan, { checkIn: '2026-11-08', checkOut: '2026-11-11', guests: 2 }, booked, today);
  assert.equal(clash.ok, false);
  assert.equal(!clash.ok && clash.problem, 'unavailable');
  assert.equal(!clash.ok && clash.conflicts?.length, 1);

  const after = quoteStay(plan, { checkIn: '2026-11-13', checkOut: '2026-11-15', guests: 2 }, booked, today);
  assert.equal(after.ok, true);
  const before = quoteStay(plan, { checkIn: '2026-11-08', checkOut: '2026-11-10', guests: 2 }, booked, today);
  assert.equal(before.ok, true);
});

test('booking rules give a clear reason', () => {
  const cases: Array<[Parameters<typeof quoteStay>[1], string, Partial<RatePlan>?]> = [
    [{ checkIn: '2026-11-08', checkOut: '2026-11-08', guests: 2 }, 'invalid-dates'],
    [{ checkIn: 'soon', checkOut: '2026-11-08', guests: 2 }, 'invalid-dates'],
    [{ checkIn: '2026-10-29', checkOut: '2026-10-31', guests: 2 }, 'too-soon'],
    [{ checkIn: '2028-06-01', checkOut: '2028-06-03', guests: 2 }, 'too-far-ahead'],
    [{ checkIn: '2026-11-08', checkOut: '2026-11-09', guests: 2 }, 'too-short'],
    [{ checkIn: '2026-11-01', checkOut: '2027-01-15', guests: 2 }, 'too-long'],
    [{ checkIn: '2026-11-08', checkOut: '2026-11-10', guests: 13 }, 'too-many-guests'],
    [{ checkIn: '2026-11-08', checkOut: '2026-11-10', guests: 0 }, 'too-many-guests'],
    [{ checkIn: '2026-11-08', checkOut: '2026-11-10', guests: 2, pets: 1 }, 'no-pets', { petFee: undefined }],
    [{ checkIn: '2026-11-08', checkOut: '2026-11-10', guests: 2 }, 'check-in-day', { checkInDays: [5, 6] }],
    [{ checkIn: '2026-11-06', checkOut: '2026-11-10', guests: 2 }, 'check-out-day', { checkOutDays: [0] }],
  ];
  for (const [stay, problem, overrides] of cases) {
    const r = quoteStay({ ...plan, ...overrides }, stay, [], today);
    assert.equal(r.ok, false, JSON.stringify(stay));
    if (!r.ok) {
      assert.equal(r.problem, problem, JSON.stringify(stay));
      assert.ok(r.message.length > 10);
    }
  }
});

test('the minimum stay comes from the arrival night', () => {
  const p: RatePlan = { ...plan, nightlyOverrides: { '2026-11-20': { nightly: 30_000, minStay: 3 } } };
  assert.equal(quoteStay(p, { checkIn: '2026-11-20', checkOut: '2026-11-22', guests: 2 }, [], today).ok, false);
  assert.equal(quoteStay(p, { checkIn: '2026-11-20', checkOut: '2026-11-23', guests: 2 }, [], today).ok, true);
  // Arriving the night before uses the normal 2-night minimum.
  assert.equal(quoteStay(p, { checkIn: '2026-11-19', checkOut: '2026-11-21', guests: 2 }, [], today).ok, true);
});

test('same-day bookings work when notice is set to 0', () => {
  assert.equal(quoteStay({ ...plan, minNoticeDays: 0 }, { checkIn: today, checkOut: '2026-10-31', guests: 2 }, [], today).ok, true);
});
