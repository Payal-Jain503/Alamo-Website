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
    name: 'Invitation Oak',
    city: 'san-antonio',
    bedrooms: 3,
    bathrooms: 2,
    headline: 'A one-story San Antonio home with king beds and a ping pong table',
    description: [
      'A comfortable one-story home with three bedrooms, all with king beds, and two bathrooms.',
      'The open living area has a full kitchen, a ping pong table and a big sectional with a TV, and there is a back deck with a Hill Country view.',
    ],
    highlights: ['3 bedrooms, all king beds', '2 bathrooms', 'Ping pong table', 'Back deck with a view', 'Garage and driveway parking'],
    amenities: [...standardAmenities, 'Ping pong table', 'Back deck'],
    tone: 'sand',
    // The two kitchen shots (04, 05) are kept apart so the top grid doesn't repeat itself.
    photos: ['01.jpg', '02.jpg', '03.jpg', '04.jpg', '06.jpg', '07.jpg', '05.jpg', '08.jpg', '09.jpg', '10.jpg', '11.jpg'],
  },
  {
    slug: 'pendant-pass-theater',
    name: 'Pendant Pass Theater',
    city: 'san-antonio',
    bedrooms: 4,
    headline: 'A four-bedroom San Antonio home with its own movie theater and pool table',
    description: [
      'A spacious home with four bedrooms, made for family trips and group stays.',
      'The open living room, dining room and full kitchen are made for gathering, and there is a pool table with a bar, a back patio, and a private movie theater with a big screen and reclining leather seats.',
    ],
    highlights: ['4 bedrooms', 'Private theater with a 155-inch screen and 10 seats', 'Pool table and bar', 'Back patio', 'Washer and dryer'],
    amenities: [...standardAmenities, 'Movie theater', 'Pool table', 'Back patio'],
    tone: 'navy',
    // Theater and pool table are the standout rooms, so they sit in the top grid.
    photos: ['01.jpg', '06.jpg', '02.jpg', '05.jpg', '03.jpg', '04.jpg', '07.jpg', '08.jpg', '09.jpg', '10.jpg', '11.jpg', '12.jpg', '13.jpg', '14.jpg'],
  },
  {
    slug: 'bender-azim',
    name: 'Bender Azim',
    city: 'san-antonio',
    bedrooms: 4,
    headline: 'A four-bedroom home in the Medical Center area with a pool table and game room',
    description: [
      'A comfortable four-bedroom home close to the Medical Center, good for families, traveling medical staff and small groups.',
      'The open living room has a big TV and recliners, there is a dining table and a full kitchen, and a game room with a pool table and TV.',
    ],
    highlights: ['4 bedrooms', 'Pool table and game room', 'Near the Medical Center', 'Full kitchen', 'TV in the bedrooms'],
    amenities: [...standardAmenities, 'Pool table', 'Game room'],
    tone: 'stone',
    photos: ['01.jpg', '02.jpg', '03.jpg', '04.jpg', '05.jpg', '06.jpg', '07.jpg', '08.jpg', '09.jpg', '10.jpg'],
  },
  {
    slug: 'villa-madama',
    name: 'Villa Madama',
    city: 'san-antonio',
    bedrooms: 5,
    headline: 'A gated five-bedroom San Antonio home with a pool table and a covered deck',
    description: [
      'A spacious two-story brick home with five bedrooms, made for family trips and group stays, in a gated community near Highway 281 and Evans.',
      'There is an open living room, a dining room, a full kitchen and a game area with a pool table upstairs. Outside, a covered back deck looks over the trees.',
    ],
    highlights: ['5 bedrooms', 'Pool table and game area', 'Covered back deck with a view', 'Gated community', 'Washer and dryer'],
    amenities: [...standardAmenities, 'Pool table', 'Covered back deck'],
    tone: 'adobe',
    photos: ['01.jpg', '02.jpg', '03.jpg', '04.jpg', '05.jpg', '06.jpg', '07.jpg', '08.jpg', '09.jpg', '10.jpg', '11.jpg', '12.jpg', '13.jpg'],
  },
  {
    slug: 'wentink',
    name: 'Wentink',
    city: 'san-antonio',
    headline: 'A big San Antonio home with a private theater, pool table and poker room',
    description: [
      'A large two-story home with 8 beds, made for big family trips, reunions and group stays.',
      'There is a full kitchen with a long dining table, a living room with a fireplace, a pool table room, and a private movie theater with a 155-inch screen and a poker table. A covered back patio has seating for the group.',
    ],
    highlights: ['8 beds', 'Private theater with a 155-inch screen', 'Pool table and poker table', 'Covered back patio', 'Long dining table for the whole group'],
    amenities: [...standardAmenities, 'Movie theater', 'Pool table', 'Poker table', 'Covered back patio'],
    tone: 'navy',
    photos: ['01.jpg', '02.jpg', '03.jpg', '04.jpg', '05.jpg', '06.jpg', '07.jpg', '08.jpg', '09.jpg', '10.jpg', '11.jpg', '12.jpg', '13.jpg', '14.jpg'],
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
