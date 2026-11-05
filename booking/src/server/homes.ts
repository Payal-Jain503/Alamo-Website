import type { HomeConfig } from './service.js';

/**
 * The homes that take direct bookings, with their rates and rules. Money is
 * in US cents. iCal links are not here: they are secrets in Parameter Store.
 *
 * These entries are examples for the homes being tested. Its rates,
 * fees and tax rates are placeholders until the client confirms them, and
 * the id must match the home's page slug on the website.
 */
/** Dollars: nightly rate, cleaning fee (management fee included), guests included, extra guest per night, pet fee per stay (none = no pets). */
type Rate = [number?, number?, number?, number?, number?];

const RATES: Record<string, Rate> = {
  'hideaway': [281, 180, 12, 15, 50],
  'texas-buckeye': [150, 190, 6, 25, 50],
  'longhorn-creek': [151, 150, 6, 25, 50],
  'sitio-plains': [175, 150, 8, 25, undefined],
  'bender-azim': [200, 160, 8, 25, 50],
  'canyon-maple': [250, 190, 10, 15, 50],
  'villa-madama': [349, 190, 14, 15, 50],
  'clay-oak': [300, 280, undefined, undefined, 80],
  'almadin': [259, 200, 14, 25, 50],
  '21634-longwood': [201, 160, 10, 15, 50],
  'legend-point': [341, 220, 14, 25, 50],
  'crimson': [299, 180, 12, 10, 50],
  'phlox-meadow': [247, 190, 12, 15, 50],
  'amber-crest': [191, 160, 10, 15, 50],
  'gallery-wells': [230, 180, 12, 15, 50],
  'donely': [300, 180, 12, 15, 50],
  'coral': [200, 180, 12, 15, 50],
  'wentink': [500, 220, 16, 15, 50],
  'orchard': [199, 170, 8, 15, 50],
  'stormy-skies': [219, 170, 8, 15, 50],
  'lake-valley': [138, 150, 8, 15, 50],
  'grey-woodpecker': [169, 170, 8, 25, undefined],
  'midvale': [499, 190, 10, 25, 50],
  'antigua': [210, 170, 8, 25, 50],
  'oat-st': [195, 180, 6, 20, 50],
  'rolling': [250, 225, 12, 15, 75],
  'saffron-plum': [195, 150, 6, 25, 50],
};

/** Mid-term homes: a 30-night minimum at a set price per 30 nights, in dollars. They do not use PriceLabs rates. */
const MID_TERM: Record<string, number> = { almadin: 5_500, 'austin-burton': 2_600, 'amber-crest': 4_400, 'clay-oak': 5_400 };

/** Homes that do not allow pets. Every other home does, at $50 a stay unless its rate row says otherwise. */
const NO_PETS = new Set(['sitio-plains', 'grey-woodpecker']);
const DEFAULT_PET_FEE = 50;

/** Stand-in rates for homes that only sync calendars for now. Replace with the client's numbers per home. */
function placeholderHome(id: string, name: string, rate?: Rate): HomeConfig {
  const [rateNightly, cleaning, included, extra, pet] = rate ?? [];
  const monthly = MID_TERM[id];
  const nightly = monthly ? monthly / 30 : rateNightly;
  return {
    id,
    name,
    timeZone: 'America/Chicago',
    sources: ['airbnb', 'vrbo'],
    ...(monthly ? { dynamicRates: false } : {}),
    plan: {
      baseNightly: nightly ? Math.round(nightly * 100) : 20_000,
      weekendNightly: nightly ? Math.round(nightly * 100) : 25_000,
      minStay: monthly ? 30 : 2,
      maxNights: monthly ? 180 : 30,
      minNoticeDays: 1,
      bookingWindowDays: 365,
      cleaningFee: cleaning ? cleaning * 100 : 15_000,
      ...(NO_PETS.has(id) ? {} : { petFee: (pet ?? DEFAULT_PET_FEE) * 100 }),
      // Max guests is not in the client's sheet yet, so nobody can book above the included number.
      maxGuests: included ?? 10,
      includedGuests: included ?? 8,
      extraGuestNightly: extra ? extra * 100 : 2_000,
      taxes: [
        { name: 'Texas hotel occupancy tax (6%)', rateBps: 600, appliesTo: ['nights', 'cleaning', 'extraGuests'] },
        { name: 'City and county hotel tax (example 9%)', rateBps: 900, appliesTo: ['nights', 'cleaning', 'extraGuests'] },
      ],
    },
  };
}

export const HOMES: HomeConfig[] = [
  {
    id: 'san-antonio-3-bedroom',
    name: 'Invitation Oak',
    timeZone: 'America/Chicago',
    sources: ['airbnb', 'vrbo'],
    plan: {
      baseNightly: 17_500,
      weekendNightly: 17_500,
      minStay: 2,
      maxNights: 30,
      minNoticeDays: 1,
      bookingWindowDays: 365,
      cleaningFee: 15_000,
      petFee: 5_000,
      maxGuests: 8,
      includedGuests: 8,
      extraGuestNightly: 2_500,
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
    ['rolling', 'Rolling'],
    ['saffron-plum', 'Saffron Plum'],
  ].map(([id, name]) => placeholderHome(id!, name!, RATES[id!])),
];
