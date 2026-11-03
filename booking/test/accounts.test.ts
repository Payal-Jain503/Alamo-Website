import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bearerToken, type AccountSupport } from '../src/accounts.js';
import { DynamoHoldRepository, type Db } from '../src/aws/table.js';
import { InMemoryHoldRepository, type Booking } from '../src/checkout.js';
import { handleHttp, ORIGIN_HEADER } from '../src/server/http.js';
import { BookingService, InMemoryFeedStore } from '../src/server/service.js';
import { InMemoryNightStore } from '../src/holds.js';

const origin = 'origin-secret-that-is-long-enough-123456';
const home = { id: 'sa', name: 'San Antonio Home', timeZone: 'America/Chicago', plan: {} as never, sources: [] };

function booking(id: string, email: string, checkIn: string, checkOut: string, name = 'Pat Guest', confirmedAt = '2026-10-01T10:00:00Z'): Booking {
  return {
    id,
    holdId: `h_${id}`,
    homeId: 'sa',
    quote: { checkIn, checkOut, guests: 2, pets: 0, nights: [], nightsTotal: 0, fees: [], taxes: [], total: 123456, currency: 'usd' },
    guest: { name, email, phone: '+1 210 555 0100' },
    paymentId: `pi_${id}`,
    confirmedAt,
  };
}

async function setup() {
  const holds = new InMemoryHoldRepository();
  await holds.saveBooking(booking('b1', 'Pat@Example.com', '2026-09-10', '2026-09-13'));
  await holds.saveBooking(booking('b2', 'pat@example.com', '2026-12-18', '2026-12-21', 'Patricia Guest', '2026-10-20T10:00:00Z'));
  await holds.saveBooking(booking('b3', 'someone-else@example.com', '2026-12-01', '2026-12-04'));
  const service = new BookingService({
    homes: [home],
    nights: new InMemoryNightStore(),
    holds,
    feeds: new InMemoryFeedStore(),
    payments: { authorize: async () => ({ paymentId: 'p', clientSecret: 'c' }), capture: async () => {}, cancel: async () => {} },
    alerts: { send: async () => {} },
    secrets: { quoteSecret: 'quote-secret-that-is-long-enough-12345', exportSecret: 'export-secret', feedUrls: {} },
    now: () => new Date('2026-11-03T15:00:00Z'),
  });
  const ensured: string[] = [];
  const accounts: AccountSupport = {
    config: { clientId: 'client123', region: 'ap-south-1' },
    verifier: { verify: async (token) => (token === 'aaa.bbb.good' ? 'pat@example.com' : undefined) },
    directory: { ensure: async (email) => void ensured.push(email) },
  };
  const call = (method: string, path: string, opts: { body?: unknown; headers?: Record<string, string>; withAccounts?: boolean } = {}) =>
    handleHttp(
      service,
      { rawPath: path, headers: { [ORIGIN_HEADER]: origin, ...opts.headers }, body: opts.body === undefined ? undefined : JSON.stringify(opts.body), requestContext: { http: { method } } },
      origin,
      opts.withAccounts === false ? undefined : accounts,
    );
  return { service, call, ensured };
}

test('a guest sees only their own trips, newest first, matched without regard to capital letters', async () => {
  const { service } = await setup();
  const { body } = await service.account('pat@example.com');
  assert.deepEqual(body.trips.map((t) => [t.bookingId, t.status]), [['b2', 'upcoming'], ['b1', 'past']]);
  assert.equal(body.trips[0]!.homeName, 'San Antonio Home');
  assert.equal(body.trips[0]!.totalCents, 123456);
});

test('checkout details come from the most recent booking', async () => {
  const { service } = await setup();
  const { body } = await service.account('pat@example.com');
  assert.equal(body.name, 'Patricia Guest');
  assert.equal(body.phone, '+1 210 555 0100');
  assert.deepEqual((await service.account('nobody@example.com')).body.trips, []);
});

test('/api/me needs a valid sign-in token', async () => {
  const { call } = await setup();
  assert.equal((await call('GET', '/api/me')).statusCode, 401);
  assert.equal((await call('GET', '/api/me', { headers: { authorization: 'Bearer aaa.bbb.forged' } })).statusCode, 401);
  const ok = await call('GET', '/api/me', { headers: { authorization: 'Bearer aaa.bbb.good' } });
  assert.equal(ok.statusCode, 200);
  assert.equal(JSON.parse(ok.body).trips.length, 2);
});

test('accounts answer 503 until the user pool exists', async () => {
  const { call } = await setup();
  assert.equal((await call('GET', '/api/me', { withAccounts: false, headers: { authorization: 'Bearer aaa.bbb.good' } })).statusCode, 503);
  assert.equal((await call('POST', '/api/auth/start', { withAccounts: false, body: { email: 'a@b.co' } })).statusCode, 503);
});

test('the browser can read the public sign-in settings', async () => {
  const { call } = await setup();
  assert.deepEqual(JSON.parse((await call('GET', '/api/auth/config')).body), { clientId: 'client123', region: 'ap-south-1' });
});

test('starting sign-in checks the address and prepares the user in lower case', async () => {
  const { call, ensured } = await setup();
  assert.equal((await call('POST', '/api/auth/start', { body: { email: 'not an email' } })).statusCode, 400);
  assert.equal((await call('POST', '/api/auth/start', { body: {} })).statusCode, 400);
  assert.equal((await call('POST', '/api/auth/start', { body: { email: '  Pat@Example.COM ' } })).statusCode, 200);
  assert.deepEqual(ensured, ['pat@example.com']);
});

test('only a well-formed bearer token is read from the header', () => {
  assert.equal(bearerToken('Bearer aaa.bbb.ccc'), 'aaa.bbb.ccc');
  assert.equal(bearerToken('Basic aaa.bbb.ccc'), undefined);
  assert.equal(bearerToken('Bearer nonsense'), undefined);
  assert.equal(bearerToken(undefined), undefined);
});

test('DynamoDB bookings are indexed by email in lower case and read back newest first', async () => {
  const sent: Array<{ name: string; input: Record<string, any> }> = [];
  const db: Db = {
    send: (async (c: { constructor: { name: string }; input: Record<string, any> }) => {
      sent.push({ name: c.constructor.name, input: c.input });
      return c.constructor.name === 'QueryCommand' ? { Items: [{ booking: booking('b2', 'pat@example.com', '2026-12-18', '2026-12-21') }] } : {};
    }) as never,
  };
  const repo = new DynamoHoldRepository(db, 'alamo');
  await repo.saveBooking(booking('b2', ' Pat@Example.com ', '2026-12-18', '2026-12-21'));
  assert.equal(sent[0]!.input.Item.gsi2pk, 'EMAIL#pat@example.com');
  assert.equal(sent[0]!.input.Item.gsi2sk, '2026-12-18#b2');
  const found = await repo.bookingsByEmail('PAT@example.com');
  assert.equal(found.length, 1);
  assert.equal(sent[1]!.input.IndexName, 'gsi2');
  assert.equal(sent[1]!.input.ExpressionAttributeValues[':email'], 'EMAIL#pat@example.com');
  assert.equal(sent[1]!.input.ScanIndexForward, false);
});
