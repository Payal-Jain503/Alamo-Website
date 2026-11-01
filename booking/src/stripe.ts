import { createHmac, timingSafeEqual } from 'node:crypto';
import type { PaymentGateway } from './checkout.js';

/**
 * Stripe over its REST API, without the SDK, so the Lambda bundle stays
 * small. Card payments are authorised first (manual capture) and charged
 * only after the final calendar check.
 */
export class StripeGateway implements PaymentGateway {
  constructor(
    private readonly secretKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    if (!/^sk_(test|live)_/.test(secretKey)) throw new Error('Expected a Stripe secret key (sk_test_… or sk_live_…)');
  }

  private async call(path: string, params: Record<string, string>, idempotencyKey: string) {
    const response = await this.fetchImpl(`https://api.stripe.com/v1/${path}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.secretKey}`,
        'content-type': 'application/x-www-form-urlencoded',
        'idempotency-key': idempotencyKey,
      },
      body: new URLSearchParams(params),
      signal: AbortSignal.timeout(20_000),
    });
    const body = (await response.json()) as Record<string, unknown> & { error?: { message?: string; code?: string } };
    if (!response.ok) throw new StripeError(response.status, body.error?.message ?? 'Stripe request failed', body.error?.code);
    return body;
  }

  async authorize(input: Parameters<PaymentGateway['authorize']>[0]) {
    const intent = await this.call(
      'payment_intents',
      {
        amount: String(input.amount),
        currency: input.currency,
        capture_method: 'manual',
        'automatic_payment_methods[enabled]': 'true',
        // Bank debits can't be held and released, so the hold-then-charge flow uses cards and wallets only.
        'automatic_payment_methods[allow_redirects]': 'never',
        receipt_email: input.email,
        'metadata[holdId]': input.holdId,
        'metadata[homeId]': input.homeId,
      },
      input.idempotencyKey,
    );
    return { paymentId: String(intent.id), clientSecret: String(intent.client_secret) };
  }

  async capture(paymentId: string, idempotencyKey: string) {
    await this.call(`payment_intents/${encodeURIComponent(paymentId)}/capture`, {}, idempotencyKey);
  }

  async cancel(paymentId: string, idempotencyKey: string) {
    try {
      await this.call(`payment_intents/${encodeURIComponent(paymentId)}/cancel`, {}, idempotencyKey);
    } catch (err) {
      // Already cancelled, or never authorised: either way nothing will be charged.
      if (err instanceof StripeError && err.code === 'payment_intent_unexpected_state') return;
      throw err;
    }
  }
}

export class StripeError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
  ) {
    super(message);
  }
}

export const WEBHOOK_TOLERANCE_SECONDS = 300;

/**
 * Checks the Stripe-Signature header on a webhook, using the raw request
 * body. Rejects forged, altered or replayed events.
 */
export function verifyStripeSignature(rawBody: string, header: string | undefined, webhookSecret: string, now = new Date()): boolean {
  if (!header) return false;
  const parts = header.split(',').map((p) => p.split('=') as [string, string]);
  const timestamp = Number(parts.find(([k]) => k === 't')?.[1]);
  const signatures = parts.filter(([k]) => k === 'v1').map(([, v]) => v);
  if (!Number.isFinite(timestamp) || signatures.length === 0) return false;
  if (Math.abs(now.getTime() / 1000 - timestamp) > WEBHOOK_TOLERANCE_SECONDS) return false;

  const expected = Buffer.from(createHmac('sha256', webhookSecret).update(`${timestamp}.${rawBody}`).digest('hex'));
  return signatures.some((s) => {
    const given = Buffer.from(s);
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

/** The webhook events checkout acts on. */
export type CheckoutEvent =
  | { type: 'authorized'; holdId: string; paymentId: string; amount: number }
  | { type: 'failed'; holdId: string }
  | { type: 'ignored' };

export function readCheckoutEvent(event: { type: string; data: { object: Record<string, unknown> } }): CheckoutEvent {
  const intent = event.data.object;
  const holdId = (intent.metadata as Record<string, string> | undefined)?.holdId;
  if (!holdId) return { type: 'ignored' };
  if (event.type === 'payment_intent.amount_capturable_updated') {
    return { type: 'authorized', holdId, paymentId: String(intent.id), amount: Number(intent.amount_capturable) };
  }
  if (event.type === 'payment_intent.payment_failed' || event.type === 'payment_intent.canceled') return { type: 'failed', holdId };
  return { type: 'ignored' };
}
