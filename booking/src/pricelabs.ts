import type { Cents } from './pricing.js';

/** Nightly prices and minimum stays read from PriceLabs, keyed by night. */
export type RateOverrides = Record<string, { nightly: Cents; minStay?: number }>;

export interface StoredRates {
  overrides: RateOverrides;
  /** ISO time of the last successful read. Old rates are ignored, so a broken sync falls back to the plan. */
  updatedAt: string;
}

export interface RateStore {
  load(homeId: string): Promise<StoredRates | undefined>;
  save(homeId: string, rates: StoredRates): Promise<void>;
}

export class InMemoryRateStore implements RateStore {
  private readonly data = new Map<string, StoredRates>();
  async load(homeId: string) {
    return structuredClone(this.data.get(homeId));
  }
  async save(homeId: string, rates: StoredRates) {
    this.data.set(homeId, structuredClone(rates));
  }
}

export interface PriceLabsListing {
  id: string;
  pms: string;
  name: string;
  propertyName: string;
}

export interface PriceLabsDay {
  date: string;
  price?: number;
  minStay?: number;
}

export interface PriceLabsPrices {
  currency: string;
  days: PriceLabsDay[];
  error?: string;
}

/** The part of the PriceLabs Customer API this site uses (https://developers.pricelabs.co). */
export class PriceLabsClient {
  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly base = 'https://api.pricelabs.co',
  ) {}

  private async call(path: string, init?: RequestInit): Promise<unknown> {
    const res = await this.fetchImpl(`${this.base}${path}`, {
      ...init,
      headers: { 'X-API-Key': this.apiKey, 'content-type': 'application/json' },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`PriceLabs answered ${res.status}`);
    return res.json();
  }

  async listings(): Promise<PriceLabsListing[]> {
    const body = (await this.call('/v1/listings_minimal')) as { listings?: Array<Record<string, unknown>> };
    return (body.listings ?? []).map((l) => ({
      id: String(l.listing_id ?? l.id ?? ''),
      pms: String(l.pms_name ?? l.pms ?? ''),
      name: String(l.listing_name ?? l.name ?? ''),
      propertyName: String(l.property_name ?? ''),
    }));
  }

  async prices(listing: Pick<PriceLabsListing, 'id' | 'pms'>, dateFrom: string, dateTo: string): Promise<PriceLabsPrices> {
    const body = (await this.call('/v1/listing_prices', {
      method: 'POST',
      body: JSON.stringify({ listings: [{ id: listing.id, pms: listing.pms, dateFrom, dateTo }] }),
    })) as Array<{ currency?: string; error?: string; error_status?: string; data?: Array<Record<string, unknown>> }>;
    const first = body[0];
    if (!first) return { currency: '', days: [], error: 'empty answer' };
    return {
      currency: first.currency ?? '',
      error: first.error ? `${first.error}${first.error_status ? ` (${first.error_status})` : ''}` : first.error_status,
      days: (first.data ?? []).map((d) => ({
        date: String(d.date),
        price: typeof d.price === 'number' ? d.price : undefined,
        minStay: typeof d.min_stay === 'number' ? d.min_stay : undefined,
      })),
    };
  }
}

/** Extra words that identify a home when its PriceLabs name is spelled differently from ours. */
const ALIASES: Record<string, string[]> = { '21634-longwood': ['21634'], 'oat-st': ['4612oats'] };

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Finds each home's PriceLabs listing by name. A listing matches when its name or property name
 * contains the home's name (or the other way round) once capitals and punctuation are ignored.
 * A name that matches more than one listing is left out, because guessing would price the wrong home.
 */
export function matchListings(homes: Array<{ id: string; name: string }>, listings: PriceLabsListing[]) {
  const matched = new Map<string, PriceLabsListing>();
  const unmatched: string[] = [];
  for (const home of homes) {
    const keys = [norm(home.name), norm(home.id), ...(ALIASES[home.id] ?? [])].filter((k) => k.length >= 4);
    const hits = listings.filter((l) => [norm(l.name), norm(l.propertyName)].some((n) => n && keys.some((k) => n.includes(k) || k.includes(n))));
    // A home listed on both Airbnb and VRBO shows up twice; the Airbnb listing is the one we price from.
    const airbnb = hits.filter((l) => l.pms.toLowerCase().includes('airbnb'));
    const pick = hits.length === 1 ? hits[0] : airbnb.length === 1 ? airbnb[0] : undefined;
    if (pick) matched.set(home.id, pick);
    else unmatched.push(`${home.name}${hits.length > 1 ? ` (${hits.length} listings match: ${hits.map((l) => `${l.name} [${l.pms}]`).join('; ')})` : ''}`);
  }
  return { matched, unmatched };
}

/** Turns PriceLabs prices into per-night overrides in US cents. Days without a usable price are left out. */
export function toOverrides(prices: PriceLabsPrices): RateOverrides {
  const out: RateOverrides = {};
  for (const d of prices.days) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date) || typeof d.price !== 'number' || !(d.price > 0)) continue;
    out[d.date] = { nightly: Math.round(d.price * 100), ...(d.minStay && d.minStay > 0 ? { minStay: Math.round(d.minStay) } : {}) };
  }
  return out;
}

/** Rates older than this are ignored. */
export const RATES_MAX_AGE_MS = 48 * 3_600_000;
