import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
  type DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';
import type { Booking, Hold, HoldRepository, HoldStatus } from '../checkout.js';
import { eachNight } from '../dates.js';
import type { ClaimResult, NightLock, NightStore } from '../holds.js';
import type { FeedStore } from '../server/service.js';
import type { FeedState } from '../sync.js';
import type { Source } from '../types.js';

/**
 * Everything lives in one DynamoDB table:
 *
 * | pk            | sk                        | item                          |
 * | ------------- | ------------------------- | ----------------------------- |
 * | HOME#<id>     | NIGHT#<date>              | the lock on one night         |
 * | HOME#<id>     | BOOKING#<check-in>#<id>   | a confirmed booking           |
 * | HOME#<id>     | FEED#<source>             | what the last sync read       |
 * | HOME#<id>     | ALERTS                    | double bookings already sent  |
 * | HOLD#<id>     | HOLD                      | a checkout in progress        |
 *
 * Holds waiting for payment are also in the `gsi1` index (gsi1pk AWAITING,
 * gsi1sk expiry time) so the sweeper can find the ones that ran out.
 */
export type Db = Pick<DynamoDBDocumentClient, 'send'>;

/** DynamoDB allows 100 items in one transaction. Stays are capped well below that. */
const MAX_NIGHTS_PER_CLAIM = 100;
const DAY_SECONDS = 86_400;

const homeKey = (homeId: string) => `HOME#${homeId}`;
const nightKey = (night: string) => `NIGHT#${night}`;
const epochSeconds = (iso: string) => Math.floor(Date.parse(iso) / 1000);

function isTransactionConflict(err: unknown): err is { CancellationReasons?: Array<{ Code?: string }> } {
  return err instanceof Error && err.name === 'TransactionCanceledException';
}

function isConditionFailed(err: unknown): boolean {
  return err instanceof Error && err.name === 'ConditionalCheckFailedException';
}

export class DynamoNightStore implements NightStore {
  constructor(
    private readonly db: Db,
    private readonly table: string,
  ) {}

  async claim(homeId: string, checkIn: string, checkOut: string, holdId: string, expiresAt: Date, now: Date): Promise<ClaimResult> {
    const nights = eachNight(checkIn, checkOut);
    if (nights.length > MAX_NIGHTS_PER_CLAIM) throw new Error(`A hold can cover at most ${MAX_NIGHTS_PER_CLAIM} nights`);
    const expires = expiresAt.toISOString();
    try {
      await this.db.send(
        new TransactWriteCommand({
          TransactItems: nights.map((night) => ({
            Put: {
              TableName: this.table,
              Item: {
                pk: homeKey(homeId),
                sk: nightKey(night),
                status: 'held',
                holdId,
                expiresAt: expires,
                // DynamoDB deletes abandoned hold items by itself a day later.
                ttl: epochSeconds(expires) + DAY_SECONDS,
              },
              // Free, ours already, or a hold that has run out. ISO times compare correctly as text.
              ConditionExpression: 'attribute_not_exists(pk) OR holdId = :holdId OR (#status = :held AND expiresAt <= :now)',
              ExpressionAttributeNames: { '#status': 'status' },
              ExpressionAttributeValues: { ':holdId': holdId, ':held': 'held', ':now': now.toISOString() },
            },
          })),
        }),
      );
      return { ok: true };
    } catch (err) {
      if (!isTransactionConflict(err)) throw err;
      const reasons = err.CancellationReasons ?? [];
      const takenNights = nights.filter((_, i) => reasons[i]?.Code === 'ConditionalCheckFailed');
      // Cancelled for another reason (for example two claims colliding mid-transaction): report every night as taken.
      return { ok: false, takenNights: takenNights.length ? takenNights : nights };
    }
  }

  async confirm(homeId: string, checkIn: string, checkOut: string, holdId: string, bookingId: string): Promise<boolean> {
    try {
      await this.db.send(
        new TransactWriteCommand({
          TransactItems: eachNight(checkIn, checkOut).map((night) => ({
            Update: {
              TableName: this.table,
              Key: { pk: homeKey(homeId), sk: nightKey(night) },
              UpdateExpression: 'SET #status = :booked, bookingId = :bookingId REMOVE expiresAt, #ttl',
              ConditionExpression: 'holdId = :holdId',
              ExpressionAttributeNames: { '#status': 'status', '#ttl': 'ttl' },
              ExpressionAttributeValues: { ':booked': 'booked', ':bookingId': bookingId, ':holdId': holdId },
            },
          })),
        }),
      );
      return true;
    } catch (err) {
      if (isTransactionConflict(err)) return false;
      throw err;
    }
  }

  async release(homeId: string, checkIn: string, checkOut: string, holdId: string): Promise<void> {
    await Promise.all(
      eachNight(checkIn, checkOut).map(async (night) => {
        try {
          await this.db.send(
            new DeleteCommand({
              TableName: this.table,
              Key: { pk: homeKey(homeId), sk: nightKey(night) },
              ConditionExpression: 'holdId = :holdId',
              ExpressionAttributeValues: { ':holdId': holdId },
            }),
          );
        } catch (err) {
          // Already gone, or claimed by someone else after our hold ran out: leave it.
          if (!isConditionFailed(err)) throw err;
        }
      }),
    );
  }

  async get(homeId: string, night: string): Promise<NightLock | undefined> {
    const { Item } = await this.db.send(new GetCommand({ TableName: this.table, Key: { pk: homeKey(homeId), sk: nightKey(night) }, ConsistentRead: true }));
    return Item ? toLock(Item) : undefined;
  }

