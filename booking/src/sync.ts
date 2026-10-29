import { FeedFormatError, parseFeed } from './parseFeed.js';
import { fetchFeed, type FetchOptions } from './fetchFeed.js';
import type { Block, FeedConfig, Property, Source } from './types.js';

/** What we remember about one feed between sync runs. */
export interface FeedState {
  source: Source;
  blocks: Block[];
  lastSuccessAt?: string;
  lastError?: string;
  consecutiveFailures: number;
  /** Successful reads in a row that had no upcoming dates although we had some before. */
  consecutiveEmpty: number;
}

export type FeedResult = { ok: true; blocks: Block[]; warnings?: string[] } | { ok: false; error: string };

export type SyncStatus = 'updated' | 'kept-after-error' | 'kept-suspicious-empty';

export interface FeedOutcome {
  state: FeedState;
  status: SyncStatus;
  added: Block[];
  removed: Block[];
  warnings: string[];
  /** True once a feed has failed 3 times in a row and the owner should be told. */
  alert: boolean;
}

export const FAILURES_BEFORE_ALERT = 3;

const key = (b: Block) => `${b.uid}|${b.start}|${b.end}`;
const upcoming = (blocks: Block[], today: string) => blocks.filter((b) => b.end > today);

export function emptyState(source: Source): FeedState {
  return { source, blocks: [], consecutiveFailures: 0, consecutiveEmpty: 0 };
}

/**
 * Applies one fetch result to the stored state of a feed.
 *
 * - A failed fetch keeps the previous blocks.
 * - A feed that suddenly has no upcoming dates is only believed the second
 *   time in a row, because a glitch on Airbnb's or VRBO's side would
 *   otherwise open every booked night at once.
 * - Anything else replaces the blocks, which is how cancellations are removed.
 */
export function applyFeedResult(
  previous: FeedState,
  result: FeedResult,
  now: Date,
  today: string,
): FeedOutcome {
  if (!result.ok) {
    const failures = previous.consecutiveFailures + 1;
    return {
      state: { ...previous, lastError: result.error, consecutiveFailures: failures },
      status: 'kept-after-error',
      added: [],
      removed: [],
      warnings: [],
      alert: failures >= FAILURES_BEFORE_ALERT,
    };
  }

  const hadUpcoming = upcoming(previous.blocks, today).length > 0;
  const hasUpcoming = upcoming(result.blocks, today).length > 0;
  if (hadUpcoming && !hasUpcoming && previous.consecutiveEmpty === 0) {
    return {
      state: { ...previous, consecutiveFailures: 0, consecutiveEmpty: 1, lastSuccessAt: now.toISOString() },
      status: 'kept-suspicious-empty',
      added: [],
      removed: [],
      warnings: ['Feed returned no upcoming dates; keeping previous dates until the next read confirms it'],
      alert: false,
    };
  }

  const before = new Map(previous.blocks.map((b) => [key(b), b]));
  const after = new Map(result.blocks.map((b) => [key(b), b]));
  return {
    state: {
      source: previous.source,
      blocks: result.blocks,
      lastSuccessAt: now.toISOString(),
      consecutiveFailures: 0,
      consecutiveEmpty: 0,
    },
    status: 'updated',
    added: [...after.entries()].filter(([k]) => !before.has(k)).map(([, b]) => b),
    removed: [...before.entries()].filter(([k]) => !after.has(k)).map(([, b]) => b),
    warnings: result.warnings ?? [],
    alert: false,
  };
}

async function readFeed(feed: FeedConfig, timeZone: string, options: FetchOptions): Promise<FeedResult> {
  const fetched = await fetchFeed(feed.url, options);
  if (!fetched.ok) return fetched;
  try {
    return { ok: true, ...parseFeed(fetched.text, feed.source, timeZone) };
  } catch (err) {
    if (err instanceof FeedFormatError) return { ok: false, error: err.message };
    throw err;
  }
}

/** Reads every feed of a property in parallel and applies the results. */
export async function syncProperty(
  property: Property,
  previous: Partial<Record<Source, FeedState>>,
  options: FetchOptions & { now?: Date } = {},
): Promise<FeedOutcome[]> {
  const now = options.now ?? new Date();
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: property.timeZone }).format(now);
  return Promise.all(
    property.feeds.map(async (feed) => {
      const result = await readFeed(feed, property.timeZone, options);
      return applyFeedResult(previous[feed.source] ?? emptyState(feed.source), result, now, today);
    }),
  );
}
