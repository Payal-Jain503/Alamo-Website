import { randomUUID } from 'node:crypto';
import type { NightStore } from './holds.js';
import { quoteStay, type Quote, type RatePlan } from './pricing.js';
import { verifyQuote, type SignedQuote } from './signedQuote.js';
import type { Block } from './types.js';

export const HOLD_MINUTES = 15;
/** Extra time before the sweeper cancels a hold, so a payment that is in flight can still land. */
export const SWEEP_GRACE_MINUTES = 5;

export interface Guest {
  name: string;
  email: string;
  phone?: string;
}

export type HoldStatus = 'awaiting-payment' | 'confirmed' | 'released';

export interface Hold {
  id: string;
  homeId: string;
  quote: Quote;
  guest: Guest;
  paymentId?: string;
  status: HoldStatus;
  releaseReason?: ReleaseReason;
  createdAt: string;
  expiresAt: string;
  bookingId?: string;
}

export interface Booking {
  id: string;
  holdId: string;
  homeId: string;
  quote: Quote;
  guest: Guest;
  paymentId: string;
  confirmedAt: string;
}

export type ReleaseReason = 'payment-failed' | 'calendar-conflict' | 'calendar-unavailable' | 'amount-mismatch' | 'expired' | 'capture-failed';

/** The card side of checkout. The Stripe adapter implements this. */
export interface PaymentGateway {
  /** Authorises the amount on the guest's card without charging it. */
  authorize(input: { amount: number; currency: 'usd'; holdId: string; homeId: string; email: string; idempotencyKey: string }): Promise<{ paymentId: string; clientSecret: string }>;
  capture(paymentId: string, idempotencyKey: string): Promise<void>;
  /** Drops the authorisation, so nothing is charged. Safe to call more than once. */
  cancel(paymentId: string, idempotencyKey: string): Promise<void>;
}

/**
 * Airbnb and VRBO dates for a home, read live from their feeds.
 * `fresh: false` means a feed couldn't be read just now.
 */
export interface LiveCalendar {
  externalBlocks(homeId: string): Promise<{ fresh: boolean; blocks: Block[] }>;
}

export interface HoldRepository {
  save(hold: Hold): Promise<void>;
  get(id: string): Promise<Hold | undefined>;
  /** Holds still waiting for payment whose time ran out before `before`. */
  expired(before: Date): Promise<Hold[]>;
  saveBooking(booking: Booking): Promise<void>;
}

export interface Notifier {
  bookingConfirmed(booking: Booking): Promise<void>;
  /** Tells the guest their card was not charged, and the owner why. */
  holdReleased(hold: Hold, reason: ReleaseReason): Promise<void>;
}

export interface CheckoutDeps {
  nights: NightStore;
  payments: PaymentGateway;
  calendar: LiveCalendar;
  holds: HoldRepository;
  notify: Notifier;
  ratePlan(homeId: string): Promise<RatePlan | undefined>;
  quoteSecret: string;
  /** Today's date at the homes, YYYY-MM-DD. */
  today(): string;
  now(): Date;
  newId?(): string;
}

export type StartResult =
  | { ok: true; holdId: string; clientSecret: string; expiresAt: string }
  | { ok: false; problem: 'quote-tampered' | 'quote-expired' | 'unknown-home' | 'invalid-guest' | 'calendar-unavailable' | 'payment-failed' }
  | { ok: false; problem: 'unavailable' | 'rules'; message: string }
  | { ok: false; problem: 'price-changed'; quote: Quote }
  | { ok: false; problem: 'dates-taken'; takenNights: string[] };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Step 1, when the guest presses Reserve: re-check the calendars live,
 * re-price, hold the nights and authorise the card.
 */
