import Link from 'next/link';
import { AvailabilityBar } from '@/components/AvailabilityBar';
import { HomeCard } from '@/components/HomeCard';
import { Photo } from '@/components/Photo';
import { Slideshow, type Slide } from '@/components/Slideshow';
import { homes, homesInCity } from '@/content/homes';
import { cities, site } from '@/content/site';

const slides: Slide[] = [
  {
    eyebrow: 'Stay',
    title: 'Spacious holiday homes across Texas',
    text: 'Three, four and five bedroom homes in San Antonio, Austin and Houston, ready for families and groups.',
    media: <Photo src="photos/hero/stay.jpg" alt="Living room in an Alamo City Rental home" tone="navy" priority label="Hero photo coming soon" />,
  },
  {
    eyebrow: 'Gather',
    title: 'Everyone under one roof',
    text: 'Big kitchens, long tables and room to spread out, for reunions, celebrations and team trips.',
    media: <Photo src="photos/hero/gather.jpg" alt="Dining table set for a group" tone="olive" label="Hero photo coming soon" />,
  },
  {
    eyebrow: 'Explore',
    title: 'The Texas you came for',
    text: 'Minutes from the River Walk, Austin’s live music and Houston’s museums. We’ll point you to the best of it.',
    media: <Photo src="photos/hero/explore.jpg" alt="San Antonio River Walk at dusk" tone="adobe" label="Hero photo coming soon" />,
  },
];

export default function HomePage() {
  const featured = homes.filter((h) => h.featured);

  return (
    <>
      <Slideshow slides={slides} />
      <div className="wrap bar-holder">
        <AvailabilityBar cities={cities.map((c) => ({ slug: c.slug, name: c.name }))} />
      </div>

      <section className="section welcome">
        <div className="wrap welcome-grid">
          <div>
            <p className="eyebrow">Welcome to Alamo City Rental</p>
            <h2>Holiday homes made for getting together</h2>
          </div>
          <div className="prose">
            <p>
              We’re a San Antonio family business with holiday homes across three Texas cities. Every home is chosen for
              space, comfort and an easy drive to the places you came to see.
            </p>
            <p>
              Book direct with us and you deal with the people who look after the homes, from your first question to
              check-out.
            </p>
            <Link href="/about/" className="text-link">
              About us
            </Link>
          </div>
        </div>
      </section>

      <section className="section tinted">
        <div className="wrap">
          <div className="section-head">
            <div>
              <p className="eyebrow">Our homes</p>
              <h2>Find your home in Texas</h2>
            </div>
            <Link href="/homes/" className="btn btn-ghost">
              See all homes
            </Link>
          </div>
          <div className="home-grid">
            {featured.map((h) => (
              <HomeCard key={h.slug} home={h} />
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="section-head">
            <div>
              <p className="eyebrow">Make the most of your stay</p>
              <h2>Three cities, one host</h2>
            </div>
          </div>
          <div className="city-grid">
            {cities.map((c) => (
              <Link key={c.slug} href={`/cities/${c.slug}/`} className="city-card">
                <Photo src={`photos/cities/${c.slug}.jpg`} alt={c.name} tone={c.tone as 'stone'} />
                <div className="city-card-body">
                  <h3>{c.name}</h3>
                  <p>{c.headline}</p>
                  <span className="text-link">
                    {homesInCity(c.slug).length} {homesInCity(c.slug).length === 1 ? 'home' : 'homes'}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section promise">
        <div className="wrap promise-grid">
          <div>
            <h3>Book direct</h3>
            <p>Reserve with the owners. No booking-site service fee added at checkout.</p>
          </div>
          <div>
            <h3>Local hosts</h3>
            <p>Our team is based in San Antonio and a phone call away during your stay.</p>
          </div>
          <div>
            <h3>Room for everyone</h3>
            <p>Homes from three to five bedrooms, set up for families and groups.</p>
          </div>
        </div>
      </section>

      <section className="section cta-band">
        <div className="wrap cta-inner">
          <div>
            <p className="eyebrow light">Plan your stay</p>
            <h2>Tell us your dates and we’ll find the right home</h2>
          </div>
          <div className="cta-actions">
            <Link href="/contact/" className="btn btn-light">
              Send an enquiry
            </Link>
            <a href={site.phoneHref} className="cta-phone">
              {site.phone}
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
