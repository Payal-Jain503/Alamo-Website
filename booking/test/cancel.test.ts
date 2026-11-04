import { test } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryHoldRepository, type Booking } from '../src/checkout.js';
import { InMemoryNightStore } from '../src/holds.js';
import { BookingService, InMemoryFeedStore, type HomeConfig } from '../src/server/service.js';

const home: HomeConfig = {
  id: 'sa',
  name: 'San Antonio Home',
  timeZone: 'America/Chicago',
  sources: [],
  plan: { baseNightly: 20_000, minStay: 2, maxNights: 30, minNoticeDays: 0, bookingWindowDays: 365, cleaningFee: 0, maxGuests: 8, includedGuests: 8, taxes: [] },
};

const booking = (id: string, checkIn: string, checkOut: string, total = 100_001): Booking => ({
  id,
  holdId: `h_${id}`,
  homeId: 'sa',
  quote: { checkIn, checkOut, guests: 2, pets: 0, nights: [], nightsTotal: 0, fees: [], taxes: [], total, currency: 'usd' },
  guest: { name: 'Pat Guest', email: 'pat@example.com', phone: '+1 210 555 0100' },
  paymentId: `pi_${id}`,
  confirmedAt: '2026-10-01T10:00:00Z',
});

async function setup() {
  const holds = new InMemoryHoldRepository();
  const nights = new InMemoryNightStore();
  for (const b of [booking('far', '2026-12-18', '2026-12-21'), booking('five', '2026-11-08', '2026-11-10'), booking('near', '2026-11-07', '2026-11-09'), booking('past', '2026-09-10', '2026-09-12'), booking('today', '2026-11-03', '2026-11-05')]) {
    await holds.saveBooking(b);
    await nights.claim('sa', b.quote.checkIn, b.quote.checkOut, b.holdId, new Date('2030-01-01'), new Date('2026-10-01'));
    await nights.confirm('sa', b.quote.checkIn, b.quote.checkOut, b.holdId, b.id);
  }
  const refunds: string[] = [];
  const alerts: string[] = [];
  const service = new BookingService({
    homes: [home],
    nights,
    holds,
    feeds: new InMemoryFeedStore(),
    payments: { authorize: async () => ({ paymentId: 'p', clientSecret: 'c' }), capture: async () => {}, cancel: async () => {}, refund: async (id, amount, key) => void refunds.push(`${id} ${amount} ${key}`) },
    alerts: { send: async (s) => void alerts.push(s) },
    secrets: { quoteSecret: 'quote-secret-that-is-long-enough-12345', exportSecret: 'export-secret', feedUrls: {} },
    now: () => new Date('2026-11-03T15:00:00Z'),
  });
  return { service, holds, nights, refunds, alerts };
}

test('5 or more days before check-in is a full refund and the dates reopen', async () => {
  const { service, nights, refunds, holds } = await setup();
  assert.deepEqual(await service.cancelBooking('PAT@example.com', 'far'), { status: 200, body: { refundCents: 100_001 } });
  assert.deepEqual(refunds, ['pi_far 100001 refund-far']);
  assert.equal(await nights.get('sa', '2026-12-18'), undefined);
  assert.equal((await holds.bookings('sa')).some((b) => b.id === 'far'), false);
  const trips = (await service.account('pat@example.com')).body.trips;
  assert.deepEqual([trips.find((t) => t.bookingId === 'far')!.status, trips.find((t) => t.bookingId === 'far')!.refundCents], ['cancelled', 100_001]);
  assert.equal((await service.cancelBooking('pat@example.com', 'five')).status, 200);
});

test('under 5 days is half, rounded down', async () => {
  const { service, refunds, alerts } = await setup();
  assert.deepEqual((await service.cancelBooking('pat@example.com', 'near')).body, { refundCents: 50_000 });
  assert.deepEqual(refunds, ['pi_near 50000 refund-near']);
  assert.deepEqual(alerts, ['Booking cancelled: San Antonio Home']);
});

test('only the guest can cancel, once, and not after the stay has begun', async () => {
  const { service } = await setup();
  assert.equal((await service.cancelBooking('someone-else@example.com', 'far')).status, 404);
  assert.equal((await service.cancelBooking('pat@example.com', 'nope')).status, 404);
  assert.equal((await service.cancelBooking('pat@example.com', 'past')).status, 409);
  assert.equal((await service.cancelBooking('pat@example.com', 'today')).status, 409);
  assert.equal((await service.cancelBooking('pat@example.com', 'far')).status, 200);
  assert.deepEqual((await service.cancelBooking('pat@example.com', 'far')).body, { error: 'already-cancelled' });
});

test('a failed refund changes nothing, so the guest can try again', async () => {
  const { service, holds } = await setup();
  (service as unknown as { deps: { payments: { refund: () => Promise<void> } } }).deps.payments.refund = async () => {
    throw new Error('stripe down');
  };
  await assert.rejects(service.cancelBooking('pat@example.com', 'far'));
  assert.equal((await holds.bookings('sa')).some((b) => b.id === 'far'), true);
});
