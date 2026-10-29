import type { HomeConfig } from './service.js';

/**
 * The homes that take direct bookings, with their rates and rules. Money is
 * in US cents. iCal links are not here: they are secrets in Parameter Store.
 *
 * This first entry is an example for the one home being tested. Its rates,
 * fees and tax rates are placeholders until the client confirms them, and
 * the id must match the home's page slug on the website.
 */
export const HOMES: HomeConfig[] = [
  {
    id: 'san-antonio-5-bedroom',
    name: 'San Antonio 5 Bedroom',
    timeZone: 'America/Chicago',
    sources: ['airbnb', 'vrbo'],
    plan: {
      baseNightly: 25_000,
      weekendNightly: 32_000,
      minStay: 2,
      maxNights: 30,
      minNoticeDays: 1,
      bookingWindowDays: 365,
      cleaningFee: 17_500,
      maxGuests: 12,
      includedGuests: 10,
      extraGuestNightly: 2_000,
      taxes: [
        { name: 'Texas hotel occupancy tax (6%)', rateBps: 600, appliesTo: ['nights', 'cleaning', 'extraGuests'] },
        { name: 'City and county hotel tax (example 9%)', rateBps: 900, appliesTo: ['nights', 'cleaning', 'extraGuests'] },
      ],
    },
  },
];
