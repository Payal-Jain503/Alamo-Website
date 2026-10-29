# Alamo City Rental booking engine

Calendar sync with Airbnb and VRBO over iCal, plus pricing and quotes for the
direct-booking website. Date holds and Stripe payments come next.

## What it does

- Reads a home's Airbnb and VRBO iCal exports and merges them into one calendar.
- Tells guest reservations apart from plain blocks. Airbnb blocks the dates it
  copies from VRBO (and the other way round), so a reservation on one site and a
  block on the other is normal. Two reservations on the same night is a real
  double booking, and is flagged.
- Never opens booked dates because of a bad read. A failed download, an error
  page or a cut-off file keeps the last known dates. A calendar that suddenly
  has no upcoming dates is only believed the second time in a row. The owner is
  alerted after 3 failures in a row.
- Builds our own export calendar for each home, holding only direct bookings
  and owner blocks (never imported dates, so calendars cannot echo), with no
  guest names.

Dates are calendar days in the home's time zone (America/Chicago). A block runs
from the first night to the check-out day, and check-out day stays bookable.

## Pricing and quotes

`quoteStay(plan, stay, blocks, today)` prices a stay and checks every booking
rule. Money is in whole US cents.

- **Nightly price:** a home's base rate, a Friday and Saturday rate, seasons
  (later ones win), then prices synced from PriceLabs, which win over everything.
- **Minimum stay** comes from the arrival night, the way Airbnb and PriceLabs apply it.
- **Fees:** cleaning, pets (once per stay) and extra guests above the included
  number (per guest per night), each on its own line.
- **Lodging taxes:** any number of tax lines, each with its rate and the charges
  it applies to. Rates are confirmed with the client's accountant; the tests use
  example rates.
- **Rules:** dates, notice before check-in, how far ahead, longest stay,
  check-in and check-out days, guest limit, pets and availability. Each failure
  comes back with a reason a guest can read.

`signQuote` and `verifyQuote` put an HMAC signature and a 30-minute expiry on a
quote, so the price and dates can't be edited between the quote and checkout.
Checkout still re-checks availability and re-prices before taking payment.

## Checkout

Checkout holds the dates, authorises the card, checks Airbnb and VRBO one last
time, and only then charges.

1. **Reserve** (`startCheckout`): verifies the signed quote, reads the home's
   Airbnb and VRBO feeds live (and stops if either can't be read), re-prices,
   then claims every night for 15 minutes, all or nothing. If another guest
   holds any night, nobody gets a partial stay. The card is then authorised,
   not charged, through a Stripe PaymentIntent with manual capture.
2. **Card authorised** (`confirmPayment`, from the Stripe webhook): reads the
   feeds live again. If the dates were booked elsewhere in the meantime, or a
   feed can't be read, the authorisation is cancelled and the guest is not
   charged. Otherwise the nights become a booking first and the card is
   captured second. Repeated Stripe events book and charge once.
3. **Clean-up:** a failed payment frees the nights at once. `sweepExpiredHolds`
   frees holds 5 minutes after they run out and cancels their authorisations.
   A payment that lands a little late still books if nobody took the dates.
4. **After booking:** `bookingBlock` puts the stay on our export calendar, so
   Airbnb and VRBO close the same nights on their next read, and the guest and
   owner are notified.

`verifyStripeSignature` checks every webhook against its signing secret and
rejects anything older than 5 minutes. Bank (ACH) payments are left out for now,
because they can't be held and released like a card.

What iCal can't do: Airbnb and VRBO only re-read our calendar every few hours,
so a booking made here can still be taken there in that window. The two live
checks keep our side safe; closing their window fully needs a channel manager
or their APIs.

## Check one home

```sh
npm install
npm run check-calendar -- --name "San Antonio 5BR" \
  --airbnb "<Airbnb iCal link or .ics file>" \
  --vrbo "<VRBO iCal link or .ics file>" \
  --from 2026-11-01 --months 3 --html out/preview.html
```

It prints every event and any double bookings, and writes a calendar page to
`--html`. Private tokens in links are hidden in the output. Do not commit real
iCal links: they let anyone read the calendar.

The `fixtures/` files are made-up calendars in the same format as Airbnb and
VRBO exports, including one deliberate double booking on 19 Dec 2026.

## Tests

```sh
npm test        # 77 tests, Node's built-in runner
npm run typecheck
```

## Layout

| File | Purpose |
| --- | --- |
| `src/parseFeed.ts` | Reads an iCal export into blocks |
| `src/fetchFeed.ts` | Downloads a feed; failures come back as errors, never as an empty calendar |
| `src/sync.ts` | Applies each read to the stored state of a feed |
| `src/availability.ts` | Night-by-night availability, stay checks, double-booking detection |
| `src/exportFeed.ts` | Our export calendar for Airbnb and VRBO |
| `src/pricing.ts` | Rate plans, fees, taxes and booking rules |
| `src/signedQuote.ts` | Signed, expiring quotes for checkout |
| `src/holds.ts` | Night-by-night locks: 15-minute holds and bookings |
| `src/checkout.ts` | Reserve, final check, capture or release, and the expiry sweeper |
| `src/stripe.ts` | Stripe PaymentIntents over REST and webhook signature checks |
| `src/preview.ts`, `src/cli.ts` | The calendar check tool |

`sync.ts` and the other modules have no AWS code yet, so they can run unchanged
inside the Lambda sync job later.
