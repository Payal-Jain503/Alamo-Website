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

Until the booking API is live, the booking panel and the enquiry form open the
guest's email app with their dates filled in. The panel is where live prices,
the calendar and Stripe checkout plug in.
