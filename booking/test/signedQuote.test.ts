import { test } from 'node:test';
import assert from 'node:assert/strict';
import { quoteStay, type RatePlan } from '../src/pricing.js';
import { QUOTE_LIFETIME_MS, signQuote, verifyQuote } from '../src/signedQuote.js';

const secret = 'test-secret-that-is-long-enough-1234567890';
const plan: RatePlan = {
  baseNightly: 20_000,
  minStay: 1,
  maxNights: 30,
  minNoticeDays: 0,
  bookingWindowDays: 365,
  cleaningFee: 10_000,
  maxGuests: 8,
  includedGuests: 8,
  taxes: [{ name: 'Tax', rateBps: 600, appliesTo: ['nights', 'cleaning'] }],
};
const now = new Date('2026-10-29T15:00:00Z');
const result = quoteStay(plan, { checkIn: '2026-11-02', checkOut: '2026-11-04', guests: 4 }, [], '2026-10-29');
assert.ok(result.ok);
const quote = result.quote;

test('a signed quote verifies', () => {
  assert.deepEqual(verifyQuote(signQuote('sa-5br', quote, secret, now), secret, now), { ok: true });
});

test('changing the price, dates or home breaks the signature', () => {
  const signed = signQuote('sa-5br', quote, secret, now);
  const edits = [
    { ...signed, quote: { ...signed.quote, total: 100 } },
    { ...signed, quote: { ...signed.quote, checkOut: '2026-11-10' } },
    { ...signed, homeId: 'houston-5br' },
    { ...signed, expiresAt: '2099-01-01T00:00:00.000Z' },
    { ...signed, signature: 'x' },
  ];
  for (const e of edits) assert.deepEqual(verifyQuote(e, secret, now), { ok: false, reason: 'tampered' });
});

test('a quote signed with another secret is rejected', () => {
  const signed = signQuote('sa-5br', quote, 'a-different-secret-that-is-long-enough-xyz', now);
  assert.equal(verifyQuote(signed, secret, now).ok, false);
});

test('quotes expire after 30 minutes', () => {
  const signed = signQuote('sa-5br', quote, secret, now);
  assert.equal(verifyQuote(signed, secret, new Date(now.getTime() + QUOTE_LIFETIME_MS - 1)).ok, true);
  assert.deepEqual(verifyQuote(signed, secret, new Date(now.getTime() + QUOTE_LIFETIME_MS)), { ok: false, reason: 'expired' });
});

test('key order does not change the signature', () => {
  const signed = signQuote('sa-5br', quote, secret, now);
  const reordered = JSON.parse(JSON.stringify({ signature: signed.signature, expiresAt: signed.expiresAt, quote: signed.quote, homeId: signed.homeId }));
  assert.equal(verifyQuote(reordered, secret, now).ok, true);
});

test('short secrets are refused', () => {
  assert.throws(() => signQuote('sa-5br', quote, 'short', now));
});
