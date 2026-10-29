# Alamo City Rental booking engine

Calendar sync with Airbnb and VRBO over iCal. This is the first piece of the
direct-booking website; pricing, holds and Stripe payments come next.

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
npm test        # 32 tests, Node's built-in runner
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
| `src/preview.ts`, `src/cli.ts` | The calendar check tool |

`sync.ts` and the other modules have no AWS code yet, so they can run unchanged
inside the Lambda sync job later.
