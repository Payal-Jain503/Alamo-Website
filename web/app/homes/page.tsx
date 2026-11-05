import type { Metadata } from 'next';
import { HomeCard } from '@/components/HomeCard';
import { HomeSearch } from '@/components/HomeSearch';
import { homes } from '@/content/homes';
import { bedCount, featureFilters, featuresOf } from '@/content/homeFacts';
import { cities } from '@/content/site';
import { nightlyPrice } from '@/content/nightly';
import { Suspense } from 'react';

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
          <p className="lede">Filter by city, bedrooms, beds, amenities and group size, then send us your dates.</p>
        </div>
      </section>
      <section className="section tight">
        <div className="wrap">
          <Suspense>
          <HomeSearch
            items={homes.map((h) => ({ slug: h.slug, city: h.city, bedrooms: h.bedrooms, maxGuests: h.maxGuests, price: nightlyPrice[h.slug], beds: bedCount(h), features: featuresOf(h) }))}
            featureOptions={featureFilters.map((f) => ({ key: f.key, label: f.label })).filter((f) => homes.some((h) => featuresOf(h).includes(f.key)))}
            cards={cards}
            cities={cities.map((c) => ({ slug: c.slug, name: c.name }))}
          />
          </Suspense>
        </div>
      </section>
    </>
  );
}
