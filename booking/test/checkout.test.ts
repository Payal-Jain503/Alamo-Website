import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  HOLD_MINUTES,
  InMemoryHoldRepository,
  SWEEP_GRACE_MINUTES,
  bookingBlock,
  confirmPayment,
  paymentFailed,
  startCheckout,
  sweepExpiredHolds,
  type CheckoutDeps,
  type PaymentGateway,
} from '../src/checkout.js';
import { buildExportCalendar } from '../src/exportFeed.js';
import { InMemoryNightStore } from '../src/holds.js';
import { quoteStay, type RatePlan } from '../src/pricing.js';
import { signQuote } from '../src/signedQuote.js';
import type { Block } from '../src/types.js';
import { block } from './helpers.js';

const secret = 'test-secret-that-is-long-enough-1234567890';
const plan: RatePlan = {
  baseNightly: 25_000,
  minStay: 2,
  maxNights: 30,
  minNoticeDays: 0,
  bookingWindowDays: 365,
  cleaningFee: 17_500,
  maxGuests: 10,
  includedGuests: 10,
  taxes: [{ name: 'Tax', rateBps: 600, appliesTo: ['nights', 'cleaning'] }],
};
const guest = { name: 'Jordan Lee', email: 'jordan@example.com' };
const stay = { checkIn: '2026-11-09', checkOut: '2026-11-12', guests: 4 };

function setup(opts: { blocks?: Block[]; fresh?: boolean; plan?: RatePlan } = {}) {
  let clock = new Date('2026-10-29T15:00:00Z');
  let ids = 0;
  const calls: string[] = [];
  const released: string[] = [];
  const confirmed: string[] = [];
  const calendar = { blocks: opts.blocks ?? [], fresh: opts.fresh ?? true };
  const payments: PaymentGateway & { failAuthorize?: boolean; failCapture?: boolean } = {
    async authorize(i) {
      calls.push(`authorize ${i.amount} ${i.idempotencyKey}`);
      if (payments.failAuthorize) throw new Error('card declined');
      return { paymentId: `pi_${i.holdId}`, clientSecret: `secret_${i.holdId}` };
    },
    async capture(id, key) {
      calls.push(`capture ${id} ${key}`);
      if (payments.failCapture) throw new Error('capture failed');
    },
    async cancel(id, key) {
      calls.push(`cancel ${id} ${key}`);
    },
  };
  const holds = new InMemoryHoldRepository();
  const nights = new InMemoryNightStore();
  const deps: CheckoutDeps = {
    nights,
    payments,
    holds,
    calendar: { externalBlocks: async () => ({ fresh: calendar.fresh, blocks: calendar.blocks }) },
    notify: {
      bookingConfirmed: async (b) => void confirmed.push(b.id),
      holdReleased: async (h, reason) => void released.push(`${h.id} ${reason}`),
    },
    ratePlan: async (homeId) => (homeId === 'sa-5br' ? (opts.plan ?? plan) : undefined),
    quoteSecret: secret,
    today: () => '2026-10-29',
    now: () => clock,
    newId: () => `h_test000${++ids}`,
  };
  const quote = quoteStay(plan, stay, [], '2026-10-29');
  assert.ok(quote.ok);
  const signed = signQuote('sa-5br', quote.quote, secret, clock);
  return {
    deps, calls, released, confirmed, calendar, payments, holds, nights, signed, total: quote.quote.total,
    advance(minutes: number) { clock = new Date(clock.getTime() + minutes * 60_000); },
  };
}

test('happy path: hold, authorise, final check, capture, booking', async () => {
  const t = setup();
  const start = await startCheckout(t.deps, { signed: t.signed, guest });
  assert.ok(start.ok);
  assert.equal(start.clientSecret, 'secret_h_test0001');
  assert.equal(Date.parse(start.expiresAt) - t.deps.now().getTime(), HOLD_MINUTES * 60_000);
  assert.equal((await t.nights.get('sa-5br', '2026-11-10'))?.status, 'held');

  const done = await confirmPayment(t.deps, { holdId: start.holdId, paymentId: 'pi_h_test0001', amount: t.total });
  assert.ok(done.ok);
  assert.equal(done.booking.id, 'AC-TEST0001');
  assert.deepEqual(t.calls, [`authorize ${t.total} authorize-h_test0001`, 'capture pi_h_test0001 capture-h_test0001']);
  assert.deepEqual(t.confirmed, ['AC-TEST0001']);
  assert.equal((await t.nights.get('sa-5br', '2026-11-10'))?.status, 'booked');
  assert.equal(t.holds.bookings.size, 1);
});

