import { createHmac, timingSafeEqual } from 'node:crypto';
import { findDoubleBookings, nightMap } from '../availability.js';
import {
  bookingBlock,
  confirmPayment,
  paymentFailed,
  startCheckout,
  sweepExpiredHolds,
  type CheckoutDeps,
  type Guest,
  type HoldRepository,
  type LiveCalendar,
  type Notifier,
  type PaymentGateway,
  type ReleaseReason,
} from '../checkout.js';
import { addDays, dateInTimeZone } from '../dates.js';
import { buildExportCalendar } from '../exportFeed.js';
import { lockedNights, type NightStore } from '../holds.js';
import { formatUsd, quoteStay, type QuoteProblem, type RatePlan, type StayRequest } from '../pricing.js';
import { signQuote, type SignedQuote } from '../signedQuote.js';
import { readCheckoutEvent, verifyStripeSignature } from '../stripe.js';
import { FAILURES_BEFORE_ALERT, syncProperty, type FeedState } from '../sync.js';
import type { Block, FeedConfig, Property, Source } from '../types.js';

/** One home as the booking engine sees it. Its iCal links are secrets and come from `Secrets.feedUrls`. */
export interface HomeConfig {
  id: string;
  name: string;
  timeZone: string;
  plan: RatePlan;
  /** The calendars that must be read before taking a booking, for example ['airbnb', 'vrbo']. */
  sources: Source[];
}

export interface Secrets {
  stripeWebhookSecret: string;
  quoteSecret: string;
  /** Signs the private export calendar links given to Airbnb and VRBO. */
  exportSecret: string;
  feedUrls: Record<string, Partial<Record<Source, string>>>;
}

export interface FeedStore {
  states(homeId: string): Promise<Partial<Record<Source, FeedState>>>;
  saveStates(homeId: string, states: FeedState[]): Promise<void>;
  reportedDoubleBookings(homeId: string): Promise<string[]>;
  saveReportedDoubleBookings(homeId: string, keys: string[]): Promise<void>;
}

/** Messages to the owner. Production sends them by email through SNS. */
export interface Alerts {
  send(subject: string, message: string): Promise<void>;
}

export interface ServiceDeps {
  homes: HomeConfig[];
  nights: NightStore;
  holds: HoldRepository;
  feeds: FeedStore;
  payments: PaymentGateway;
  alerts: Alerts;
  secrets: Secrets;
  now?(): Date;
  fetchImpl?: typeof fetch;
}

export type ApiResult<T> = { status: number; body: T };

/** Release reasons the owner should hear about. Expired and abandoned checkouts are normal. */
const OWNER_REASONS = new Set<ReleaseReason>(['calendar-conflict', 'calendar-unavailable', 'amount-mismatch', 'capture-failed']);

/** How far the export token is cut. 128 bits is plenty for an unguessable link. */
const EXPORT_TOKEN_LENGTH = 32;

/** The token in a home's export calendar link. */
export function exportToken(secret: string, homeId: string): string {
  return createHmac('sha256', secret).update(`export:${homeId}`).digest('hex').slice(0, EXPORT_TOKEN_LENGTH);
}

export class BookingService {
  private readonly now: () => Date;

  constructor(private readonly deps: ServiceDeps) {
    this.now = deps.now ?? (() => new Date());
  }

  home(id: string): HomeConfig | undefined {
    return this.deps.homes.find((h) => h.id === id);
  }

  private today(home: HomeConfig) {
    return dateInTimeZone(this.now(), home.timeZone);
  }

  private property(home: HomeConfig): { property: Property; missing: Source[] } {
    const urls = this.deps.secrets.feedUrls[home.id] ?? {};
    const feeds: FeedConfig[] = home.sources.flatMap((source) => (urls[source] ? [{ source, url: urls[source]! }] : []));
    const missing = home.sources.filter((s) => !urls[s]);
    return { property: { id: home.id, name: home.name, timeZone: home.timeZone, feeds }, missing };
  }

  /** Dates from the last sync, our bookings, and nights other guests are holding right now. */
  private async knownBlocks(home: HomeConfig): Promise<Block[]> {
    const today = this.today(home);
    const [states, bookings, locks] = await Promise.all([
      this.deps.feeds.states(home.id),
      this.deps.holds.bookings(home.id),
      this.deps.nights.list(home.id, today, addDays(today, home.plan.bookingWindowDays + home.plan.maxNights)),
    ]);
    const held = lockedNights(locks, this.now()).map((night): Block => ({ source: 'direct', kind: 'reservation', uid: `lock-${night}`, start: night, end: addDays(night, 1), summary: 'Held' }));
    return [...Object.values(states).flatMap((s) => s!.blocks), ...bookings.map(bookingBlock), ...held];
  }

