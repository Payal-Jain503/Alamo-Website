import type { Home } from './homes';

/**
 * Homes that have a page and can be booked, but are not listed anywhere: not on the Homes page, the city pages,
 * search or the home page, and search engines are told to skip them. Reach one only by its direct address.
 */
export const hiddenHomes: Home[] = [
  {
    slug: 'test-one-dollar',
    name: 'Payment test ($1)',
    city: 'san-antonio',
    maxGuests: 2,
    headline: 'A $1-a-night listing used to test card payments',
    description: ['This listing exists only to test card payments. Please do not book it.'],
    highlights: ['$1 a night'],
    amenities: [],
    tone: 'stone',
    photos: [],
  },
];

export const hiddenSlugs = new Set(hiddenHomes.map((h) => h.slug));
