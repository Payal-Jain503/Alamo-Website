import type { HomeConfig } from './service.js';

/**
 * The homes that take direct bookings, with their rates and rules. Money is
 * in US cents. iCal links are not here: they are secrets in Parameter Store.
 *
 * These entries are examples for the homes being tested. Its rates,
 * fees and tax rates are placeholders until the client confirms them, and
 * the id must match the home's page slug on the website.
 */
/** Stand-in rates for homes that only sync calendars for now. Replace with the client's numbers per home. */
function placeholderHome(id: string, name: string): HomeConfig {
  return {
    id,
    name,
    timeZone: 'America/Chicago',
    sources: ['airbnb', 'vrbo'],
    plan: {
      baseNightly: 20_000,
      weekendNightly: 25_000,
      minStay: 2,
      maxNights: 30,
      minNoticeDays: 1,
      bookingWindowDays: 365,
      cleaningFee: 15_000,
      maxGuests: 10,
      includedGuests: 8,
      extraGuestNightly: 2_000,
      taxes: [
        { name: 'Texas hotel occupancy tax (6%)', rateBps: 600, appliesTo: ['nights', 'cleaning', 'extraGuests'] },
        { name: 'City and county hotel tax (example 9%)', rateBps: 900, appliesTo: ['nights', 'cleaning', 'extraGuests'] },
      ],
    },
  };
}

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
  {
    id: 'san-antonio-3-bedroom',
    name: 'Invitation Oak',
    timeZone: 'America/Chicago',
    sources: ['airbnb', 'vrbo'],
    plan: {
      baseNightly: 15_000,
      weekendNightly: 19_000,
      minStay: 2,
      maxNights: 30,
      minNoticeDays: 1,
      bookingWindowDays: 365,
      cleaningFee: 11_000,
      maxGuests: 8,
      includedGuests: 6,
      extraGuestNightly: 2_000,
      taxes: [
        { name: 'Texas hotel occupancy tax (6%)', rateBps: 600, appliesTo: ['nights', 'cleaning', 'extraGuests'] },
        { name: 'City and county hotel tax (example 9%)', rateBps: 900, appliesTo: ['nights', 'cleaning', 'extraGuests'] },
      ],
    },
  },
  // The rest of the portfolio. Calendars sync for these now; each one gets its real rates before its page goes live.
  ...[
    ['hideaway', 'Hideaway'],
    ['texas-buckeye', 'Texas Buckeye'],
    ['longhorn-creek', 'Longhorn Creek'],
    ['sitio-plains', 'Sitio plains'],
    ['21630-longwood', '21630 Longwood'],
    ['bender-azim', 'Bender Azim'],
    ['colt-river', 'Colt River'],
    ['canyon-maple', 'Canyon Maple'],
    ['villa-madama', 'Villa Madama'],
    ['clay-oak', 'Clay Oak'],
    ['almadin', 'Almadin'],
    ['21634-longwood', '21634 Longwood'],
    ['pendant-pass-theater', 'Pendant Pass Theater'],
    ['legend-point', 'Legend Point'],
    ['crimson', 'Crimson'],
    ['phlox-meadow', 'Phlox Meadow'],
    ['amber-crest', 'Amber Crest'],
    ['gallery-wells', 'Gallery Wells'],
    ['westmark-azim', 'Westmark Azim'],
    ['donely', 'Donely'],
    ['coral', 'Coral'],
    ['wentink', 'Wentink'],
    ['southern-knoll', 'Southern Knoll'],
    ['orchard', 'Orchard'],
    ['stormy-skies', 'Stormy Skies'],
    ['lake-valley', 'Lake Valley'],
    ['grey-woodpecker', 'Grey Woodpecker'],
    ['midvale', 'Midvale'],
    ['antigua', 'Antigua'],
    ['austin-burton', 'Austin Burton'],
    ['oat-st', 'Oat St'],
    ['marconi-houston', 'Marconi Houston'],
    ['rolling', 'Rolling'],
    ['saffron-plum', 'Saffron Plum'],
  ].map(([id, name]) => placeholderHome(id!, name!)),
];
