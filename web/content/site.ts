// Business details shown across the site. Taken from alamocityrental.com.
export const site = {
  name: 'Alamo City Rental',
  tagline: 'Holiday homes across Texas',
  phone: '(210) 901-9440',
  phoneHref: 'tel:+12109019440',
  email: 'alamocityrental210@gmail.com',
  /** Add the Instagram profile link here once confirmed; the link is hidden while empty. */
  instagram: '',
  url: 'https://alamocityrental.com',
};

export type CitySlug = 'san-antonio' | 'austin' | 'houston';

export interface City {
  slug: CitySlug;
  name: string;
  headline: string;
  intro: string;
  /** Solid tone used until a photo is added. */
  tone: string;
  nearby: string[];
}

export const cities: City[] = [
  {
    slug: 'san-antonio',
    name: 'San Antonio',
    headline: 'Missions, the River Walk and long Texas evenings',
    intro:
      'Stay a short drive from the River Walk, the Alamo and the Pearl. San Antonio is our home city, and most of our homes are here.',
    tone: 'stone',
    nearby: ['The River Walk', 'The Alamo', 'The Pearl', 'San Antonio Missions', 'SeaWorld and Six Flags Fiesta Texas'],
  },
  {
    slug: 'austin',
    name: 'Austin',
    headline: 'Live music, lake days and Hill Country drives',
    intro: 'A base for South Congress, Lady Bird Lake and weekend trips into the Hill Country.',
    tone: 'sage',
    nearby: ['South Congress', 'Lady Bird Lake', 'Zilker Park', 'Sixth Street', 'Texas Hill Country wineries'],
  },
  {
    slug: 'houston',
    name: 'Houston',
    headline: 'Museums, food and room for everyone',
    intro: 'Space for families and groups visiting the Museum District, the Medical Center or a game at NRG.',
    tone: 'navy',
    nearby: ['Museum District', 'Texas Medical Center', 'NRG Stadium', 'Space Center Houston', 'Buffalo Bayou Park'],
  },
];

export function cityBySlug(slug: string): City | undefined {
  return cities.find((c) => c.slug === slug);
}
