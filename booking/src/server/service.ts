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
  type Booking,
  type HoldRepository,
  type Review,
  type LiveCalendar,
  type Notifier,
  type PaymentGateway,
  type ReleaseReason,
} from '../checkout.js';
import { addDays, dateInTimeZone } from '../dates.js';
import { buildExportCalendar } from '../exportFeed.js';
import { matchListings, RATES_MAX_AGE_MS, toOverrides, type PriceLabsClient, type RateStore } from '../pricelabs.js';
import { lockedNights, type NightStore } from '../holds.js';
import { bookingConfirmationEmail, type GuestMailer } from '../guestEmail.js';
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
  /** Missing until Stripe is set up. Every webhook is refused while it is. */
  stripeWebhookSecret?: string;
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
  /** Sends the guest their confirmation. Left out until a sender address is set up. */
  guestMail?: GuestMailer;
  /** Shown to guests in their confirmation email. */
  contact?: { phone?: string; email?: string };
  secrets: Secrets;
  /** Dynamic prices from PriceLabs. Left out until the API key is saved; plans then use their own rates. */
  rates?: { client: PriceLabsClient; store: RateStore };
  now?(): Date;
  fetchImpl?: typeof fetch;
}

export interface GuestTrip {
  bookingId: string;
  homeId: string;
  homeName: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  totalCents: number;
  currency: 'usd';
  confirmedAt: string;
  status: 'upcoming' | 'past' | 'cancelled';
  /** How much of the payment went back to the guest, for a cancelled trip. */
  refundCents?: number;
  /** The guest's review of this stay, once written. */
  review?: { rating: number; comment: string };
}

export interface GuestAccount {
  email: string;
  /** From the guest's most recent booking, to fill in checkout. */
  name?: string;
  phone?: string;
  trips: GuestTrip[];
  /** Home ids the guest has saved. */
  saved: string[];
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

  /** The home's rate plan with PriceLabs prices laid over it, when fresh ones are saved. */
  async planFor(home: HomeConfig): Promise<RatePlan> {
    const stored = await this.deps.rates?.store.load(home.id);
    if (!stored || this.now().getTime() - Date.parse(stored.updatedAt) > RATES_MAX_AGE_MS) return home.plan;
    return { ...home.plan, nightlyOverrides: { ...home.plan.nightlyOverrides, ...stored.overrides } };
  }

