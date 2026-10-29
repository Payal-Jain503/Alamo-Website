/**
 * Calls to the booking API, which CloudFront serves on the same address as
 * the site under /api/. Shapes match booking/src/server/service.ts.
 */

export interface Charge {
  label: string;
  amount: number;
}

export interface Quote {
  checkIn: string;
  checkOut: string;
  guests: number;
  pets: number;
  nights: { date: string; nightly: number }[];
  nightsTotal: number;
  fees: Charge[];
  taxes: Charge[];
  total: number;
  currency: 'usd';
}

export interface SignedQuote {
  homeId: string;
  quote: Quote;
  expiresAt: string;
  signature: string;
}

export interface Guest {
  name: string;
  email: string;
  phone?: string;
}

export type ReserveResult =
  | { ok: true; holdId: string; clientSecret: string; expiresAt: string }
  | { ok: false; problem: string; message?: string; quote?: Quote; takenNights?: string[] };

export type HoldStatus = { status: 'awaiting-payment' | 'confirming' | 'confirmed' | 'released'; bookingId?: string; reason?: string };

/** The Stripe key that is safe to publish. Online booking stays off until it is set at build time. */
export const STRIPE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';

async function call<T>(path: string, init?: RequestInit): Promise<{ status: number; body: T }> {
  const res = await fetch(path, { ...init, headers: { 'content-type': 'application/json', ...init?.headers }, cache: 'no-store' });
  const type = res.headers.get('content-type') ?? '';
  // Without the API (local preview, or before launch) the site answers with an HTML page instead.
  if (!type.includes('application/json')) throw new Error(`Booking API unavailable (${res.status})`);
  return { status: res.status, body: (await res.json()) as T };
}

export async function getAvailability(homeId: string): Promise<Set<string>> {
  const { status, body } = await call<{ blocked?: string[] }>(`/api/availability?home=${encodeURIComponent(homeId)}`);
  if (status !== 200 || !body.blocked) throw new Error('No online booking for this home');
  return new Set(body.blocked);
}

export async function getQuote(input: { homeId: string; checkIn: string; checkOut: string; guests: number }) {
  return call<{ signed?: SignedQuote; error?: string; message?: string }>('/api/quote', { method: 'POST', body: JSON.stringify(input) });
}

export async function reserve(signed: SignedQuote, guest: Guest) {
  return (await call<ReserveResult>('/api/reserve', { method: 'POST', body: JSON.stringify({ signed, guest }) })).body;
}

export async function getHold(holdId: string) {
  return (await call<HoldStatus>(`/api/hold?id=${encodeURIComponent(holdId)}`)).body;
}

export function usd(cents: number) {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

/** Today at the homes, which are all in Texas. */
export function todayInTexas() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(new Date());
}

export function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** What a guest reads when checkout stops. */
export function problemMessage(problem: string, message?: string): string {
  switch (problem) {
    case 'dates-taken':
    case 'unavailable':
      return 'Someone has just booked some of these nights. Please choose other dates.';
    case 'calendar-unavailable':
      return 'We can’t confirm these dates with our other booking sites right now. Please try again in a few minutes, or call us.';
    case 'quote-expired':
      return 'Your price was held for 30 minutes and has expired. We’ve fetched it again.';
    case 'price-changed':
      return 'The price for these dates has just changed. Please check the new total.';
    case 'invalid-guest':
      return 'Please enter your name and a valid email address.';
    case 'payment-failed':
      return 'We couldn’t start the card payment. Nothing was charged. Please try again.';
    case 'calendar-conflict':
      return 'These dates were booked elsewhere while you were paying.';
    case 'expired':
      return 'The 15 minutes to pay ran out, so the dates were released.';
    default:
      return message ?? 'Something went wrong. Nothing was charged. Please try again or call us.';
  }
}

/** "Fri, Nov 13" from 2026-11-13. */
export function shortDate(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
}
