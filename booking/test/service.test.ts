import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { InMemoryHoldRepository, type PaymentGateway } from '../src/checkout.js';
import { InMemoryNightStore } from '../src/holds.js';
import { BookingService, InMemoryFeedStore, type HomeConfig } from '../src/server/service.js';
import { handleHttp, ORIGIN_HEADER, type HttpRequest } from '../src/server/http.js';
import type { SignedQuote } from '../src/signedQuote.js';
import { ics, vevent } from './helpers.js';

const home: HomeConfig = {
  id: 'san-antonio-5-bedroom',
  name: 'San Antonio 5 Bedroom',
  timeZone: 'America/Chicago',
  sources: ['airbnb', 'vrbo'],
  plan: { baseNightly: 25_000, minStay: 2, maxNights: 30, minNoticeDays: 0, bookingWindowDays: 365, cleaningFee: 17_500, maxGuests: 10, includedGuests: 10, taxes: [] },
};
const AIRBNB = 'https://www.airbnb.com/calendar/ical/1.ics?s=secret';
const VRBO = 'https://www.vrbo.com/icalendar/abc.ics';
const whsec = 'whsec_test';
const origin = 'origin-secret-0123456789abcdef0123456789';
const guest = { name: 'Jordan Lee', email: 'jordan@example.com' };

const reservation = (start: string, end: string, uid: string, summary = 'Reserved') =>
  vevent({ 'DTSTART;VALUE=DATE': start.replaceAll('-', ''), 'DTEND;VALUE=DATE': end.replaceAll('-', ''), UID: uid, SUMMARY: summary });

function setup() {
  const clock = { now: new Date('2026-10-29T15:00:00Z') };
  const feeds: Record<string, string | Error> = {
    [AIRBNB]: ics(reservation('2026-11-02', '2026-11-06', 'a1@airbnb.com')),
    [VRBO]: ics(reservation('2026-11-20', '2026-11-23', 'v1@vrbo.com', 'Reserved - Pat')),
  };
  const fetchImpl = (async (url: string) => {
    const f = feeds[url];
    if (f instanceof Error || f === undefined) return new Response('Service Unavailable', { status: 503 });
    return new Response(f, { status: 200, headers: { 'content-type': 'text/calendar' } });
  }) as unknown as typeof fetch;
  const alerts: Array<{ subject: string; message: string }> = [];
  const charged: string[] = [];
  const payments: PaymentGateway = {
    authorize: async (i) => ({ paymentId: `pi_${i.holdId}`, clientSecret: `cs_${i.holdId}` }),
    capture: async (id) => void charged.push(id),
    cancel: async () => {},
  };
  const holds = new InMemoryHoldRepository();
  const service = new BookingService({
    homes: [home],
    nights: new InMemoryNightStore(),
    holds,
    feeds: new InMemoryFeedStore(),
    payments,
    alerts: { send: async (subject, message) => void alerts.push({ subject, message }) },
    secrets: { stripeWebhookSecret: whsec, quoteSecret: 'quote-secret-that-is-long-enough-12345', exportSecret: 'export-secret', feedUrls: { [home.id]: { airbnb: AIRBNB, vrbo: VRBO } } },
    now: () => clock.now,
    fetchImpl,
  });
  const call = (method: string, path: string, opts: { body?: unknown; query?: Record<string, string>; headers?: Record<string, string>; raw?: string } = {}) =>
    handleHttp(
      service,
      {
        rawPath: path,
        queryStringParameters: opts.query,
        headers: { [ORIGIN_HEADER]: origin, ...opts.headers },
        body: opts.raw ?? (opts.body === undefined ? undefined : JSON.stringify(opts.body)),
        requestContext: { http: { method } },
      } satisfies HttpRequest,
      origin,
    );
  return { service, feeds, alerts, charged, holds, clock, call };
}

function stripeEvent(type: string, intent: Record<string, unknown>, now: Date) {
  const raw = JSON.stringify({ id: 'evt_1', type, data: { object: intent } });
  const t = Math.floor(now.getTime() / 1000);
  return { raw, signature: `t=${t},v1=${createHmac('sha256', whsec).update(`${t}.${raw}`).digest('hex')}` };
}

