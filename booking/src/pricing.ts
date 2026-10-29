import { addDays, assertIsoDate, eachNight } from './dates.js';
import type { Block } from './types.js';

/** Money is always whole US cents, so totals never pick up rounding drift. */
export type Cents = number;

export interface SeasonalRate {
  /** First night the rate applies to. */
  start: string;
  /** Night after the last one (exclusive), like a check-out date. */
  end: string;
  nightly: Cents;
  weekendNightly?: Cents;
  minStay?: number;
  label?: string;
}

export interface TaxRate {
  name: string;
  /** Basis points: 600 = 6%. */
  rateBps: number;
  /** Which charges the tax applies to. */
  appliesTo: Array<'nights' | 'cleaning' | 'extraGuests' | 'pets'>;
}

/**
 * Everything needed to price a stay at one home. Prices synced from
 * PriceLabs go in `nightlyOverrides` and win over the plan's own rates.
 */
export interface RatePlan {
  baseNightly: Cents;
  /** Friday and Saturday nights. Falls back to the base rate. */
  weekendNightly?: Cents;
  seasons?: SeasonalRate[];
  nightlyOverrides?: Record<string, { nightly: Cents; minStay?: number }>;
  minStay: number;
  maxNights: number;
  /** Days of notice needed before check-in. 0 allows same-day bookings. */
  minNoticeDays: number;
  /** How far ahead guests can book, in days. */
  bookingWindowDays: number;
  cleaningFee: Cents;
  /** Per stay, charged once if any pets come. Undefined means no pets allowed. */
  petFee?: Cents;
  maxGuests: number;
  /** Guests included in the nightly rate. */
  includedGuests: number;
  /** Per extra guest, per night. */
  extraGuestNightly?: Cents;
  /** 0 = Sunday … 6 = Saturday. Empty or undefined means any day. */
  checkInDays?: number[];
  checkOutDays?: number[];
  taxes: TaxRate[];
}

export interface StayRequest {
  checkIn: string;
  checkOut: string;
  guests: number;
  pets?: number;
}

export interface NightPrice {
  date: string;
  nightly: Cents;
}

export interface Charge {
  label: string;
  amount: Cents;
}

export interface Quote {
  checkIn: string;
  checkOut: string;
  guests: number;
  pets: number;
  nights: NightPrice[];
  nightsTotal: Cents;
  fees: Charge[];
  taxes: Charge[];
  total: Cents;
  currency: 'usd';
}

export type QuoteProblem =
  | 'invalid-dates'
  | 'too-soon'
  | 'too-far-ahead'
  | 'too-short'
  | 'too-long'
  | 'check-in-day'
  | 'check-out-day'
  | 'too-many-guests'
  | 'no-pets'
  | 'unavailable';

