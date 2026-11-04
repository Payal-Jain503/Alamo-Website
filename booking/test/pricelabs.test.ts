import { test } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryHoldRepository } from '../src/checkout.js';
import { InMemoryNightStore } from '../src/holds.js';
import { InMemoryRateStore, matchListings, PriceLabsClient, toOverrides } from '../src/pricelabs.js';
import { BookingService, InMemoryFeedStore, type HomeConfig } from '../src/server/service.js';

const home: HomeConfig = {
  id: 'crimson',
  name: 'Crimson Star',
  timeZone: 'America/Chicago',
  sources: [],
  plan: { baseNightly: 20_000, minStay: 2, maxNights: 30, minNoticeDays: 0, bookingWindowDays: 365, cleaningFee: 0, maxGuests: 8, includedGuests: 8, taxes: [] },
};

const listings = [
  { id: 'L1', pms: 'airbnb', name: 'Crimson Star | 5BR theater & pool', propertyName: '' },
  { id: 'L2', pms: 'airbnb', name: 'Clay Oak 5BR', propertyName: '' },
];

test('listings match homes by name, and an unclear match is left out', () => {
  const { matched, unmatched } = matchListings([home, { id: 'oat-st', name: 'Oat St' }, { id: 'clay-oak', name: 'Clay Oak' }], listings);
  assert.equal(matched.get('crimson')!.id, 'L1');
  assert.equal(matched.get('clay-oak')!.id, 'L2');
  assert.deepEqual(unmatched, ['Oat St']);
  const twice = matchListings([home], [...listings, { id: 'L3', pms: 'vrbo', name: 'Crimson Star again', propertyName: '' }]);
  assert.equal(twice.matched.size, 0);
  assert.match(twice.unmatched[0]!, /2 listings match/);
});

test('prices become cents, and days without a price are dropped', () => {
  assert.deepEqual(
    toOverrides({ currency: 'USD', days: [{ date: '2026-12-01', price: 299.5, minStay: 3 }, { date: '2026-12-02', price: 0 }, { date: '2026-12-03' }, { date: 'bad', price: 5 }] }),
    { '2026-12-01': { nightly: 29_950, minStay: 3 } },
  );
});

test('the client sends the key and reads listings and prices', async () => {
  const calls: Array<{ url: string; key: string | null; body?: string }> = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    calls.push({ url, key: new Headers(init.headers).get('x-api-key'), body: init.body as string | undefined });
    return Response.json(
      url.endsWith('listings_minimal')
        ? { listings: [{ listing_id: 'L1', pms_name: 'airbnb', listing_name: 'Crimson Star' }] }
        : [{ currency: 'USD', data: [{ date: '2026-12-01', price: 200, min_stay: 2 }] }],
    );
  }) as never;
  const client = new PriceLabsClient('key123', fetchImpl);
  assert.deepEqual(await client.listings(), [{ id: 'L1', pms: 'airbnb', name: 'Crimson Star', propertyName: '' }]);
  const prices = await client.prices({ id: 'L1', pms: 'airbnb' }, '2026-12-01', '2026-12-31');
  assert.deepEqual(prices.days, [{ date: '2026-12-01', price: 200, minStay: 2 }]);
  assert.equal(calls[0]!.key, 'key123');
  assert.deepEqual(JSON.parse(calls[1]!.body!), { listings: [{ id: 'L1', pms: 'airbnb', dateFrom: '2026-12-01', dateTo: '2026-12-31' }] });
});

function service(client: PriceLabsClient | undefined, store = new InMemoryRateStore(), now = '2026-11-04T12:00:00Z') {
  const sent: string[] = [];
  const svc = new BookingService({
    homes: [home],
    nights: new InMemoryNightStore(),
    holds: new InMemoryHoldRepository(),
    feeds: new InMemoryFeedStore(),
    payments: { authorize: async () => ({ paymentId: 'p', clientSecret: 'c' }), capture: async () => {}, cancel: async () => {}, refund: async () => {} },
    alerts: { send: async (s) => void sent.push(s) },
    secrets: { quoteSecret: 'quote-secret-that-is-long-enough-12345', exportSecret: 'export-secret', feedUrls: {} },
    rates: client && { client, store },
    now: () => new Date(now),
  });
  return { svc, store, sent };
}

const fakeClient = (price: number, over: Partial<{ currency: string; error: string }> = {}) =>
  ({
    listings: async () => listings,
    prices: async () => ({ currency: 'USD', days: [{ date: '2026-12-10', price, minStay: 3 }], ...over }),
  }) as unknown as PriceLabsClient;

test('synced PriceLabs prices are used in quotes, and stale ones are not', async () => {
  const { svc, store } = service(fakeClient(350));
  assert.deepEqual((await svc.syncRates()).failed, []);
  const q = await svc.quote({ homeId: 'crimson', checkIn: '2026-12-10', checkOut: '2026-12-13', guests: 2 });
  assert.equal(q.status, 200);
  assert.equal((q.body as { signed: { quote: { nightsTotal: number } } }).signed.quote.nightsTotal, 35_000 + 20_000 * 2);
  const old = await store.load('crimson');
  await store.save('crimson', { ...old!, updatedAt: '2026-11-01T00:00:00Z' });
  const stale = await svc.quote({ homeId: 'crimson', checkIn: '2026-12-10', checkOut: '2026-12-13', guests: 2 });
  assert.equal((stale.body as { signed: { quote: { nightsTotal: number } } }).signed.quote.nightsTotal, 60_000);
});

test('a failed read keeps old prices and emails the owner', async () => {
  const { svc, sent } = service(fakeClient(350, { error: 'LISTING_TOGGLE_OFF' }));
  const r = (await svc.syncRates()) as { failed: string[] };
  assert.deepEqual(r.failed, ['Crimson Star']);
  assert.deepEqual(sent, ['PriceLabs rates not updating']);
});

test('without a key nothing is read and plan rates apply', async () => {
  const { svc } = service(undefined);
  assert.deepEqual(await svc.syncRates(), { skipped: 'PriceLabs is not set up' });
});