test('Stripe sending the event twice books once and charges once', async () => {
  const t = setup();
  const start = await startCheckout(t.deps, { signed: t.signed, guest });
  assert.ok(start.ok);
  const event = { holdId: start.holdId, paymentId: 'pi_h_test0001', amount: t.total };
  await confirmPayment(t.deps, event);
  const again = await confirmPayment(t.deps, event);
  assert.ok(again.ok && again.alreadyConfirmed);
  assert.equal(t.calls.filter((c) => c.startsWith('capture')).length, 1);
  assert.equal(t.confirmed.length, 1);
});

test('a tampered or expired quote is refused before anything is held', async () => {
  const t = setup();
  const cheap = { ...t.signed, quote: { ...t.signed.quote, total: 100 } };
  assert.deepEqual(await startCheckout(t.deps, { signed: cheap, guest }), { ok: false, problem: 'quote-tampered' });
  t.advance(31);
  assert.deepEqual(await startCheckout(t.deps, { signed: t.signed, guest }), { ok: false, problem: 'quote-expired' });
  assert.deepEqual(t.calls, []);
});

test('guest details are checked', async () => {
  const t = setup();
  for (const g of [{ name: '', email: 'a@b.co' }, { name: 'A', email: 'not-an-email' }, { name: '  ', email: ' ' }]) {
    assert.deepEqual(await startCheckout(t.deps, { signed: t.signed, guest: g }), { ok: false, problem: 'invalid-guest' });
  }
});

test('if Airbnb or VRBO cannot be read right now, nothing is held or charged', async () => {
  const t = setup({ fresh: false });
  assert.deepEqual(await startCheckout(t.deps, { signed: t.signed, guest }), { ok: false, problem: 'calendar-unavailable' });
  assert.deepEqual(t.calls, []);
});

test('dates booked on Airbnb since the quote are refused', async () => {
  const t = setup({ blocks: [block({ source: 'airbnb', start: '2026-11-11', end: '2026-11-14' })] });
  const r = await startCheckout(t.deps, { signed: t.signed, guest });
  assert.equal(!r.ok && r.problem, 'unavailable');
  assert.deepEqual(t.calls, []);
});

test('a price change since the quote returns the new quote instead of charging', async () => {
  const t = setup({ plan: { ...plan, baseNightly: 27_500 } });
  const r = await startCheckout(t.deps, { signed: t.signed, guest });
  assert.equal(!r.ok && r.problem, 'price-changed');
  if (!r.ok && r.problem === 'price-changed') assert.ok(r.quote.total > t.total);
  assert.deepEqual(t.calls, []);
});

test('a second guest on the same dates is told they are taken', async () => {
  const t = setup();
  assert.ok((await startCheckout(t.deps, { signed: t.signed, guest })).ok);
  const second = await startCheckout(t.deps, { signed: t.signed, guest: { name: 'Sam', email: 'sam@example.com' } });
  assert.deepEqual(second, { ok: false, problem: 'dates-taken', takenNights: ['2026-11-09', '2026-11-10', '2026-11-11'] });
});

test('a declined authorisation frees the nights straight away', async () => {
  const t = setup();
  t.payments.failAuthorize = true;
  assert.deepEqual(await startCheckout(t.deps, { signed: t.signed, guest }), { ok: false, problem: 'payment-failed' });
  assert.equal(await t.nights.get('sa-5br', '2026-11-10'), undefined);
});

test('a booking that lands on Airbnb during payment is released and the card is not charged', async () => {
  const t = setup();
  const start = await startCheckout(t.deps, { signed: t.signed, guest });
  assert.ok(start.ok);
  t.calendar.blocks = [block({ source: 'vrbo', start: '2026-11-10', end: '2026-11-12' })];
  const r = await confirmPayment(t.deps, { holdId: start.holdId, paymentId: 'pi_h_test0001', amount: t.total });
  assert.deepEqual(r, { ok: false, reason: 'calendar-conflict' });
  assert.ok(t.calls.includes('cancel pi_h_test0001 cancel-h_test0001'));
  assert.ok(!t.calls.some((c) => c.startsWith('capture')));
  assert.deepEqual(t.released, ['h_test0001 calendar-conflict']);
  assert.equal(await t.nights.get('sa-5br', '2026-11-10'), undefined);
});