  /** Nights the website calendar shows as taken. No guest or source details leave the server. */
  async availability(homeId: string): Promise<ApiResult<{ blocked: string[] } | { error: string }>> {
    const home = this.home(homeId);
    if (!home) return { status: 404, body: { error: 'unknown-home' } };
    const today = this.today(home);
    const blocks = await this.knownBlocks(home);
    const blocked = [...nightMap(blocks, today, addDays(today, home.plan.bookingWindowDays)).keys()].sort();
    return { status: 200, body: { blocked } };
  }

  async quote(input: { homeId: string } & StayRequest): Promise<ApiResult<{ signed: SignedQuote } | { error: QuoteProblem | 'unknown-home'; message?: string }>> {
    const home = this.home(input.homeId);
    if (!home) return { status: 404, body: { error: 'unknown-home' } };
    const stay: StayRequest = { checkIn: String(input.checkIn), checkOut: String(input.checkOut), guests: Number(input.guests), pets: input.pets ? Number(input.pets) : 0 };
    const result = quoteStay(home.plan, stay, await this.knownBlocks(home), this.today(home));
    if (!result.ok) return { status: 422, body: { error: result.problem, message: result.message } };
    return { status: 200, body: { signed: signQuote(home.id, result.quote, this.deps.secrets.quoteSecret, this.now()) } };
  }

  /** Reads Airbnb and VRBO right now. Stale or missing calendars are reported, never treated as empty. */
  readonly liveCalendar: LiveCalendar = {
    externalBlocks: async (homeId) => {
      const home = this.home(homeId);
      if (!home) return { fresh: false, blocks: [] };
      const { property, missing } = this.property(home);
      const outcomes = await syncProperty(property, await this.deps.feeds.states(home.id), { now: this.now(), fetchImpl: this.deps.fetchImpl });
      await this.deps.feeds.saveStates(home.id, outcomes.map((o) => o.state));
      const fresh = missing.length === 0 && outcomes.every((o) => o.status !== 'kept-after-error');
      return { fresh, blocks: outcomes.flatMap((o) => o.state.blocks) };
    },
  };

  private readonly notifier: Notifier = {
    bookingConfirmed: async (b) => {
      const home = this.home(b.homeId);
      await this.deps.alerts.send(
        `New booking ${b.id}: ${home?.name ?? b.homeId}, ${b.quote.checkIn} to ${b.quote.checkOut}`,
        [
          `Booking ${b.id} is confirmed and paid.`,
          `Home: ${home?.name ?? b.homeId}`,
          `Dates: ${b.quote.checkIn} to ${b.quote.checkOut} (${b.quote.nights.length} nights)`,
          `Guests: ${b.quote.guests}${b.quote.pets ? `, pets: ${b.quote.pets}` : ''}`,
          `Guest: ${b.guest.name}, ${b.guest.email}${b.guest.phone ? `, ${b.guest.phone}` : ''}`,
          `Total charged: ${formatUsd(b.quote.total)}`,
          `Stripe payment: ${b.paymentId}`,
          '',
          'Airbnb and VRBO will close these dates on their next calendar read. Block them there by hand if the stay starts within a day.',
        ].join('\n'),
      );
    },
    holdReleased: async (hold, reason) => {
      if (!OWNER_REASONS.has(reason)) return;
      await this.deps.alerts.send(
        `Checkout stopped (${reason}): ${this.home(hold.homeId)?.name ?? hold.homeId}`,
        [
          `A guest's checkout was stopped and their card was not charged.`,
          `Reason: ${reason}`,
          `Dates: ${hold.quote.checkIn} to ${hold.quote.checkOut}`,
          `Guest: ${hold.guest.name}, ${hold.guest.email}${hold.guest.phone ? `, ${hold.guest.phone}` : ''}`,
          `Quoted total: ${formatUsd(hold.quote.total)}`,
        ].join('\n'),
      );
    },
  };

  checkoutDeps(): CheckoutDeps {
    return {
      nights: this.deps.nights,
      payments: this.deps.payments,
      calendar: this.liveCalendar,
      holds: this.deps.holds,
      notify: this.notifier,
      ratePlan: async (homeId) => this.home(homeId)?.plan,
      quoteSecret: this.deps.secrets.quoteSecret,
      today: () => dateInTimeZone(this.now(), 'America/Chicago'),
      now: this.now,
    };
  }

  async reserve(input: { signed: SignedQuote; guest: Guest }) {
    if (!input?.signed?.quote || !input.guest) return { status: 400, body: { ok: false, problem: 'bad-request' } };
    const home = this.home(input.signed.homeId);
    const deps = this.checkoutDeps();
    if (home) deps.today = () => this.today(home);
    const result = await startCheckout(deps, input);
    return { status: result.ok ? 200 : 409, body: result };
  }