export type QuoteResult = { ok: true; quote: Quote } | { ok: false; problem: QuoteProblem; message: string; conflicts?: Block[] };

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function weekday(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/** Friday and Saturday nights are the weekend. */
function isWeekendNight(date: string): boolean {
  const d = weekday(date);
  return d === 5 || d === 6;
}

/** The price and minimum stay for one night. Later seasons in the list win over earlier ones. */
export function priceNight(plan: RatePlan, date: string): { nightly: Cents; minStay: number } {
  const override = plan.nightlyOverrides?.[date];
  if (override) return { nightly: override.nightly, minStay: override.minStay ?? plan.minStay };

  const weekend = isWeekendNight(date);
  const season = [...(plan.seasons ?? [])].reverse().find((s) => s.start <= date && date < s.end);
  if (season) {
    const nightly = weekend && season.weekendNightly !== undefined ? season.weekendNightly : season.nightly;
    return { nightly, minStay: season.minStay ?? plan.minStay };
  }
  const nightly = weekend && plan.weekendNightly !== undefined ? plan.weekendNightly : plan.baseNightly;
  return { nightly, minStay: plan.minStay };
}

/** Rounds half up to whole cents. */
function percentOf(amount: Cents, bps: number): Cents {
  return Math.floor((amount * bps + 5_000) / 10_000);
}

const fail = (problem: QuoteProblem, message: string, conflicts?: Block[]): QuoteResult => ({ ok: false, problem, message, conflicts });

/**
 * Prices a stay and checks every booking rule. `blocks` are the home's
 * unavailable dates from all calendars; `today` is the date at the home.
 */
export function quoteStay(plan: RatePlan, stay: StayRequest, blocks: Block[], today: string): QuoteResult {
  try {
    assertIsoDate(stay.checkIn);
    assertIsoDate(stay.checkOut);
  } catch {
    return fail('invalid-dates', 'Choose a check-in and check-out date.');
  }
  if (stay.checkOut <= stay.checkIn) return fail('invalid-dates', 'Check-out needs to be after check-in.');
  if (!Number.isInteger(stay.guests) || stay.guests < 1) return fail('too-many-guests', 'Enter the number of guests.');

  const pets = stay.pets ?? 0;
  if (!Number.isInteger(pets) || pets < 0) return fail('no-pets', 'Enter the number of pets.');
  const notice = daysBetween(today, stay.checkIn);
  if (notice < plan.minNoticeDays) {
    return fail(
      'too-soon',
      plan.minNoticeDays === 1
        ? 'Online bookings need at least a day’s notice. Call us for same-day stays.'
        : `Online bookings need at least ${plan.minNoticeDays} days’ notice. Call us for sooner stays.`,
    );
  }
  if (notice > plan.bookingWindowDays) return fail('too-far-ahead', 'Those dates aren’t open for booking yet.');

  const nightsCount = daysBetween(stay.checkIn, stay.checkOut);
  if (nightsCount > plan.maxNights) return fail('too-long', `Online bookings are up to ${plan.maxNights} nights. Contact us for longer stays.`);

  if (plan.checkInDays?.length && !plan.checkInDays.includes(weekday(stay.checkIn))) {
    return fail('check-in-day', `Check-in is on ${plan.checkInDays.map((d) => DAY_NAMES[d]).join(' or ')} for these dates.`);
  }
  if (plan.checkOutDays?.length && !plan.checkOutDays.includes(weekday(stay.checkOut))) {
    return fail('check-out-day', `Check-out is on ${plan.checkOutDays.map((d) => DAY_NAMES[d]).join(' or ')} for these dates.`);
  }

  if (stay.guests > plan.maxGuests) return fail('too-many-guests', `This home sleeps up to ${plan.maxGuests} guests.`);
  if (pets > 0 && plan.petFee === undefined) return fail('no-pets', 'Pets aren’t allowed at this home.');

  const conflicts = blocks.filter((b) => b.start < stay.checkOut && b.end > stay.checkIn);
  if (conflicts.length) return fail('unavailable', 'Some of those nights are already booked.', conflicts);

  const nights = eachNight(stay.checkIn, stay.checkOut).map((date) => ({ date, ...priceNight(plan, date) }));
  // The minimum stay is set by the arrival night, the way Airbnb and PriceLabs apply it.
  const minStay = nights[0]!.minStay;
  if (nightsCount < minStay) return fail('too-short', `The minimum stay for these dates is ${minStay} nights.`);

  const nightsTotal = nights.reduce((sum, n) => sum + n.nightly, 0);
  const fees: Charge[] = [];
  const base: Record<TaxRate['appliesTo'][number], Cents> = { nights: nightsTotal, cleaning: 0, extraGuests: 0, pets: 0 };

  if (plan.cleaningFee > 0) {
    fees.push({ label: 'Cleaning fee', amount: plan.cleaningFee });
    base.cleaning = plan.cleaningFee;
  }
  const extraGuests = Math.max(0, stay.guests - plan.includedGuests);
  if (extraGuests > 0 && plan.extraGuestNightly) {
    const amount = extraGuests * plan.extraGuestNightly * nightsCount;
    fees.push({ label: `Extra guests (${extraGuests} × ${nightsCount} nights)`, amount });
    base.extraGuests = amount;
  }
  if (pets > 0 && plan.petFee) {
    fees.push({ label: 'Pet fee', amount: plan.petFee });
    base.pets = plan.petFee;
  }

  const taxes = plan.taxes.map((t) => {
    const taxable = t.appliesTo.reduce((sum, k) => sum + base[k], 0);
    return { label: t.name, amount: percentOf(taxable, t.rateBps) };
  });

  const total = nightsTotal + fees.reduce((s, f) => s + f.amount, 0) + taxes.reduce((s, t) => s + t.amount, 0);
  return {
    ok: true,
    quote: {
      checkIn: stay.checkIn,
      checkOut: stay.checkOut,
      guests: stay.guests,
      pets,
      nights: nights.map(({ date, nightly }) => ({ date, nightly })),
      nightsTotal,
      fees,
      taxes,
      total,
      currency: 'usd',
    },
  };
}

/** Formats cents as dollars for display, e.g. 123456 → "$1,234.56". */
export function formatUsd(amount: Cents): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount / 100);
}

/** The last night of a stay, handy for display. */
export function lastNight(quote: Pick<Quote, 'checkOut'>): string {
  return addDays(quote.checkOut, -1);
}
