import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Quote } from './pricing.js';

/**
 * A quote the browser carries to checkout. The signature means a guest
 * can't edit the price or dates on the way; checkout still re-checks
 * availability and re-prices before any payment.
 */
export interface SignedQuote {
  homeId: string;
  quote: Quote;
  /** ISO time after which the quote must be re-priced. */
  expiresAt: string;
  signature: string;
}

export const QUOTE_LIFETIME_MS = 30 * 60 * 1000;

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sign(payload: Omit<SignedQuote, 'signature'>, secret: string): string {
  return createHmac('sha256', secret).update(canonical(payload)).digest('base64url');
}

export function signQuote(homeId: string, quote: Quote, secret: string, now = new Date()): SignedQuote {
  if (secret.length < 32) throw new Error('The quote signing secret must be at least 32 characters');
  const payload = { homeId, quote, expiresAt: new Date(now.getTime() + QUOTE_LIFETIME_MS).toISOString() };
  return { ...payload, signature: sign(payload, secret) };
}

export type VerifyResult = { ok: true } | { ok: false; reason: 'tampered' | 'expired' };

export function verifyQuote(signed: SignedQuote, secret: string, now = new Date()): VerifyResult {
  const { signature, ...payload } = signed;
  const expected = Buffer.from(sign(payload, secret));
  const given = Buffer.from(String(signature));
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return { ok: false, reason: 'tampered' };
  if (Date.parse(signed.expiresAt) <= now.getTime()) return { ok: false, reason: 'expired' };
  return { ok: true };
}
