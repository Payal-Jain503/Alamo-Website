/** Where a block on the calendar came from. */
export type Source = 'airbnb' | 'vrbo' | 'direct' | 'owner' | 'other';

/**
 * A guest reservation, or dates closed for any other reason.
 * Airbnb's export also lists dates it blocked because of an imported
 * calendar (for example a VRBO booking), and those come through as "blocked".
 */
export type BlockKind = 'reservation' | 'blocked';

/**
 * One run of unavailable nights.
 * Dates are YYYY-MM-DD in the property's time zone. `start` is the first
 * night and `end` is the check-out day, which is not blocked.
 */
export interface Block {
  source: Source;
  kind: BlockKind;
  uid: string;
  start: string;
  end: string;
  summary: string;
}

export interface FeedConfig {
  source: Source;
  url: string;
}

export interface Property {
  id: string;
  name: string;
  timeZone: string;
  feeds: FeedConfig[];
}