test('a feed outage at the final check releases rather than risking a double booking', async () => {
  const t = setup();
  const start = await startCheckout(t.deps, { signed: t.signed, guest });
  assert.ok(start.ok);
  t.calendar.fresh = false;
  const r = await confirmPayment(t.deps, { holdId: start.holdId, paymentId: 'pi_h_test0001', amount: t.total });
  assert.deepEqual(r, { ok: false, reason: 'calendar-unavailable' });
  assert.ok(!t.calls.some((c) => c.startsWith('capture')));
});

test('a wrong amount or payment is released, not captured', async () => {
  const t = setup();
  const start = await startCheckout(t.deps, { signed: t.signed, guest });
  assert.ok(start.ok);
  const r = await confirmPayment(t.deps, { holdId: start.holdId, paymentId: 'pi_h_test0001', amount: 100 });
  assert.deepEqual(r, { ok: false, reason: 'amount-mismatch' });
  assert.ok(!t.calls.some((c) => c.startsWith('capture')));
  assert.equal((await t.holds.get(start.holdId))?.status, 'released');
});

test('a failed capture frees the nights again', async () => {
  const t = setup();
  const start = await startCheckout(t.deps, { signed: t.signed, guest });
  assert.ok(start.ok);
  t.payments.failCapture = true;
  const r = await confirmPayment(t.deps, { holdId: start.holdId, paymentId: 'pi_h_test0001', amount: t.total });
  assert.deepEqual(r, { ok: false, reason: 'capture-failed' });
  assert.equal(await t.nights.get('sa-5br', '2026-11-10'), undefined);
  assert.equal(t.holds.bookings.size, 0);
});

test('a slightly late payment still books if nobody took the dates', async () => {
  const t = setup();
  const start = await startCheckout(t.deps, { signed: t.signed, guest });
  assert.ok(start.ok);
  t.advance(HOLD_MINUTES + 2);
  const r = await confirmPayment(t.deps, { holdId: start.holdId, paymentId: 'pi_h_test0001', amount: t.total });
  assert.ok(r.ok);
});

test('the sweeper releases holds after the grace period, and a late payment is then cancelled', async () => {
  const t = setup();
  const start = await startCheckout(t.deps, { signed: t.signed, guest });
  assert.ok(start.ok);
  t.advance(HOLD_MINUTES + SWEEP_GRACE_MINUTES - 1);
  assert.equal(await sweepExpiredHolds(t.deps), 0);
  t.advance(2);
  assert.equal(await sweepExpiredHolds(t.deps), 1);
  assert.deepEqual(t.released, ['h_test0001 expired']);
  assert.equal(await t.nights.get('sa-5br', '2026-11-10'), undefined);

  const late = await confirmPayment(t.deps, { holdId: start.holdId, paymentId: 'pi_h_test0001', amount: t.total });
  assert.deepEqual(late, { ok: false, reason: 'already-released' });
  assert.ok(!t.calls.some((c) => c.startsWith('capture')));
  assert.equal(await sweepExpiredHolds(t.deps), 0);
});

test('a failed payment frees the nights; unknown holds are ignored', async () => {
  const t = setup();
  const start = await startCheckout(t.deps, { signed: t.signed, guest });
  assert.ok(start.ok);
  await paymentFailed(t.deps, start.holdId);
  await paymentFailed(t.deps, start.holdId);
  await paymentFailed(t.deps, 'h_nope');
  assert.deepEqual(t.released, ['h_test0001 payment-failed']);
  assert.equal(await t.nights.get('sa-5br', '2026-11-10'), undefined);
  assert.deepEqual(await confirmPayment(t.deps, { holdId: 'h_nope', paymentId: 'pi_x', amount: 1 }), { ok: false, reason: 'unknown-hold' });
});

test('a confirmed booking goes on the export calendar with no guest details', async () => {
  const t = setup();
  const start = await startCheckout(t.deps, { signed: t.signed, guest });
  assert.ok(start.ok);
  const done = await confirmPayment(t.deps, { holdId: start.holdId, paymentId: 'pi_h_test0001', amount: t.total });
  assert.ok(done.ok);
  const ics = buildExportCalendar({ id: 'sa-5br', name: 'San Antonio 5BR', feeds: [] } as never, [bookingBlock(done.booking)]);
  assert.match(ics, /DTSTART;VALUE=DATE:20261109/);
  assert.match(ics, /DTEND;VALUE=DATE:20261112/);
  assert.match(ics, /SUMMARY:Reserved/);
  assert.doesNotMatch(ics, /Jordan|example\.com/);
});
