# AWS setup

Everything the site runs on, as code (AWS CDK). Nothing here has been deployed
yet: it goes into the client's own AWS account, and GitHub deploys it from
then on without any stored AWS keys.

## What it creates

| Piece | What it does | Rough monthly cost |
| --- | --- | --- |
| S3 bucket + CloudFront | The website pages, over HTTPS | $0 on CloudFront's free flat-rate plan |
| `Api` Lambda function | Availability, quotes, checkout, Stripe webhook, export calendars, behind CloudFront at `/api/*` and `/cal/*` | Free tier |
| `Jobs` Lambda function | Reads every Airbnb and VRBO calendar every 15 minutes; releases unpaid holds every 5 | Free tier |
| DynamoDB table | Night locks, holds, bookings, calendar state; on-demand, with point-in-time backups | Under $1 |
| SNS topic | Booking emails and alerts to the owner | Free tier |
| CloudWatch alarms | Email if either function keeps failing | Free tier (10 alarms) |
| Parameter Store | Stripe keys, signing secrets, iCal links (standard parameters) | $0 |

There is no API Gateway, NAT gateway or always-on server.

## One-time setup (account owner)

1. **AWS account** in the client's name, with billing alerts on.
2. **Secrets** in Parameter Store, region us-east-1. Use *SecureString* for all
   of these except `origin-secret`, which CloudFront reads as a plain *String*:

   | Name | Value |
   | --- | --- |
   | `/alamo/stripe/secret-key` | Stripe secret key (`sk_test_…` first, `sk_live_…` at launch) |
   | `/alamo/stripe/webhook-secret` | From the Stripe webhook below (`whsec_…`) |
   | `/alamo/quote-secret` | 40+ random characters |
   | `/alamo/export-secret` | 40+ random characters |
   | `/alamo/origin-secret` (String) | 40+ random characters |
   | `/alamo/ical/<home-id>/airbnb` | That home's Airbnb iCal link |
   | `/alamo/ical/<home-id>/vrbo` | That home's VRBO iCal link |

   `openssl rand -hex 24` makes a good random value. A home with a missing iCal
   link can't be booked online, on purpose.
3. **CDK bootstrap and the GitHub deploy role**, once, from a computer signed in
   to the account:

   ```sh
   cd booking && npm ci && cd ../infra && npm ci
   npx cdk bootstrap aws://<account-id>/us-east-1
   npx cdk deploy AlamoGithubDeploy
   ```

   This prints `DeployRoleArn`. It only lets the `main` branch of
   Payal-Jain503/Alamo-Website deploy.
4. **GitHub repository variables** (Settings → Secrets and variables → Actions →
   Variables): `AWS_DEPLOY_ROLE_ARN`, `OWNER_EMAIL`, `STRIPE_PUBLISHABLE_KEY`
   (`pk_test_…`, which turns on online booking), and later `DOMAIN_NAMES` and
   `CERTIFICATE_ARN`. Every merge to `main` then deploys.
5. **Confirm the SNS email** AWS sends to `OWNER_EMAIL`.
6. **Stripe webhook** (Developers → Webhooks) to the `StripeWebhookUrl` output,
   for `payment_intent.amount_capturable_updated`,
   `payment_intent.payment_failed` and `payment_intent.canceled`.
7. **CloudFront flat-rate plan:** pick the Free plan on the distribution in the
   CloudFront console. It includes the firewall and DDoS protection.
8. **Domain:** request an ACM certificate in us-east-1, set `DOMAIN_NAMES` and
   `CERTIFICATE_ARN`, redeploy, then point DNS at `CloudFrontDomain`.

## Each home's export calendar

Airbnb and VRBO import our direct bookings from
`https://<site>/cal/<home-id>-<token>.ics`. The token is made from
`export-secret`, so the link can't be guessed. To print a home's link:

```sh
cd booking
EXPORT_SECRET=<the export-secret value> npm run export-link -- <home-id> https://<site>
```

## Check it locally

```sh
cd booking && npm ci && cd ../infra && npm ci
npm run typecheck
npm run synth      # builds the templates and the Lambda bundle; needs no AWS account
```