  /** What the website shows after the card step: still checking, booked, or released. */
  async holdStatus(holdId: string) {
    const hold = await this.deps.holds.get(holdId);
    if (!hold) return { status: 404, body: { error: 'unknown-hold' } };
    return { status: 200, body: { status: hold.status, bookingId: hold.status === 'confirmed' ? hold.bookingId : undefined, reason: hold.releaseReason } };
  }

  async stripeWebhook(rawBody: string, signature: string | undefined): Promise<ApiResult<{ received: boolean; error?: string }>> {
    if (!verifyStripeSignature(rawBody, signature, this.deps.secrets.stripeWebhookSecret, this.now())) {
      return { status: 400, body: { received: false, error: 'bad-signature' } };
    }
    const event = readCheckoutEvent(JSON.parse(rawBody));
    if (event.type === 'authorized') await confirmPayment(this.checkoutDeps(), event);
    if (event.type === 'failed') await paymentFailed(this.checkoutDeps(), event.holdId);
    return { status: 200, body: { received: true } };
  }

  exportToken(homeId: string): string {
    return exportToken(this.deps.secrets.exportSecret, homeId);
  }

  /** Our calendar for Airbnb and VRBO to import. The link carries a token, so it can't be guessed. */
  async exportCalendar(homeId: string, token: string): Promise<ApiResult<string>> {
    const home = this.home(homeId);
    const expected = Buffer.from(this.exportToken(homeId));
    const given = Buffer.from(token);
    if (!home || given.length !== expected.length || !timingSafeEqual(given, expected)) return { status: 404, body: 'Not found' };
    const bookings = await this.deps.holds.bookings(homeId);
    return { status: 200, body: buildExportCalendar({ id: home.id, name: home.name, timeZone: home.timeZone, feeds: [] }, bookings.map(bookingBlock), this.now()) };
  }

  /** The scheduled sync: reads every home's calendars and tells the owner about failing feeds and double bookings. */
  async syncAll() {
    const summary: Array<{ homeId: string; statuses: string[]; doubleBookings: number }> = [];
    for (const home of this.deps.homes) {
      const { property, missing } = this.property(home);
      const outcomes = await syncProperty(property, await this.deps.feeds.states(home.id), { now: this.now(), fetchImpl: this.deps.fetchImpl });
      await this.deps.feeds.saveStates(home.id, outcomes.map((o) => o.state));

      for (const o of outcomes) {
        // Exactly at the threshold, so a feed that stays down sends one email, not one every run.
        if (o.state.consecutiveFailures === FAILURES_BEFORE_ALERT) {
          await this.deps.alerts.send(
            `${o.state.source} calendar not reading: ${home.name}`,
            `The ${o.state.source} calendar for ${home.name} failed ${FAILURES_BEFORE_ALERT} times in a row (${o.state.lastError}). Its last known dates are still blocked. Check that the iCal link still works.`,
          );
        }
      }

      const bookings = await this.deps.holds.bookings(home.id);
      const overlaps = findDoubleBookings([...outcomes.flatMap((o) => o.state.blocks), ...bookings.map(bookingBlock)]);
      const keys = overlaps.map((o) => `${o.start}|${o.end}|${[...new Set(o.blocks.map((b) => b.source))].sort().join('+')}`);
      const reported = new Set(await this.deps.feeds.reportedDoubleBookings(home.id));
      const fresh = overlaps.filter((_, i) => !reported.has(keys[i]!));
      if (fresh.length) {
        await this.deps.alerts.send(
          `Double booking: ${home.name}`,
          fresh.map((o) => `${o.start} to ${o.end}: ${o.blocks.map((b) => `${b.source} (${b.summary})`).join(' and ')}`).join('\n'),
        );
      }
      if (fresh.length || keys.length !== reported.size) await this.deps.feeds.saveReportedDoubleBookings(home.id, keys);
      if (missing.length) console.warn(`${home.id}: no iCal link for ${missing.join(', ')}; online booking is paused for this home`);
      summary.push({ homeId: home.id, statuses: outcomes.map((o) => `${o.state.source}:${o.status}`), doubleBookings: overlaps.length });
    }
    return summary;
  }

  sweep() {
    return sweepExpiredHolds(this.checkoutDeps());
  }
}

/** In-memory feed storage for tests and local runs. */
export class InMemoryFeedStore implements FeedStore {
  private readonly data = new Map<string, Partial<Record<Source, FeedState>>>();
  private readonly alerts = new Map<string, string[]>();
  async states(homeId: string) {
    return structuredClone(this.data.get(homeId) ?? {});
  }
  async saveStates(homeId: string, states: FeedState[]) {
    const current = this.data.get(homeId) ?? {};
    for (const s of states) current[s.source] = structuredClone(s);
    this.data.set(homeId, current);
  }
  async reportedDoubleBookings(homeId: string) {
    return this.alerts.get(homeId) ?? [];
  }
  async saveReportedDoubleBookings(homeId: string, keys: string[]) {
    this.alerts.set(homeId, [...keys]);
  }
}
