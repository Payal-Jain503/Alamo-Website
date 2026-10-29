import { exportToken } from './server/service.js';

/**
 * Prints a home's export calendar link, to paste into Airbnb's and VRBO's
 * "import calendar" settings.
 *
 *   EXPORT_SECRET=… npm run export-link -- san-antonio-5-bedroom https://alamocityrental.com
 */
const [homeId, site] = process.argv.slice(2);
const secret = process.env.EXPORT_SECRET;
if (!homeId || !site || !secret) {
  console.error('Usage: EXPORT_SECRET=… npm run export-link -- <home-id> <site-url>');
  process.exit(1);
}
console.log(`${site.replace(/\/$/, '')}/cal/${homeId}-${exportToken(secret, homeId)}.ics`);
