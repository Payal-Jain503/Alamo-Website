import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { PublishCommand, SNSClient } from '@aws-sdk/client-sns';
import { GetParametersByPathCommand, SSMClient } from '@aws-sdk/client-ssm';
import type { PaymentGateway } from '../checkout.js';
import { BookingService, type Alerts, type Secrets } from '../server/service.js';
import { HOMES } from '../server/homes.js';
import { StripeGateway } from '../stripe.js';
import type { Source } from '../types.js';
import { DynamoFeedStore, DynamoHoldRepository, DynamoNightStore } from './table.js';

/**
 * Builds the booking service from the Lambda environment. Secrets live in
 * Parameter Store as SecureStrings under one prefix (default /alamo-web/):
 *
 *   /alamo-web/stripe/secret-key        sk_live_… or sk_test_…   (optional until Stripe is set up)
 *   /alamo-web/stripe/webhook-secret    whsec_…                  (optional until Stripe is set up)
 *   /alamo-web/quote-secret             32+ random characters
 *   /alamo-web/export-secret            32+ random characters
 *   /alamo-web/origin-secret            32+ random characters, also set on CloudFront
 *   /alamo-web/ical/<home-id>/airbnb    the home's Airbnb iCal link
 *   /alamo-web/ical/<home-id>/vrbo      the home's VRBO iCal link
 *
 * They are read once per cold start and cached for 5 minutes.
 */
const CACHE_MS = 5 * 60_000;

export interface Runtime {
  service: BookingService;
  originSecret: string;
}

let cached: { at: number; runtime: Promise<Runtime> } | undefined;

export function runtime(): Promise<Runtime> {
  if (!cached || Date.now() - cached.at > CACHE_MS) {
    const runtime = build();
    cached = { at: Date.now(), runtime };
    // A failed start-up must not be cached, or every request would fail until the next cold start.
    runtime.catch(() => (cached = undefined));
  }
  return cached.runtime;
}

/** Stands in until the Stripe keys exist. Paying fails cleanly, which frees the held dates and charges nothing. */
const paymentsNotSetUp: PaymentGateway = {
  authorize: async () => {
    throw new Error('Stripe is not set up yet');
  },
  capture: async () => {
    throw new Error('Stripe is not set up yet');
  },
  cancel: async () => {
    throw new Error('Stripe is not set up yet');
  },
};

const env = (name: string) => {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable ${name}`);
  return v;
};

async function readParameters(ssm: SSMClient, prefix: string): Promise<Map<string, string>> {
  const values = new Map<string, string>();
  let NextToken: string | undefined;
  do {
    const page = await ssm.send(new GetParametersByPathCommand({ Path: prefix, Recursive: true, WithDecryption: true, NextToken }));
    for (const p of page.Parameters ?? []) if (p.Name && p.Value) values.set(p.Name.slice(prefix.length), p.Value);
    NextToken = page.NextToken;
  } while (NextToken);
  return values;
}

async function build(): Promise<Runtime> {
  const table = env('TABLE_NAME');
  const prefix = (process.env.PARAMETER_PREFIX ?? '/alamo-web/').replace(/\/?$/, '/');
  const params = await readParameters(new SSMClient({}), prefix);
  const need = (name: string) => {
    const v = params.get(name);
    if (!v) throw new Error(`Missing parameter ${prefix}${name}`);
    return v;
  };

  const feedUrls: Secrets['feedUrls'] = {};
  for (const [name, value] of params) {
    const m = /^ical\/([a-z0-9-]+)\/(airbnb|vrbo|other)$/.exec(name);
    if (m) (feedUrls[m[1]!] ??= {})[m[2] as Source] = value;
  }

  const db = DynamoDBDocumentClient.from(new DynamoDBClient({}), { marshallOptions: { removeUndefinedValues: true } });
  const sns = new SNSClient({});
  const topicArn = env('ALERT_TOPIC_ARN');
  const alerts: Alerts = {
    async send(subject, message) {
      // SNS email subjects are limited to 100 characters.
      await sns.send(new PublishCommand({ TopicArn: topicArn, Subject: subject.slice(0, 100), Message: message }));
    },
  };

  const service = new BookingService({
    homes: HOMES,
    nights: new DynamoNightStore(db, table),
    holds: new DynamoHoldRepository(db, table),
    feeds: new DynamoFeedStore(db, table),
    payments: params.get('stripe/secret-key') ? new StripeGateway(params.get('stripe/secret-key')!) : paymentsNotSetUp,
    alerts,
    secrets: {
      stripeWebhookSecret: params.get('stripe/webhook-secret'),
      quoteSecret: need('quote-secret'),
      exportSecret: need('export-secret'),
      feedUrls,
    },
  });
  return { service, originSecret: need('origin-secret') };
}
