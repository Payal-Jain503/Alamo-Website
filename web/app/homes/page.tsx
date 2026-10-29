import type { Metadata } from 'next';
import { HomeCard } from '@/components/HomeCard';
import { HomeSearch } from '@/components/HomeSearch';
import { homes } from '@/content/homes';
import { cities } from '@/content/site';

export const metadata: Metadata = {
  title: 'Our homes',
  description: 'Browse Alamo City Rental holiday homes in San Antonio, Austin and Houston.',
};

export default function HomesPage() {
  const cards = Object.fromEntries(homes.map((h) => [h.slug, <HomeCard key={h.slug} home={h} />]));
  return (
    <>
      <section className="page-head">
        <div className="wrap">
          <p className="eyebrow">Our homes</p>
          <h1>Find your home in Texas</h1>
          <p className="lede">Filter by city, bedrooms and group size, then send us your dates.</p>
        </div>
      </section>
      <section className="section tight">
        <div className="wrap">
          <HomeSearch
            items={homes.map((h) => ({ slug: h.slug, city: h.city, bedrooms: h.bedrooms, maxGuests: h.maxGuests }))}
            cards={cards}
            cities={cities.map((c) => ({ slug: c.slug, name: c.name }))}
          />
        </div>
      </section>
    </>
  );
}
