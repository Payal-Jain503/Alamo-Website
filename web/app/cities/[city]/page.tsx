import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { HomeCard } from '@/components/HomeCard';
import { Photo } from '@/components/Photo';
import { homesInCity } from '@/content/homes';
import { cities, cityBySlug } from '@/content/site';

type Params = { city: string };

export function generateStaticParams(): Params[] {
  return cities.map((c) => ({ city: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const city = cityBySlug((await params).city);
  if (!city) return {};
  return { title: `Holiday homes in ${city.name}`, description: city.intro };
}

export default async function CityPage({ params }: { params: Promise<Params> }) {
  const city = cityBySlug((await params).city);
  if (!city) notFound();
  const list = homesInCity(city.slug);

  return (
    <>
      <section className="city-hero">
        <Photo src={`photos/cities/${city.slug}.jpg`} alt={city.name} tone={city.tone as 'stone'} priority />
        <div className="slide-shade" aria-hidden="true" />
        <div className="wrap city-hero-copy">
          <p className="eyebrow light">Holiday homes in</p>
          <h1>{city.name}</h1>
          <p className="slide-text">{city.headline}</p>
        </div>
      </section>
      <section className="section">
        <div className="wrap welcome-grid">
          <div className="prose">
            <p className="lede-dark">{city.intro}</p>
          </div>
          <div>
            <p className="eyebrow">Close to</p>
            <ul className="amenities">
              {city.nearby.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>
      <section className="section tinted">
        <div className="wrap">
          <div className="section-head">
            <h2>
              Our {city.name} {list.length === 1 ? 'home' : 'homes'}
            </h2>
          </div>
          <div className="home-grid">
            {list.map((h) => (
              <HomeCard key={h.slug} home={h} />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