  async list(homeId: string, from: string, to: string) {
    const items = await queryAll(this.db, {
      TableName: this.table,
      KeyConditionExpression: 'pk = :pk AND sk BETWEEN :from AND :to',
      ExpressionAttributeValues: { ':pk': homeKey(homeId), ':from': nightKey(from), ':to': nightKey(to) },
    });
    // BETWEEN includes `to`, which is a check-out day, so drop it here.
    return items.map((item) => ({ night: String(item.sk).slice('NIGHT#'.length), lock: toLock(item) })).filter(({ night }) => night < to);
  }
}

function toLock(item: Record<string, unknown>): NightLock {
  return item.status === 'booked'
    ? { status: 'booked', holdId: String(item.holdId), bookingId: String(item.bookingId) }
    : { status: 'held', holdId: String(item.holdId), expiresAt: String(item.expiresAt) };
}

async function queryAll(db: Db, input: ConstructorParameters<typeof QueryCommand>[0]): Promise<Record<string, unknown>[]> {
  const items: Record<string, unknown>[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const page = await db.send(new QueryCommand({ ...input, ExclusiveStartKey }));
    items.push(...(page.Items ?? []));
    ExclusiveStartKey = page.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

/** Released holds are kept for 180 days for support questions, then DynamoDB deletes them. */
const RELEASED_HOLD_DAYS = 180;

export class DynamoHoldRepository implements HoldRepository {
  constructor(
    private readonly db: Db,
    private readonly table: string,
  ) {}

  private item(hold: Hold) {
    return {
      pk: `HOLD#${hold.id}`,
      sk: 'HOLD',
      status: hold.status,
      hold,
      ...(hold.status === 'awaiting-payment' ? { gsi1pk: 'AWAITING', gsi1sk: hold.expiresAt } : {}),
      ...(hold.status === 'released' ? { ttl: epochSeconds(hold.expiresAt) + RELEASED_HOLD_DAYS * DAY_SECONDS } : {}),
    };
  }

  async create(hold: Hold) {
    await this.db.send(new PutCommand({ TableName: this.table, Item: this.item(hold), ConditionExpression: 'attribute_not_exists(pk)' }));
  }

  async get(id: string) {
    const { Item } = await this.db.send(new GetCommand({ TableName: this.table, Key: { pk: `HOLD#${id}`, sk: 'HOLD' }, ConsistentRead: true }));
    return Item?.hold as Hold | undefined;
  }

  async transition(next: Hold, from: HoldStatus[]) {
    const values = Object.fromEntries(from.map((s, i) => [`:from${i}`, s]));
    try {
      await this.db.send(
        new PutCommand({
          TableName: this.table,
          Item: this.item(next),
          ConditionExpression: `#status IN (${Object.keys(values).join(', ')})`,
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: values,
        }),
      );
      return true;
    } catch (err) {
      if (isConditionFailed(err)) return false;
      throw err;
    }
  }

  async expired(before: Date) {
    const items = await queryAll(this.db, {
      TableName: this.table,
      IndexName: 'gsi1',
      KeyConditionExpression: 'gsi1pk = :awaiting AND gsi1sk < :before',
      ExpressionAttributeValues: { ':awaiting': 'AWAITING', ':before': before.toISOString() },
    });
    return items.map((i) => i.hold as Hold);
  }

  async saveBooking(booking: Booking) {
    await this.db.send(
      new PutCommand({ TableName: this.table, Item: { pk: homeKey(booking.homeId), sk: `BOOKING#${booking.quote.checkIn}#${booking.id}`, booking } }),
    );
  }

  async bookings(homeId: string) {
    const items = await queryAll(this.db, {
      TableName: this.table,
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :booking)',
      ExpressionAttributeValues: { ':pk': homeKey(homeId), ':booking': 'BOOKING#' },
    });
    return items.map((i) => i.booking as Booking);
  }
}

/** What each home's Airbnb and VRBO feeds held at the last read, and which double bookings were already reported. */
export class DynamoFeedStore implements FeedStore {
  constructor(
    private readonly db: Db,
    private readonly table: string,
  ) {}

  async states(homeId: string): Promise<Partial<Record<Source, FeedState>>> {
    const items = await queryAll(this.db, {
      TableName: this.table,
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :feed)',
      ExpressionAttributeValues: { ':pk': homeKey(homeId), ':feed': 'FEED#' },
    });
    return Object.fromEntries(items.map((i) => [(i.state as FeedState).source, i.state as FeedState]));
  }

  async saveStates(homeId: string, states: FeedState[]) {
    await Promise.all(
      states.map((state) => this.db.send(new PutCommand({ TableName: this.table, Item: { pk: homeKey(homeId), sk: `FEED#${state.source}`, state } }))),
    );
  }

  async reportedDoubleBookings(homeId: string): Promise<string[]> {
    const { Item } = await this.db.send(new GetCommand({ TableName: this.table, Key: { pk: homeKey(homeId), sk: 'ALERTS' } }));
    return (Item?.doubleBookings as string[] | undefined) ?? [];
  }

  async saveReportedDoubleBookings(homeId: string, keys: string[]) {
    await this.db.send(new PutCommand({ TableName: this.table, Item: { pk: homeKey(homeId), sk: 'ALERTS', doubleBookings: keys } }));
  }
}
