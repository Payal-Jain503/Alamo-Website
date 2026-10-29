import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DynamoHoldRepository, DynamoNightStore, type Db } from '../src/aws/table.js';
import type { Hold } from '../src/checkout.js';

/** Records each command and answers with whatever the test queues. */
function fakeDb(answers: Array<unknown | Error> = []) {
  const sent: Array<{ name: string; input: Record<string, any> }> = [];
  const db: Db = {
    send: (async (command: { constructor: { name: string }; input: Record<string, any> }) => {
      sent.push({ name: command.constructor.name, input: command.input });
      const a = answers.shift();
      if (a instanceof Error) throw a;
      return a ?? {};
    }) as never,
  };
  return { db, sent };
}

function awsError(name: string, extra: Record<string, unknown> = {}) {
  return Object.assign(new Error(name), { name, ...extra });
}

const now = new Date('2026-10-29T15:00:00Z');
const expires = new Date('2026-10-29T15:15:00Z');

test('claiming nights is one conditional transaction, one item per night', async () => {
  const { db, sent } = fakeDb();
  const store = new DynamoNightStore(db, 'alamo');
  assert.deepEqual(await store.claim('sa', '2026-12-18', '2026-12-21', 'h_1', expires, now), { ok: true });
  assert.equal(sent.length, 1);
  assert.equal(sent[0]!.name, 'TransactWriteCommand');
  const items = sent[0]!.input.TransactItems;
  assert.deepEqual(items.map((i: any) => i.Put.Item.sk), ['NIGHT#2026-12-18', 'NIGHT#2026-12-19', 'NIGHT#2026-12-20']);
  assert.equal(items[0].Put.Item.pk, 'HOME#sa');
  assert.match(items[0].Put.ConditionExpression, /attribute_not_exists\(pk\)/);
  assert.equal(items[0].Put.ExpressionAttributeValues[':now'], now.toISOString());
  assert.equal(items[0].Put.Item.ttl, Math.floor(expires.getTime() / 1000) + 86_400);
});

test('a cancelled transaction reports exactly the nights that were taken', async () => {
  const conflict = awsError('TransactionCanceledException', { CancellationReasons: [{ Code: 'None' }, { Code: 'ConditionalCheckFailed' }, { Code: 'None' }] });
  const store = new DynamoNightStore(fakeDb([conflict]).db, 'alamo');
  assert.deepEqual(await store.claim('sa', '2026-12-18', '2026-12-21', 'h_1', expires, now), { ok: false, takenNights: ['2026-12-19'] });

  const collided = awsError('TransactionCanceledException', { CancellationReasons: [{ Code: 'TransactionConflict' }, { Code: 'None' }] });
  const store2 = new DynamoNightStore(fakeDb([collided]).db, 'alamo');
  assert.deepEqual(await store2.claim('sa', '2026-12-18', '2026-12-20', 'h_1', expires, now), { ok: false, takenNights: ['2026-12-18', '2026-12-19'] });

  const store3 = new DynamoNightStore(fakeDb([awsError('ProvisionedThroughputExceededException')]).db, 'alamo');
  await assert.rejects(store3.claim('sa', '2026-12-18', '2026-12-20', 'h_1', expires, now));
});

test('confirm needs every night to still be ours; release leaves other holds alone', async () => {
  const failed = new DynamoNightStore(fakeDb([awsError('TransactionCanceledException')]).db, 'alamo');
  assert.equal(await failed.confirm('sa', '2026-12-18', '2026-12-20', 'h_1', 'AC-1'), false);

  const { db, sent } = fakeDb([{}, awsError('ConditionalCheckFailedException')]);
  await new DynamoNightStore(db, 'alamo').release('sa', '2026-12-18', '2026-12-20', 'h_1');
  assert.deepEqual(sent.map((s) => s.input.ConditionExpression), ['holdId = :holdId', 'holdId = :holdId']);
});

test('listing nights leaves out the check-out day', async () => {
  const items = [
    { sk: 'NIGHT#2026-12-18', status: 'held', holdId: 'h_1', expiresAt: expires.toISOString() },
    { sk: 'NIGHT#2026-12-21', status: 'booked', holdId: 'h_2', bookingId: 'AC-2' },
  ];
  const store = new DynamoNightStore(fakeDb([{ Items: items }]).db, 'alamo');
  assert.deepEqual(await store.list('sa', '2026-12-18', '2026-12-21'), [{ night: '2026-12-18', lock: { status: 'held', holdId: 'h_1', expiresAt: expires.toISOString() } }]);
});

const hold: Hold = {
  id: 'h_1', homeId: 'sa', guest: { name: 'A', email: 'a@b.co' }, status: 'awaiting-payment', createdAt: now.toISOString(), expiresAt: expires.toISOString(),
  quote: { checkIn: '2026-12-18', checkOut: '2026-12-20', guests: 2, pets: 0, nights: [], nightsTotal: 0, fees: [], taxes: [], total: 0, currency: 'usd' },
};

test('holds waiting for payment are indexed for the sweeper, and status changes are conditional', async () => {
  const { db, sent } = fakeDb([{}, {}, awsError('ConditionalCheckFailedException')]);
  const repo = new DynamoHoldRepository(db, 'alamo');
  await repo.create(hold);
  assert.equal(sent[0]!.input.Item.gsi1pk, 'AWAITING');
  assert.equal(sent[0]!.input.Item.gsi1sk, hold.expiresAt);

  assert.equal(await repo.transition({ ...hold, status: 'released', releaseReason: 'expired' }, ['awaiting-payment']), true);
  const put = sent[1]!.input;
  assert.equal(put.ConditionExpression, '#status IN (:from0)');
  assert.equal(put.Item.gsi1pk, undefined);
  assert.ok(put.Item.ttl > 0);

  assert.equal(await repo.transition({ ...hold, status: 'confirming' }, ['awaiting-payment']), false);
});
