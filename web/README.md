# Alamo City Rental website

Next.js static site. `npm run build` writes plain HTML, CSS and JS to `out/`,
ready to upload to S3 behind CloudFront.

```sh
npm install
npm run dev        # http://localhost:3000
npm run build      # static export in out/
npm run typecheck
```

## Content

- `content/site.ts`: phone, email, Instagram link (hidden while empty) and the three cities.
- `content/homes.ts`: the homes. These six match the categories on the current
  alamocityrental.com and stand in for the client's 38 homes. Unknown details
  (guests, bathrooms, sleeping layout) are left out and hidden on the pages.
  The amenities list is a typical set until each home's list is confirmed.

## Photos

Drop photos into `public/photos/` and they replace the placeholders on the next build:

| Where | File |
| --- | --- |
| Hero slides | `public/photos/hero/stay.jpg`, `gather.jpg`, `explore.jpg` |
| City cards and pages | `public/photos/cities/<city-slug>.jpg` |
| A home | `public/photos/<home-slug>/<file>`, listed in that home's `photos` array in order |

Use landscape photos at least 2000px wide for the hero, 1600px for the rest.

## Booking

Each home's booking panel asks the booking API (`/api/*` on the same address)
for that home's calendar. If it answers, guests book online:

1. Pick dates on a month calendar. Booked nights are crossed out; a booked night
   can still be a check-out day.
2. See the full price: nights, fees and each tax line.
3. Enter name, email and phone. The dates are then held for 15 minutes.
4. Pay in Stripe's card form (`components/CardPayment.tsx`). The card is
   authorised, and only charged after the final Airbnb and VRBO check.
5. See the confirmation number, or a clear "not booked, not charged" message.

If the API doesn't answer for a home (local preview, before launch, or a home
not yet online), or `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` wasn't set at build
time, the panel falls back to the enquiry form with the dates filled in.

`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is Stripe's publishable key (`pk_test_…`
or `pk_live_…`). It is meant to be public; the secret key stays on the server.