test('end to end: sync, availability, quote, reserve, Stripe webhook, export calendar', async () => {
  const s = setup();
  const summary = await s.service.syncAll();
  assert.deepEqual(summary, [{ homeId: home.id, statuses: ['airbnb:updated', 'vrbo:updated'], doubleBookings: 0 }]);

  const avail = await s.call('GET', '/api/availability', { query: { home: home.id } });
  assert.equal(avail.statusCode, 200);
  const { blocked } = JSON.parse(avail.body);
  assert.deepEqual(blocked.slice(0, 4), ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05']);
  assert.ok(blocked.includes('2026-11-22') && !blocked.includes('2026-11-23'));
  assert.doesNotMatch(avail.body, /Pat|airbnb|vrbo/);

  const taken = await s.call('POST', '/api/quote', { body: { homeId: home.id, checkIn: '2026-11-04', checkOut: '2026-11-07', guests: 4 } });
  assert.equal(taken.statusCode, 422);
  assert.equal(JSON.parse(taken.body).error, 'unavailable');

  const quote = await s.call('POST', '/api/quote', { body: { homeId: home.id, checkIn: '2026-11-09', checkOut: '2026-11-12', guests: 4 } });
  assert.equal(quote.statusCode, 200);
  const signed: SignedQuote = JSON.parse(quote.body).signed;
  assert.equal(signed.quote.total, 3 * 25_000 + 17_500);

  const reserve = await s.call('POST', '/api/reserve', { body: { signed, guest } });
  assert.equal(reserve.statusCode, 200);
  const { holdId, clientSecret } = JSON.parse(reserve.body);
  assert.equal(clientSecret, `cs_${holdId}`);

  // Another guest now sees those nights as taken.
  const again = await s.call('POST', '/api/quote', { body: { homeId: home.id, checkIn: '2026-11-10', checkOut: '2026-11-12', guests: 2 } });
  assert.equal(JSON.parse(again.body).error, 'unavailable');

  const ev = stripeEvent('payment_intent.amount_capturable_updated', { id: `pi_${holdId}`, amount_capturable: signed.quote.total, metadata: { holdId } }, s.clock.now);
  const hook = await s.call('POST', '/api/stripe-webhook', { raw: ev.raw, headers: { 'stripe-signature': ev.signature } });
  assert.equal(hook.statusCode, 200);
  assert.deepEqual(s.charged, [`pi_${holdId}`]);

  const status = JSON.parse((await s.call('GET', '/api/hold', { query: { id: holdId } })).body);
  assert.equal(status.status, 'confirmed');
  assert.match(status.bookingId, /^AC-/);
  assert.equal(s.alerts.length, 1);
  assert.match(s.alerts[0]!.subject, /New booking AC-.*San Antonio 5 Bedroom, 2026-11-09 to 2026-11-12/);
  assert.match(s.alerts[0]!.message, /jordan@example\.com/);

  const cal = await s.call('GET', `/cal/${home.id}-${s.service.exportToken(home.id)}.ics`);
  assert.equal(cal.statusCode, 200);
  assert.equal(cal.headers['content-type'], 'text/calendar; charset=utf-8');
  assert.match(cal.body, /DTSTART;VALUE=DATE:20261109/);
  assert.doesNotMatch(cal.body, /Jordan|Pat/);
  // Airbnb's and VRBO's own dates are never echoed back to them.
  assert.doesNotMatch(cal.body, /20261102/);
});

test('reserving stops if Airbnb or VRBO cannot be read, and a missing link pauses booking', async () => {
  const s = setup();
  const quote = await s.call('POST', '/api/quote', { body: { homeId: home.id, checkIn: '2026-11-09', checkOut: '2026-11-12', guests: 4 } });
  const signed = JSON.parse(quote.body).signed;
  s.feeds[VRBO] = new Error('down');
  const r = await s.call('POST', '/api/reserve', { body: { signed, guest } });
  assert.equal(r.statusCode, 409);
  assert.equal(JSON.parse(r.body).problem, 'calendar-unavailable');

  const noLink = setup();
  (noLink.service as unknown as { deps: { secrets: { feedUrls: Record<string, unknown> } } }).deps.secrets.feedUrls[home.id] = { airbnb: AIRBNB };
  const q2 = JSON.parse((await noLink.call('POST', '/api/quote', { body: { homeId: home.id, checkIn: '2026-11-09', checkOut: '2026-11-12', guests: 4 } })).body).signed;
  assert.equal(JSON.parse((await noLink.call('POST', '/api/reserve', { body: { signed: q2, guest } })).body).problem, 'calendar-unavailable');
});

test('a booking made on VRBO while the guest paid is caught before charging', async () => {
  const s = setup();
  const signed = JSON.parse((await s.call('POST', '/api/quote', { body: { homeId: home.id, checkIn: '2026-11-09', checkOut: '2026-11-12', guests: 4 } })).body).signed;
  const { holdId } = JSON.parse((await s.call('POST', '/api/reserve', { body: { signed, guest } })).body);
  s.feeds[VRBO] = ics(reservation('2026-11-10', '2026-11-12', 'v2@vrbo.com'));
  const ev = stripeEvent('payment_intent.amount_capturable_updated', { id: `pi_${holdId}`, amount_capturable: signed.quote.total, metadata: { holdId } }, s.clock.now);
  await s.call('POST', '/api/stripe-webhook', { raw: ev.raw, headers: { 'stripe-signature': ev.signature } });
  assert.deepEqual(s.charged, []);
  assert.equal(JSON.parse((await s.call('GET', '/api/hold', { query: { id: holdId } })).body).reason, 'calendar-conflict');
  assert.match(s.alerts[0]!.subject, /Checkout stopped \(calendar-conflict\)/);
});

test('the sync alerts once for a failing feed and once for each new double booking', async () => {
  const s = setup();
  s.feeds[AIRBNB] = new Error('down');
  for (let i = 0; i < 5; i++) await s.service.syncAll();
  assert.equal(s.alerts.filter((a) => /airbnb calendar not reading/.test(a.subject)).length, 1);

  s.feeds[AIRBNB] = ics(reservation('2026-11-21', '2026-11-24', 'a2@airbnb.com'));
  await s.service.syncAll();
  await s.service.syncAll();
  const doubles = s.alerts.filter((a) => /Double booking/.test(a.subject));
  assert.equal(doubles.length, 1);
  assert.match(doubles[0]!.message, /2026-11-21 to 2026-11-23/);
});

test('requests that skip CloudFront, bad input and unknown paths are refused', async () => {
  const s = setup();
  const direct = await handleHttp(s.service, { rawPath: '/api/availability', headers: {}, requestContext: { http: { method: 'GET' } } }, origin);
  assert.equal(direct.statusCode, 403);
  assert.equal((await s.call('GET', '/api/availability', { query: { home: '../etc' } })).statusCode, 400);
  assert.equal((await s.call('GET', '/api/availability', { query: { home: 'nope' } })).statusCode, 404);
  assert.equal((await s.call('POST', '/api/quote', { raw: '{not json' })).statusCode, 400);
  assert.equal((await s.call('POST', '/api/reserve', { raw: '{}' })).statusCode, 400);
  assert.equal((await s.call('GET', '/api/hold', { query: { id: 'x' } })).statusCode, 400);
  assert.equal((await s.call('POST', '/api/stripe-webhook', { raw: '{}', headers: { 'stripe-signature': 't=1,v1=00' } })).statusCode, 400);
  assert.equal((await s.call('GET', `/cal/${home.id}-${'0'.repeat(32)}.ics`)).statusCode, 404);
  assert.equal((await s.call('DELETE', '/api/quote')).statusCode, 404);
});

test('a base64 body from the Function URL is decoded before the signature check', async () => {
  const s = setup();
  const ev = stripeEvent('payment_intent.succeeded', { id: 'pi_x', metadata: { holdId: 'h_x' } }, s.clock.now);
  const r = await handleHttp(
    s.service,
    { rawPath: '/api/stripe-webhook', headers: { [ORIGIN_HEADER]: origin, 'stripe-signature': ev.signature }, body: Buffer.from(ev.raw).toString('base64'), isBase64Encoded: true, requestContext: { http: { method: 'POST' } } },
    origin,
  );
  assert.equal(r.statusCode, 200);
});