  /** The scheduled rate sync: reads PriceLabs prices for every home it can match by name. */
  async syncRates() {
    const rates = this.deps.rates;
    if (!rates) return { skipped: 'PriceLabs is not set up' };
    const { matched, unmatched } = matchListings(this.deps.homes, await rates.client.listings());
    const failed: string[] = [];
    let saved = 0;
    for (const [homeId, listing] of matched) {
      const home = this.home(homeId)!;
      const today = this.today(home);
      try {
        const prices = await rates.client.prices(listing, today, addDays(today, home.plan.bookingWindowDays + home.plan.maxNights));
        if (prices.error || (prices.currency && prices.currency.toUpperCase() !== 'USD')) throw new Error(prices.error ?? `currency ${prices.currency}`);
        const overrides = toOverrides(prices);
        if (!Object.keys(overrides).length) throw new Error('no prices');
        await rates.store.save(homeId, { overrides, updatedAt: this.now().toISOString() });
        saved++;
      } catch (err) {
        console.error('Rate sync failed', homeId, err);
        failed.push(`${home.name} (${err instanceof Error ? err.message : String(err)})`);
      }
    }
    if (failed.length) await this.deps.alerts.send('PriceLabs rates not updating', `Could not read PriceLabs prices for: ${failed.join(', ')}. Those homes keep their last prices for up to 2 days, then fall back to the standard rates.`);
    return { saved, failed, unmatched };
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

  /** A signed-in guest's trips, newest first, and the details their last booking used. */
  async account(email: string): Promise<ApiResult<GuestAccount>> {
    const bookings = await this.deps.holds.bookingsByEmail(email);
    const mine = new Map<string, Review>();
    for (const id of new Set(bookings.map((b) => b.homeId))) for (const r of await this.deps.holds.reviews(id)) mine.set(r.bookingId, r);
    const trips = bookings.map((b): GuestTrip => {
      const home = this.home(b.homeId);
      return {
        bookingId: b.id,
        homeId: b.homeId,
        homeName: home?.name ?? b.homeId,
        checkIn: b.quote.checkIn,
        checkOut: b.quote.checkOut,
        guests: b.quote.guests,
        totalCents: b.quote.total,
        currency: b.quote.currency,
        confirmedAt: b.confirmedAt,
        review: mine.has(b.id) ? { rating: mine.get(b.id)!.rating, comment: mine.get(b.id)!.comment } : undefined,
        refundCents: b.cancelledAt ? b.refundCents ?? 0 : undefined,
        status: b.cancelledAt ? 'cancelled' : b.quote.checkOut >= (home ? this.today(home) : dateInTimeZone(this.now(), 'America/Chicago')) ? 'upcoming' : 'past',
      };
    });
    const last = bookings.slice().sort((a, b) => b.confirmedAt.localeCompare(a.confirmedAt))[0];
    const saved = (await this.deps.holds.wishlist(email)).filter((id) => this.home(id));
    return { status: 200, body: { email, name: last?.guest.name, phone: last?.guest.phone, trips, saved } };
  }

  /** The refund for cancelling today: all of it 5 or more days before check-in, half under 5 days, none once the stay has begun. */
  refundFor(booking: Booking, home: HomeConfig): number {
    const days = Math.round((Date.parse(`${booking.quote.checkIn}T00:00:00Z`) - Date.parse(`${this.today(home)}T00:00:00Z`)) / 86_400_000);
    if (days < 1) return 0;
    return days >= 5 ? booking.quote.total : Math.floor(booking.quote.total / 2);
  }

  /** A guest cancels one of their own upcoming bookings: the dates reopen and the refund is sent to their card. */
  async cancelBooking(email: string, bookingId: unknown): Promise<ApiResult<{ refundCents: number } | { error: string }>> {
    const booking = (await this.deps.holds.bookingsByEmail(email)).find((b) => b.id === bookingId);
    if (!booking) return { status: 404, body: { error: 'unknown-booking' } };
    const home = this.home(booking.homeId);
    if (!home) return { status: 404, body: { error: 'unknown-home' } };
    if (booking.cancelledAt) return { status: 409, body: { error: 'already-cancelled' } };
    if (booking.quote.checkIn <= this.today(home)) return { status: 409, body: { error: 'stay-started' } };
    const refundCents = this.refundFor(booking, home);
    // The refund goes first: if it fails nothing has changed and the guest can try again. Its key makes a retry safe.
    if (refundCents > 0) await this.deps.payments.refund(booking.paymentId, refundCents, `refund-${booking.id}`);
    await this.deps.holds.saveBooking({ ...booking, cancelledAt: this.now().toISOString(), refundCents });
    await this.deps.nights.release(booking.homeId, booking.quote.checkIn, booking.quote.checkOut, booking.holdId);
    await this.deps.alerts.send(
      `Booking cancelled: ${home.name}`,
      `${booking.guest.name} (${booking.guest.email}) cancelled ${booking.id}, ${booking.quote.checkIn} to ${booking.quote.checkOut}. Refund sent: ${formatUsd(refundCents)} of ${formatUsd(booking.quote.total)}. The dates are open again on the website and in the export calendar.`,
    );
    return { status: 200, body: { refundCents } };
  }

  /** Public reviews of a home, newest first, with the average rating. Guest emails never leave the server. */
  async reviews(homeId: string): Promise<ApiResult<{ count: number; average: number | null; reviews: Array<{ name: string; rating: number; comment: string; date: string }> } | { error: string }>> {
    if (!this.home(homeId)) return { status: 404, body: { error: 'unknown-home' } };
    const all = await this.deps.holds.reviews(homeId);
    const average = all.length ? Math.round((all.reduce((s, r) => s + r.rating, 0) / all.length) * 10) / 10 : null;
    return { status: 200, body: { count: all.length, average, reviews: all.map((r) => ({ name: r.name, rating: r.rating, comment: r.comment, date: r.createdAt.slice(0, 10) })) } };
  }

  /** A guest reviews one of their own stays, once it has ended. */
  async submitReview(email: string, input: { bookingId?: unknown; rating?: unknown; comment?: unknown } | undefined): Promise<ApiResult<{ ok: true } | { error: string }>> {
    const rating = input?.rating;
    const comment = typeof input?.comment === 'string' ? input.comment.trim() : '';
    if (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 5 || comment.length > 1000) return { status: 400, body: { error: 'bad-review' } };
    const booking = (await this.deps.holds.bookingsByEmail(email)).find((b) => b.id === input?.bookingId);
    if (!booking) return { status: 404, body: { error: 'unknown-booking' } };
    const home = this.home(booking.homeId);
    if (!home || booking.quote.checkOut >= this.today(home)) return { status: 409, body: { error: 'stay-not-finished' } };
    const [first = 'Guest', ...rest] = booking.guest.name.trim().split(/\s+/);
    const name = rest.length ? `${first} ${rest[rest.length - 1]![0]!.toUpperCase()}.` : first;
    await this.deps.holds.saveReview({ bookingId: booking.id, homeId: booking.homeId, name, rating, comment, createdAt: this.now().toISOString() });
    return { status: 200, body: { ok: true } };
  }

  /** Replaces the guest's saved homes. Unknown homes are dropped, repeats removed, and the list is capped. */
  async saveWishlist(email: string, input: unknown): Promise<ApiResult<{ saved: string[] }>> {
    const ids = Array.isArray(input) ? input : [];
    const saved = [...new Set(ids.filter((id): id is string => typeof id === 'string' && !!this.home(id)))].slice(0, 100);
    await this.deps.holds.saveWishlist(email, saved);
    return { status: 200, body: { saved } };
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
    const result = quoteStay(await this.planFor(home), stay, await this.knownBlocks(home), this.today(home));
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

  /** The guest's confirmation. A failure here is reported to the owner and never undoes the booking. */
  private async emailGuest(b: Parameters<Notifier['bookingConfirmed']>[0], homeName: string): Promise<void> {
    if (!this.deps.guestMail) return;
    try {
      const mail = bookingConfirmationEmail(b, homeName, this.deps.contact);
      await this.deps.guestMail.send(b.guest.email, mail.subject, mail.text);
    } catch (err) {
      await this.deps.alerts
        .send(`Confirmation email not sent for ${b.id}`, `The booking is confirmed, but the email to ${b.guest.email} failed: ${err instanceof Error ? err.message : String(err)}`)
        .catch(() => {});
    }
  }

  private readonly notifier: Notifier = {
    bookingConfirmed: async (b) => {
      const home = this.home(b.homeId);
      await this.emailGuest(b, home?.name ?? b.homeId);
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
      ratePlan: async (homeId) => {
        const home = this.home(homeId);
        return home && this.planFor(home);
      },
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
    const secret = this.deps.secrets.stripeWebhookSecret;
    // Never check a signature against an empty secret: anyone could forge one.
    if (!secret) return { status: 503, body: { received: false, error: 'payments-not-configured' } };
    if (!verifyStripeSignature(rawBody, signature, secret, this.now())) {
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
