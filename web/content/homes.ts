import type { CitySlug } from './site';

/**
 * The homes on the site.
 *
 * These six match the categories on the current alamocityrental.com. The
 * client has 38 homes in total; their real names, details and photos replace
 * these entries when the client sends them. Fields we don't know yet are left
 * out rather than guessed, and the pages hide anything that is missing.
 */
export interface Home {
  slug: string;
  name: string;
  city: CitySlug;
  bedrooms?: number;
  bathrooms?: number;
  maxGuests?: number;
  /** One line under the name on cards. */
  headline: string;
  description: string[];
  highlights: string[];
  amenities: string[];
  sleeping?: string[];
  /** Solid tone used for photo slots until photos are added. */
  tone: 'stone' | 'sage' | 'navy' | 'adobe' | 'sand' | 'olive';
  /** Files in public/photos/<slug>/, in display order. */
  photos: string[];
  featured?: boolean;
}

// Typical amenities, shown until the client confirms each home's list.
const standardAmenities = ['Wi-Fi', 'Full kitchen', 'Washer and dryer', 'Free parking', 'Air conditioning', 'Smart TV'];

export const homes: Home[] = [
  {
    slug: 'san-antonio-5-bedroom',
    name: 'San Antonio 5 Bedroom',
    city: 'san-antonio',
    bedrooms: 5,
    headline: 'Room for the whole family, minutes from the River Walk',
    description: [
      'Our largest San Antonio home, made for family reunions, celebrations and group trips.',
      'Full details, photos and the sleeping layout are coming soon.',
    ],
    highlights: ['5 bedrooms', 'Large gathering spaces', 'Easy drive to downtown'],
    amenities: standardAmenities,
    tone: 'stone',
    photos: [],
    featured: true,
  },
  {
    slug: 'san-antonio-4-bedroom',
    name: 'San Antonio 4 Bedroom',
    city: 'san-antonio',
    bedrooms: 4,
    headline: 'Space to spread out after a day in the city',
    description: ['A comfortable four-bedroom home for families and friends.', 'Full details and photos are coming soon.'],
    highlights: ['4 bedrooms', 'Family friendly', 'Easy drive to downtown'],
    amenities: standardAmenities,
    tone: 'adobe',
    photos: [],
    featured: true,
  },
  {
    slug: 'san-antonio-3-bedroom',
    name: 'San Antonio 3 Bedroom',
    city: 'san-antonio',
    bedrooms: 3,
    headline: 'An easy base for a San Antonio getaway',
    description: ['A relaxed three-bedroom home for smaller groups.', 'Full details and photos are coming soon.'],
    highlights: ['3 bedrooms', 'Great for small groups'],
    amenities: standardAmenities,
    tone: 'sand',
    photos: [],
  },
  {
    slug: 'austin-home',
    name: 'Austin Home',
    city: 'austin',
    headline: 'Close to live music, lakes and the Hill Country',
    description: ['Our Austin home, ready for a long weekend in the capital.', 'Full details and photos are coming soon.'],
    highlights: ['Near downtown Austin', 'Hill Country day trips'],
    amenities: standardAmenities,
    tone: 'sage',
    photos: [],
    featured: true,
  },
  {
    slug: 'houston-5-bedroom',
    name: 'Houston 5 Bedroom',
    city: 'houston',
    bedrooms: 5,
    headline: 'Big-group comfort in Houston',
    description: ['Five bedrooms for families, teams and groups visiting Houston.', 'Full details and photos are coming soon.'],
    highlights: ['5 bedrooms', 'Room for large groups'],
    amenities: standardAmenities,
    tone: 'navy',
    photos: [],
  },
  {
    slug: 'houston-3-bedroom',
    name: 'Houston 3 Bedroom',
    city: 'houston',
    bedrooms: 3,
    headline: 'A calm stay for a Houston visit',
    description: ['A three-bedroom home for smaller groups and longer stays.', 'Full details and photos are coming soon.'],
    highlights: ['3 bedrooms', 'Good for longer stays'],
    amenities: standardAmenities,
    tone: 'olive',
    photos: [],
  },
];

export function homeBySlug(slug: string): Home | undefined {
  return homes.find((h) => h.slug === slug);
}

export function homesInCity(city: CitySlug): Home[] {
  return homes.filter((h) => h.city === city);
}
