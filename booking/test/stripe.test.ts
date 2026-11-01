import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { StripeError, StripeGateway, readCheckoutEvent, verifyStripeSignature } from '../src/stripe.js';

const whsec = 'whsec_test_secret';
const now = new Date('2026-10-29T15:00:00Z');
const t = Math.floor(now.getTime() / 1000);
const body = JSON.stringify({ id: 'evt_1', type: 'payment_intent.amount_capturable_updated' });
const sign = (payload: string, ts = t, secret = whsec) => createHmac('sha256', secret).update(`${ts}.${payload}`).digest('hex');

test('a correctly signed webhook verifies', () => {
  assert.equal(verifyStripeSignature(body, `t=${t},v1=${sign(body)}`, whsec, now), true);
  // Stripe may send several signatures while a secret is being rolled.
  assert.equal(verifyStripeSignature(body, `t=${t},v1=deadbeef,v1=${sign(body)}`, whsec, now), true);
});

test('forged, altered, replayed or missing signatures are rejected', () => {
  assert.equal(verifyStripeSignature(body + ' ', `t=${t},v1=${sign(body)}`, whsec, now), false);
  assert.equal(verifyStripeSignature(body, `t=${t},v1=${sign(body, t, 'whsec_other')}`, whsec, now), false);
  const old = t - 301;
  assert.equal(verifyStripeSignature(body, `t=${old},v1=${sign(body, old)}`, whsec, now), false);
  assert.equal(verifyStripeSignature(body, undefined, whsec, now), false);
  assert.equal(verifyStripeSignature(body, 'garbage', whsec, now), false);
});

test('webhook events map to checkout steps', () => {
  const intent = { id: 'pi_1', amount_capturable: 93_725, metadata: { holdId: 'h_1' } };
  assert.deepEqual(readCheckoutEvent({ type: 'payment_intent.amount_capturable_updated', data: { object: intent } }), { type: 'authorized', holdId: 'h_1', paymentId: 'pi_1', amount: 93_725 });
  assert.deepEqual(readCheckoutEvent({ type: 'payment_intent.payment_failed', data: { object: intent } }), { type: 'failed', holdId: 'h_1' });
  assert.deepEqual(readCheckoutEvent({ type: 'payment_intent.canceled', data: { object: intent } }), { type: 'failed', holdId: 'h_1' });
  assert.deepEqual(readCheckoutEvent({ type: 'payment_intent.succeeded', data: { object: intent } }), { type: 'ignored' });
  assert.deepEqual(readCheckoutEvent({ type: 'payment_intent.amount_capturable_updated', data: { object: { id: 'pi_2' } } }), { type: 'ignored' });
});

function fakeFetch(responses: Array<{ status: number; body: unknown }>) {
  const requests: Array<{ url: string; init: RequestInit }> = [];
  const impl = (async (url: string, init: RequestInit) => {
    requests.push({ url, init });
    const r = responses.shift()!;
    return new Response(JSON.stringify(r.body), { status: r.status });
  }) as unknown as typeof fetch;
  return { impl, requests };
}

test('authorize creates a manual-capture PaymentIntent with an idempotency key', async () => {
  const f = fakeFetch([{ status: 200, body: { id: 'pi_1', client_secret: 'pi_1_secret' } }]);
  const gw = new StripeGateway('sk_test_123', f.impl);
  const r = await gw.authorize({ amount: 93_725, currency: 'usd', holdId: 'h_1', homeId: 'sa-5br', email: 'a@b.co', idempotencyKey: 'authorize-h_1' });
  assert.deepEqual(r, { paymentId: 'pi_1', clientSecret: 'pi_1_secret' });
  const req = f.requests[0]!;
  assert.equal(req.url, 'https://api.stripe.com/v1/payment_intents');
  const headers = req.init.headers as Record<string, string>;
  assert.equal(headers['idempotency-key'], 'authorize-h_1');
  assert.equal(headers.authorization, 'Bearer sk_test_123');
  const params = req.init.body as URLSearchParams;
  assert.equal(params.get('capture_method'), 'manual');
  assert.equal(params.get('amount'), '93725');
  assert.equal(params.get('metadata[holdId]'), 'h_1');
  assert.equal(params.get('automatic_payment_methods[allow_redirects]'), 'never');
});

test('capture and cancel call the right endpoints; cancelling twice is fine', async () => {
  const f = fakeFetch([
    { status: 200, body: { id: 'pi_1' } },
    { status: 200, body: { id: 'pi_1' } },
    { status: 400, body: { error: { message: 'already canceled', code: 'payment_intent_unexpected_state' } } },
  ]);
  const gw = new StripeGateway('sk_test_123', f.impl);
  await gw.capture('pi_1', 'capture-h_1');
  await gw.cancel('pi_1', 'cancel-h_1');
  await gw.cancel('pi_1', 'cancel-h_1');
  assert.deepEqual(f.requests.map((r) => r.url), [
    'https://api.stripe.com/v1/payment_intents/pi_1/capture',
    'https://api.stripe.com/v1/payment_intents/pi_1/cancel',
    'https://api.stripe.com/v1/payment_intents/pi_1/cancel',
  ]);
});

test('other Stripe errors are raised', async () => {
  const f = fakeFetch([{ status: 402, body: { error: { message: 'Your card was declined.', code: 'card_declined' } } }]);
  const gw = new StripeGateway('sk_test_123', f.impl);
  await assert.rejects(gw.capture('pi_1', 'k'), (e: unknown) => e instanceof StripeError && e.status === 402 && e.code === 'card_declined');
});

test('only a Stripe secret key is accepted', () => {
  assert.throws(() => new StripeGateway('pk_test_123'));
});
