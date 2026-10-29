import { timingSafeEqual } from 'node:crypto';
import type { BookingService } from './service.js';

/** The parts of a Lambda Function URL request (payload version 2.0) this API reads. */
export interface HttpRequest {
  rawPath: string;
  queryStringParameters?: Record<string, string | undefined>;
  headers: Record<string, string | undefined>;
  body?: string;
  isBase64Encoded?: boolean;
  requestContext: { http: { method: string } };
}

export interface HttpResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

/** Largest request body accepted. Quotes and reservations are well under 1 KB, Stripe events under 64 KB. */
const MAX_BODY_BYTES = 256 * 1024;

/**
 * CloudFront adds this header with a secret value before forwarding to the
 * function, so requests that skip CloudFront (and its firewall) are refused.
 */
export const ORIGIN_HEADER = 'x-alamo-origin';

const json = (statusCode: number, body: unknown): HttpResponse => ({
  statusCode,
  headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  body: JSON.stringify(body),
});

function sameSecret(given: string | undefined, expected: string) {
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function readBody(req: HttpRequest): string {
  const raw = req.body ?? '';
  return req.isBase64Encoded ? Buffer.from(raw, 'base64').toString('utf8') : raw;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

const HOME_ID = /^[a-z0-9-]{1,64}$/;
const HOLD_ID = /^h_[0-9a-f-]{36}$/;

/** Routes one request. Every guest-facing answer is JSON; the export calendar is iCal text. */
export async function handleHttp(service: BookingService, req: HttpRequest, originSecret: string): Promise<HttpResponse> {
  if (!sameSecret(req.headers[ORIGIN_HEADER], originSecret)) return json(403, { error: 'forbidden' });

  const method = req.requestContext.http.method;
  const path = req.rawPath.replace(/\/+$/, '');
  const query = req.queryStringParameters ?? {};
  const body = readBody(req);
  if (Buffer.byteLength(body) > MAX_BODY_BYTES) return json(413, { error: 'too-large' });

  try {
    if (method === 'GET' && path === '/api/availability') {
      if (!HOME_ID.test(query.home ?? '')) return json(400, { error: 'bad-request' });
      const r = await service.availability(query.home!);
      return { ...json(r.status, r.body), headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=60' } };
    }

    if (method === 'POST' && path === '/api/quote') {
      const input = parseJson(body) as Record<string, unknown> | undefined;
      if (!input || typeof input.homeId !== 'string' || !HOME_ID.test(input.homeId)) return json(400, { error: 'bad-request' });
      const r = await service.quote(input as never);
      return json(r.status, r.body);
    }

    if (method === 'POST' && path === '/api/reserve') {
      const r = await service.reserve(parseJson(body) as never);
      return json(r.status, r.body);
    }

    if (method === 'GET' && path === '/api/hold') {
      if (!HOLD_ID.test(query.id ?? '')) return json(400, { error: 'bad-request' });
      const r = await service.holdStatus(query.id!);
      return json(r.status, r.body);
    }

    if (method === 'POST' && path === '/api/stripe-webhook') {
      // The signature covers the exact bytes Stripe sent, so the body is passed on unparsed.
      const r = await service.stripeWebhook(body, req.headers['stripe-signature']);
      return json(r.status, r.body);
    }

    const cal = /^\/cal\/([a-z0-9-]{1,64})-([0-9a-f]{32})\.ics$/.exec(path);
    if (method === 'GET' && cal) {
      const r = await service.exportCalendar(cal[1]!, cal[2]!);
      return {
        statusCode: r.status,
        headers: { 'content-type': r.status === 200 ? 'text/calendar; charset=utf-8' : 'text/plain', 'cache-control': 'max-age=300' },
        body: r.body,
      };
    }

    return json(404, { error: 'not-found' });
  } catch (err) {
    console.error('Request failed', method, path, err);
    return json(500, { error: 'server-error' });
  }
}