export async function startCheckout(deps: CheckoutDeps, input: { signed: SignedQuote; guest: Guest }): Promise<StartResult> {
  const now = deps.now();
  const verified = verifyQuote(input.signed, deps.quoteSecret, now);
  if (!verified.ok) return { ok: false, problem: verified.reason === 'expired' ? 'quote-expired' : 'quote-tampered' };

  const guest = { name: input.guest.name?.trim(), email: input.guest.email?.trim(), phone: input.guest.phone?.trim() || undefined };
  if (!guest.name || !guest.email || !EMAIL.test(guest.email)) return { ok: false, problem: 'invalid-guest' };

  const { homeId, quote: offered } = input.signed;
  const plan = await deps.ratePlan(homeId);
  if (!plan) return { ok: false, problem: 'unknown-home' };

  const live = await deps.calendar.externalBlocks(homeId);
  if (!live.fresh) return { ok: false, problem: 'calendar-unavailable' };

  const requote = quoteStay(plan, { checkIn: offered.checkIn, checkOut: offered.checkOut, guests: offered.guests, pets: offered.pets }, live.blocks, deps.today());
  if (!requote.ok) {
    return requote.problem === 'unavailable'
      ? { ok: false, problem: 'unavailable', message: requote.message }
      : { ok: false, problem: 'rules', message: requote.message };
  }
  if (requote.quote.total !== offered.total) return { ok: false, problem: 'price-changed', quote: requote.quote };

  const holdId = deps.newId?.() ?? `h_${randomUUID()}`;
  const expiresAt = new Date(now.getTime() + HOLD_MINUTES * 60_000);
  const claim = await deps.nights.claim(homeId, offered.checkIn, offered.checkOut, holdId, expiresAt, now);
  if (!claim.ok) return { ok: false, problem: 'dates-taken', takenNights: claim.takenNights };

  const hold: Hold = {
    id: holdId,
    homeId,
    quote: requote.quote,
    guest: guest as Guest,
    status: 'awaiting-payment',
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  let payment: { paymentId: string; clientSecret: string };
  try {
    payment = await deps.payments.authorize({
      amount: requote.quote.total,
      currency: 'usd',
      holdId,
      homeId,
      email: guest.email,
      idempotencyKey: `authorize-${holdId}`,
    });
  } catch {
    await deps.nights.release(homeId, offered.checkIn, offered.checkOut, holdId);
    return { ok: false, problem: 'payment-failed' };
  }

  await deps.holds.save({ ...hold, paymentId: payment.paymentId });
  return { ok: true, holdId, clientSecret: payment.clientSecret, expiresAt: hold.expiresAt };
}

export type ConfirmResult =
  | { ok: true; booking: Booking; alreadyConfirmed?: boolean }
  | { ok: false; reason: ReleaseReason | 'unknown-hold' | 'already-released' };

async function releaseHold(deps: CheckoutDeps, hold: Hold, reason: ReleaseReason): Promise<void> {
  if (hold.paymentId) await deps.payments.cancel(hold.paymentId, `cancel-${hold.id}`);
  await deps.nights.release(hold.homeId, hold.quote.checkIn, hold.quote.checkOut, hold.id);
  await deps.holds.save({ ...hold, status: 'released', releaseReason: reason });
  await deps.notify.holdReleased(hold, reason);
}

/**
 * Step 2, when Stripe reports the card is authorised: read Airbnb and VRBO
 * once more, then book and charge, or release and charge nothing.
 * Stripe can send the same event more than once, so this is safe to repeat.
 */
export async function confirmPayment(deps: CheckoutDeps, event: { holdId: string; paymentId: string; amount: number }): Promise<ConfirmResult> {
  const hold = await deps.holds.get(event.holdId);
  if (!hold) return { ok: false, reason: 'unknown-hold' };

  if (hold.status === 'confirmed') {
    return { ok: true, alreadyConfirmed: true, booking: { id: hold.bookingId!, holdId: hold.id, homeId: hold.homeId, quote: hold.quote, guest: hold.guest, paymentId: hold.paymentId!, confirmedAt: '' } };
  }
  if (hold.status === 'released') {
    // The hold was given up (for example it expired), so make sure the card is not charged.
    await deps.payments.cancel(event.paymentId, `cancel-${hold.id}`);
    return { ok: false, reason: 'already-released' };
  }
  if (event.paymentId !== hold.paymentId || event.amount !== hold.quote.total) {
    await releaseHold(deps, hold, 'amount-mismatch');
    return { ok: false, reason: 'amount-mismatch' };
  }

  const live = await deps.calendar.externalBlocks(hold.homeId);
  if (!live.fresh) {
    await releaseHold(deps, hold, 'calendar-unavailable');
    return { ok: false, reason: 'calendar-unavailable' };
  }
  const { checkIn, checkOut } = hold.quote;
  if (live.blocks.some((b) => b.start < checkOut && b.end > checkIn)) {
    await releaseHold(deps, hold, 'calendar-conflict');
    return { ok: false, reason: 'calendar-conflict' };
  }

  const bookingId = `AC-${hold.id.slice(-8).toUpperCase()}`;
  if (!(await deps.nights.confirm(hold.homeId, checkIn, checkOut, hold.id, bookingId))) {
    await releaseHold(deps, hold, 'calendar-conflict');
    return { ok: false, reason: 'calendar-conflict' };
  }

  try {
    await deps.payments.capture(hold.paymentId!, `capture-${hold.id}`);
  } catch {
    await releaseHold(deps, hold, 'capture-failed');
    return { ok: false, reason: 'capture-failed' };
  }

  const booking: Booking = {
    id: bookingId,
    holdId: hold.id,
    homeId: hold.homeId,
    quote: hold.quote,
    guest: hold.guest,
    paymentId: hold.paymentId!,
    confirmedAt: deps.now().toISOString(),
  };
  await deps.holds.saveBooking(booking);
  await deps.holds.save({ ...hold, status: 'confirmed', bookingId });
  await deps.notify.bookingConfirmed(booking);
  return { ok: true, booking };
}

/** Stripe reports the payment failed or the guest gave up: free the nights. */
export async function paymentFailed(deps: CheckoutDeps, holdId: string): Promise<void> {
  const hold = await deps.holds.get(holdId);
  if (hold?.status === 'awaiting-payment') await releaseHold(deps, hold, 'payment-failed');
}

/** Runs every few minutes: releases holds whose time ran out and cancels their card authorisations. */
export async function sweepExpiredHolds(deps: CheckoutDeps): Promise<number> {
  const cutoff = new Date(deps.now().getTime() - SWEEP_GRACE_MINUTES * 60_000);
  const expired = await deps.holds.expired(cutoff);
  for (const hold of expired) await releaseHold(deps, hold, 'expired');
  return expired.length;
}

/** A confirmed booking as a block on our export calendar, so Airbnb and VRBO close the same nights. */
export function bookingBlock(booking: Booking): Block {
  return { source: 'direct', kind: 'reservation', uid: booking.id, start: booking.quote.checkIn, end: booking.quote.checkOut, summary: 'Reserved' };
}

/** In-memory hold storage for tests and local runs. Production uses DynamoDB. */
export class InMemoryHoldRepository implements HoldRepository {
  readonly holdsById = new Map<string, Hold>();
  readonly bookings = new Map<string, Booking>();

  async save(hold: Hold) {
    this.holdsById.set(hold.id, structuredClone(hold));
  }
  async get(id: string) {
    const h = this.holdsById.get(id);
    return h && structuredClone(h);
  }
  async expired(before: Date) {
    return [...this.holdsById.values()].filter((h) => h.status === 'awaiting-payment' && Date.parse(h.expiresAt) < before.getTime()).map((h) => structuredClone(h));
  }
  async saveBooking(booking: Booking) {
    this.bookings.set(booking.id, structuredClone(booking));
  }
}
