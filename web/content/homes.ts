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
    slug: 'san-antonio-3-bedroom',
    featured: true,
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
    featured: true,
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
    bedrooms: 5,
    headline: 'A big San Antonio home with a private theater, pool table and poker room',
    description: [
      'A large two-story home with five bedrooms and 8 beds, made for big family trips, reunions and group stays.',
      'There is a full kitchen with a long dining table, a living room with a fireplace, a pool table room, and a private movie theater with a 155-inch screen and a poker table. A covered back patio has seating for the group.',
    ],
    highlights: ['5 bedrooms, 8 beds', 'Private theater with a 155-inch screen', 'Pool table and poker table', 'Covered back patio', 'Long dining table for the whole group'],
    amenities: [...standardAmenities, 'Movie theater', 'Pool table', 'Poker table', 'Covered back patio'],
    tone: 'navy',
    photos: ['01.jpg', '02.jpg', '03.jpg', '04.jpg', '05.jpg', '06.jpg', '07.jpg', '08.jpg', '09.jpg', '10.jpg', '11.jpg', '12.jpg', '13.jpg', '14.jpg'],
  },
  {
    slug: 'phlox-meadow',
    name: 'Phlox Meadow',
    city: 'san-antonio',
    bedrooms: 4,
    headline: 'A four-bedroom San Antonio home with a pool table, air hockey and a big backyard',
    description: [
      'A roomy two-story home with four bedrooms and six beds, made for families and groups, near Highway 281 and Evans.',
      'Downstairs has a living room, a pool table room, a dining room and a full kitchen with a laundry room nearby. Upstairs has an air hockey table and a TV room, and the backyard has a covered patio and a fire pit.',
    ],
    highlights: ['4 bedrooms, 6 beds', 'Pool table and air hockey', 'Covered patio and fire pit', 'Big backyard', 'Washer and dryer'],
    amenities: [...standardAmenities, 'Pool table', 'Air hockey table', 'Covered patio', 'Fire pit'],
    tone: 'sage',
    photos: ['01.jpg', '02.jpg', '03.jpg', '04.jpg', '05.jpg', '06.jpg', '07.jpg', '08.jpg', '09.jpg', '10.jpg', '11.jpg', '12.jpg', '13.jpg', '14.jpg'],
  },
  {
    slug: 'oat-st',
    name: 'Oat St',
    city: 'houston',
    bedrooms: 3,
    headline: 'A modern three-bedroom Houston home near NRG and downtown, with a fenced yard',
    description: [
      'A bright, modern three-bedroom townhome-style house close to NRG Stadium and downtown Houston, good for families, work trips and event weekends.',
      'The open living area has a large sectional and a TV wall, and the kitchen has an island with seating. The primary bath has a soaking tub and a walk-in shower, there is a desk set up for working, and the fenced backyard is private.',
    ],
    highlights: ['3 bedrooms', 'Near NRG Stadium and downtown', 'Open kitchen with island', 'Soaking tub in the primary bath', 'Fenced backyard'],
    amenities: [...standardAmenities, 'Work desk', 'Fenced backyard', 'Garage'],
    tone: 'navy',
    photos: ['01.jpg', '02.jpg', '03.jpg', '04.jpg', '05.jpg', '06.jpg', '07.jpg', '08.jpg', '09.jpg', '10.jpg', '11.jpg', '12.jpg', '13.jpg', '14.jpg'],
  },
  {
    slug: 'westmark-azim',
    name: 'Westmark Azim',
    city: 'san-antonio',
    headline: 'A San Antonio home with four king beds, five TVs and an eight-seat dining table',
    description: [
      'A roomy two-story home with 6 beds, including four king beds, and 2.5 bathrooms, good for families and groups.',
      'The big living room has a leather sectional, a stone fireplace and a large TV. There is an eight-seat dining table, a full kitchen with a breakfast table and bench, and a laundry room with a washer and dryer.',
    ],
    highlights: ['6 beds, 4 of them king', '2.5 bathrooms', '5 TVs', 'Eight-seat dining table', 'Stone fireplace'],
    amenities: [...standardAmenities, 'Fireplace'],
    tone: 'olive',
    photos: ['01.jpg', '02.jpg', '03.jpg', '04.jpg', '05.jpg', '06.jpg', '07.jpg', '08.jpg', '09.jpg', '10.jpg'],
  },
  {
    slug: 'sitio-plains',
    name: 'Sitio Plains',
    city: 'san-antonio',
    headline: 'A four-bed San Antonio home with a fenced backyard and a Tesla charger',
    description: [
      'A comfortable home with 4 beds and 2 bathrooms, good for families and small groups, with a fully fenced backyard.',
      'The open living area has a leather sofa set and a big TV, there is a dining table, a full kitchen with an island, and a laundry room with a washer and dryer. A Tesla charger is available for guests.',
    ],
    highlights: ['4 beds, 2 bathrooms', 'Fully fenced backyard', 'Tesla charger', 'Kitchen with island', 'TV in the bedrooms'],
    amenities: [...standardAmenities, 'Fenced backyard', 'Tesla charger'],
    tone: 'sand',
    photos: ['01.jpg', '02.jpg', '03.jpg', '04.jpg', '05.jpg', '06.jpg', '07.jpg', '08.jpg', '09.jpg', '10.jpg'],
  },
  {
    slug: 'crimson',
    featured: true,
    name: 'Crimson Star',
    city: 'san-antonio',
    bedrooms: 5,
    headline: 'A five-bedroom San Antonio home with a theater and a pool table',
    description: [
      'A five-bedroom San Antonio home with six beds, a 155-inch theater with a bed downstairs, and a pool and poker table, good for big families and groups.',
      'Browse the photos below for the living areas, kitchen, bedrooms and outdoor space.',
    ],
    highlights: ['5 bedrooms, 6 beds', '155-inch theater', 'Pool and poker table', 'Full kitchen'],
    amenities: standardAmenities,
    tone: 'sand',
    photos: ['01.jpg', '02.jpg', '03.jpg', '04.jpg', '05.jpg', '06.jpg', '07.jpg', '08.jpg', '09.jpg', '10.jpg', '11.jpg', '12.jpg', '13.jpg', '14.jpg', '15.jpg', '16.jpg', '17.jpg', '18.jpg', '19.jpg', '20.jpg', '21.jpg', '22.jpg', '23.jpg', '24.jpg', '25.jpg', '26.jpg', '27.jpg', '28.jpg', '29.jpg', '30.jpg', '31.jpg', '32.jpg', '33.jpg', '34.jpg', '35.jpg', '36.jpg', '37.jpg', '38.jpg', '39.jpg', '40.jpg'],
  },
  {
    slug: 'clay-oak',
    name: 'Clay Oak',
    city: 'san-antonio',
    bedrooms: 5,
    headline: 'A five-bedroom, four-bath San Antonio home for families and groups',
    description: [
      'A comfortable five-bedroom, four-bathroom home in San Antonio, good for families and groups.',
      'Browse the photos below for the living areas, kitchen, bedrooms and outdoor space.',
    ],
    highlights: ['5 bedrooms, 4 bathrooms', 'Full kitchen', 'Free parking'],
    amenities: standardAmenities,
    tone: 'sage',
    photos: ['01.jpg', '02.jpg', '03.jpg', '04.jpg', '05.jpg', '06.jpg', '07.jpg', '08.jpg', '09.jpg', '10.jpg', '11.jpg', '12.jpg', '13.jpg', '14.jpg', '15.jpg', '16.jpg', '17.jpg', '18.jpg', '19.jpg', '20.jpg', '21.jpg', '22.jpg', '23.jpg', '24.jpg', '25.jpg', '26.jpg', '27.jpg', '28.jpg', '29.jpg', '30.jpg', '31.jpg', '32.jpg', '33.jpg', '34.jpg', '35.jpg', '36.jpg', '37.jpg', '38.jpg', '39.jpg', '40.jpg'],
  },
  {
    slug: 'lake-valley',
    name: 'Lake Valley',
    city: 'san-antonio',
    bedrooms: 3,
    headline: 'A three-bedroom, two-bath San Antonio home close to Lackland',
    description: [
      'A three-bedroom, two-bathroom San Antonio home, close to Lackland Air Force Base, good for families and small groups.',
      'There is an air hockey table for the kids and the whole group.',
    ],
    highlights: ['3 bedrooms, 2 bathrooms', 'Air hockey table', 'Close to Lackland'],
    amenities: [...standardAmenities, 'Air hockey'],
    tone: 'olive',
    photos: ['01.jpg', '02.jpg', '03.jpg', '04.jpg', '05.jpg', '06.jpg', '07.jpg', '08.jpg', '09.jpg', '10.jpg', '11.jpg', '12.jpg', '13.jpg', '14.jpg', '15.jpg', '16.jpg', '17.jpg', '18.jpg', '19.jpg', '20.jpg', '21.jpg', '22.jpg', '23.jpg', '24.jpg', '25.jpg', '26.jpg', '27.jpg', '28.jpg', '29.jpg', '30.jpg', '31.jpg', '32.jpg', '33.jpg', '34.jpg', '35.jpg', '36.jpg', '37.jpg', '38.jpg', '39.jpg', '40.jpg'],
  },
  {
    slug: 'hideaway',
    name: 'Hideaway',
    city: 'san-antonio',
    bedrooms: 4,
    headline: 'A four-bedroom San Antonio home with a 130-inch theater',
    description: [
      'A four-bedroom San Antonio home with 6 beds and 3 full bathrooms, with a bedroom downstairs, good for families and groups.',
      'The home has a 130-inch theater for movie nights.',
    ],
    highlights: ['4 bedrooms, 6 beds', '3 full bathrooms', '130-inch theater', 'Bedroom downstairs'],
    amenities: [...standardAmenities, 'Home theater'],
    tone: 'sand',
    photos: ['01.jpg', '02.jpg', '03.jpg', '04.jpg', '05.jpg', '06.jpg', '07.jpg', '08.jpg', '09.jpg', '10.jpg', '11.jpg', '12.jpg', '13.jpg', '14.jpg', '15.jpg', '16.jpg', '17.jpg', '18.jpg', '19.jpg', '20.jpg', '21.jpg', '22.jpg', '23.jpg', '24.jpg', '25.jpg', '26.jpg', '27.jpg', '28.jpg', '29.jpg', '30.jpg', '31.jpg', '32.jpg', '33.jpg', '34.jpg', '35.jpg', '36.jpg', '37.jpg', '38.jpg', '39.jpg', '40.jpg'],
  },
  {
    slug: 'colt-river',
    name: 'Colt River',
    city: 'san-antonio',
    bedrooms: 3,
    headline: 'A three-bedroom, two-and-a-half-bath San Antonio home',
    description: [
      'A comfortable three-bedroom, 2.5-bathroom home in San Antonio, good for families and small groups.',
      'Browse the photos below for the living areas, kitchen, bedrooms and outdoor space.',
    ],
    highlights: ['3 bedrooms, 2.5 bathrooms', 'Full kitchen', 'Free parking'],
    amenities: standardAmenities,
    tone: 'sage',
    photos: ['01.jpg', '02.jpg', '03.jpg', '04.jpg', '05.jpg', '06.jpg', '07.jpg', '08.jpg', '09.jpg', '10.jpg', '11.jpg', '12.jpg', '13.jpg', '14.jpg', '15.jpg', '16.jpg', '17.jpg', '18.jpg', '19.jpg', '20.jpg', '21.jpg', '22.jpg', '23.jpg', '24.jpg', '25.jpg', '26.jpg', '27.jpg', '28.jpg', '29.jpg', '30.jpg', '31.jpg', '32.jpg', '33.jpg', '34.jpg', '35.jpg', '36.jpg', '37.jpg', '38.jpg', '39.jpg', '40.jpg'],
  },
  {
    slug: 'canyon-maple',
    name: 'Canyon Maple',
    city: 'san-antonio',
    bedrooms: 5,
    headline: 'A five-bedroom San Antonio home with a pool table, near JW Marriott',
    description: [
      'A five-bedroom, 2.5-bathroom San Antonio home with a pool table, close to the JW Marriott resort, good for families and groups.',
    ],
    highlights: ['5 bedrooms, 2.5 bathrooms', 'Pool table', 'Near JW Marriott'],
    amenities: [...standardAmenities, 'Pool table'],
    tone: 'olive',
    photos: ['01.jpg', '02.jpg', '03.jpg', '04.jpg', '05.jpg', '06.jpg', '07.jpg', '08.jpg', '09.jpg', '10.jpg', '11.jpg', '12.jpg', '13.jpg', '14.jpg', '15.jpg', '16.jpg', '17.jpg', '18.jpg', '19.jpg', '20.jpg', '21.jpg', '22.jpg', '23.jpg', '24.jpg', '25.jpg', '26.jpg', '27.jpg', '28.jpg', '29.jpg', '30.jpg', '31.jpg', '32.jpg', '33.jpg', '34.jpg', '35.jpg', '36.jpg', '37.jpg', '38.jpg', '39.jpg', '40.jpg'],
  },
  {
    slug: 'amber-crest',
    name: 'Amber Crest',
    city: 'san-antonio',
    headline: 'A six-bed, single-story San Antonio home near UTSA',
    description: [
      'A single-story San Antonio home with 6 beds in a gated community near UTSA, with a pool table.',
    ],
    highlights: ['6 beds, single story', 'Gated community', 'Pool table', 'Near UTSA'],
    amenities: [...standardAmenities, 'Pool table'],
    tone: 'sand',
    photos: ['01.jpg', '02.jpg', '03.jpg', '04.jpg', '05.jpg', '06.jpg', '07.jpg', '08.jpg', '09.jpg', '10.jpg', '11.jpg', '12.jpg', '13.jpg', '14.jpg', '15.jpg', '16.jpg', '17.jpg', '18.jpg', '19.jpg', '20.jpg', '21.jpg', '22.jpg', '23.jpg', '24.jpg', '25.jpg', '26.jpg', '27.jpg', '28.jpg', '29.jpg', '30.jpg', '31.jpg', '32.jpg', '33.jpg', '34.jpg', '35.jpg', '36.jpg', '37.jpg', '38.jpg', '39.jpg', '40.jpg'],
  },
  {
    slug: 'antigua',
    name: 'Antigua',
    city: 'san-antonio',
    bedrooms: 4,
    headline: 'A four-bedroom San Antonio home near JW Marriott',
    description: [
      'A four-bedroom, two-bathroom San Antonio home near the JW Marriott resort in the Evans and Bulverde area.',
    ],
    highlights: ['4 bedrooms, 2 bathrooms', 'Near JW Marriott'],
    amenities: standardAmenities,
    tone: 'sage',
    photos: ['01.jpg', '02.jpg', '03.jpg', '04.jpg', '05.jpg', '06.jpg', '07.jpg', '08.jpg', '09.jpg', '10.jpg', '11.jpg', '12.jpg', '13.jpg', '14.jpg', '15.jpg', '16.jpg', '17.jpg', '18.jpg', '19.jpg', '20.jpg', '21.jpg', '22.jpg', '23.jpg', '24.jpg', '25.jpg', '26.jpg', '27.jpg', '28.jpg', '29.jpg', '30.jpg', '31.jpg', '32.jpg', '33.jpg', '34.jpg', '35.jpg', '36.jpg', '37.jpg', '38.jpg', '39.jpg', '40.jpg'],
  },
  {
    slug: 'saffron-plum',
    name: 'Saffron Plum',
    city: 'san-antonio',
    bedrooms: 3,
    headline: 'A three-bedroom San Antonio home by JW Marriott and TPC',
    description: [
      'A stylish three-bedroom San Antonio home near the JW Marriott resort and TPC San Antonio, in the Bulverde area.',
    ],
    highlights: ['3 bedrooms', 'Near JW Marriott', 'Near TPC San Antonio'],
    amenities: standardAmenities,
    tone: 'sand',
    photos: ['01.jpg', '02.jpg', '03.jpg', '04.jpg', '05.jpg', '06.jpg', '07.jpg', '08.jpg', '09.jpg', '10.jpg', '11.jpg', '12.jpg', '13.jpg', '14.jpg', '15.jpg', '16.jpg', '17.jpg', '18.jpg', '19.jpg', '20.jpg', '21.jpg', '22.jpg', '23.jpg', '24.jpg', '25.jpg', '26.jpg', '27.jpg', '28.jpg', '29.jpg', '30.jpg', '31.jpg', '32.jpg', '33.jpg', '34.jpg', '35.jpg', '36.jpg', '37.jpg', '38.jpg', '39.jpg', '40.jpg'],
  },
  {
    slug: 'coral',
    name: 'Coral Grove',
    city: 'san-antonio',
    bedrooms: 7,
    headline: 'A seven-bed San Antonio home with a pool, ping pong and air hockey',
    description: [
      'A seven-bed San Antonio home with a swimming pool, a ping pong table, air hockey and a pool table, made for big groups.',
    ],
    highlights: ['7 beds', 'Swimming pool', 'Ping pong, air hockey and pool table'],
    amenities: [...standardAmenities, 'Pool', 'Ping pong', 'Air hockey', 'Pool table'],
    tone: 'sage',
    photos: ['01.jpg', '02.jpg', '03.jpg', '04.jpg', '05.jpg', '06.jpg', '07.jpg', '08.jpg', '09.jpg', '10.jpg', '11.jpg', '12.jpg', '13.jpg', '14.jpg', '15.jpg', '16.jpg', '17.jpg', '18.jpg', '19.jpg', '20.jpg', '21.jpg', '22.jpg', '23.jpg', '24.jpg', '25.jpg', '26.jpg', '27.jpg', '28.jpg', '29.jpg', '30.jpg', '31.jpg', '32.jpg', '33.jpg', '34.jpg', '35.jpg', '36.jpg', '37.jpg', '38.jpg', '39.jpg', '40.jpg'],
  },
  {
    slug: 'stormy-skies',
    name: 'Stormy Skies',
    city: 'san-antonio',
    bedrooms: 4,
    headline: 'A centrally located four-bedroom San Antonio home',
    description: [
      'A centrally located four-bedroom, 2.5-bathroom San Antonio home, good for families and groups.',
    ],
    highlights: ['4 bedrooms, 2.5 bathrooms', 'Central location'],
    amenities: standardAmenities,
    tone: 'olive',
    photos: ['01.jpg', '02.jpg', '03.jpg', '04.jpg', '05.jpg', '06.jpg', '07.jpg', '08.jpg', '09.jpg', '10.jpg', '11.jpg', '12.jpg', '13.jpg', '14.jpg', '15.jpg', '16.jpg', '17.jpg', '18.jpg', '19.jpg', '20.jpg', '21.jpg', '22.jpg', '23.jpg', '24.jpg', '25.jpg', '26.jpg', '27.jpg', '28.jpg', '29.jpg', '30.jpg', '31.jpg', '32.jpg', '33.jpg', '34.jpg', '35.jpg', '36.jpg', '37.jpg', '38.jpg', '39.jpg', '40.jpg'],
  },
  {
    slug: 'donely',
    name: 'Donely',
    city: 'san-antonio',
    headline: 'A six-king-bed San Antonio home with a pool and a pool table',
    description: [
      'A centrally located San Antonio home with 6 king beds, a swimming pool and a pool table.',
    ],
    highlights: ['6 king beds', 'Swimming pool', 'Pool table', 'Central location'],
    amenities: [...standardAmenities, 'Pool', 'Pool table'],
    tone: 'sand',
    photos: ['01.jpg', '02.jpg', '03.jpg', '04.jpg', '05.jpg', '06.jpg', '07.jpg', '08.jpg', '09.jpg', '10.jpg', '11.jpg', '12.jpg', '13.jpg', '14.jpg', '15.jpg', '16.jpg', '17.jpg', '18.jpg', '19.jpg', '20.jpg', '21.jpg', '22.jpg', '23.jpg', '24.jpg', '25.jpg', '26.jpg', '27.jpg', '28.jpg'],
  },
];

export function homeBySlug(slug: string): Home | undefined {
  return homes.find((h) => h.slug === slug);
}

export function homesInCity(city: CitySlug): Home[] {
  return homes.filter((h) => h.city === city);
}
