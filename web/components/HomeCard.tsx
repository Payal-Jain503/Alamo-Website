import Link from 'next/link';
import type { Home } from '@/content/homes';
import { cityBySlug } from '@/content/site';
import { Photo } from './Photo';
import { CardSlider } from './CardSlider';

export function HomeCard({ home }: { home: Home }) {
  const city = cityBySlug(home.city);
  const facts = [
    home.bedrooms ? `${home.bedrooms} bedrooms` : null,
    home.bathrooms ? `${home.bathrooms} baths` : null,
    home.maxGuests ? `Sleeps ${home.maxGuests}` : null,
  ].filter(Boolean);

  return (
    <article className="home-card">
      <Link href={`/homes/${home.slug}/`} className="home-card-link">
        <div className="home-card-photo">
          {home.photos.length > 1 ? (
            <CardSlider slug={home.slug} name={home.name} photos={home.photos} />
          ) : (
            <Photo src={home.photos[0] ? `photos/${home.slug}/${home.photos[0]}` : undefined} alt={home.name} tone={home.tone} />
          )}
        </div>
        <div className="home-card-body">
          <p className="eyebrow">{city?.name}</p>
          <h3>{home.name}</h3>
          <p className="home-card-line">{home.headline}</p>
          {facts.length ? <p className="facts">{facts.join(' · ')}</p> : null}
          <span className="text-link">View home</span>
        </div>
      </Link>
    </article>
  );
}
