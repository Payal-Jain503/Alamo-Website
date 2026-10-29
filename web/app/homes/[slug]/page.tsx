import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BookingPanel } from '@/components/BookingPanel';
import { HomeCard } from '@/components/HomeCard';
import { Photo } from '@/components/Photo';
import { homeBySlug, homes, homesInCity } from '@/content/homes';
import { cityBySlug, site } from '@/content/site';

type Params = { slug: string };

export function generateStaticParams(): Params[] {
  return homes.map((h) => ({ slug: h.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const home = homeBySlug((await params).slug);
  if (!home) return {};
  return { title: home.name, description: home.headline };
}

const GALLERY_SLOTS = 5;

export default async function HomeDetailPage({ params }: { params: Promise<Params> }) {
  const home = homeBySlug((await params).slug);
  if (!home) notFound();
  const city = cityBySlug(home.city)!;
  const others = homesInCity(home.city).filter((h) => h.slug !== home.slug).slice(0, 3);

  const facts = [
    home.bedrooms && { label: 'Bedrooms', value: home.bedrooms },
    home.bathrooms && { label: 'Bathrooms', value: home.bathrooms },
    home.maxGuests && { label: 'Guests', value: home.maxGuests },
  ].filter(Boolean) as { label: string; value: number }[];

  const gallery = Array.from({ length: GALLERY_SLOTS }, (_, i) => home.photos[i]);

  return (
    <>
      <section className="detail-head">
        <div className="wrap">
          <nav className="crumbs" aria-label="Breadcrumb">
            <Link href="/homes/">Homes</Link>
            <span aria-hidden="true">/</span>
            <Link href={`/cities/${city.slug}/`}>{city.name}</Link>
          </nav>
          <h1>{home.name}</h1>
          <p className="lede">{home.headline}</p>
        </div>
      </section>

      <section className="wrap gallery" aria-label="Photos">
        {gallery.map((file, i) => (
          <div key={i} className={`gallery-item g${i}`}>
            <Photo
              src={file ? `photos/${home.slug}/${file}` : undefined}
              alt={`${home.name}, photo ${i + 1}`}
              tone={home.tone}
              priority={i === 0}
              label={i === 0 ? 'Photos coming soon' : ''}
            />
          </div>
        ))}
      </section>

      <section className="section tight">
        <div className="wrap detail-grid">
          <div className="detail-main">
            {facts.length ? (
              <dl className="facts-row">
                {facts.map((f) => (
                  <div key={f.label}>
                    <dt>{f.label}</dt>
                    <dd>{f.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}

            <div className="prose">
              {home.description.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>

            <h2 className="h-sub">Highlights</h2>
            <ul className="ticks">
              {home.highlights.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>

            <h2 className="h-sub">Amenities</h2>
            <ul className="amenities">
              {home.amenities.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>

            {home.sleeping?.length ? (
              <>
                <h2 className="h-sub">Sleeping arrangements</h2>
                <ul className="ticks">
                  {home.sleeping.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </>
            ) : null}

            <h2 className="h-sub">Nearby in {city.name}</h2>
            <ul className="amenities">
              {city.nearby.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>

            <h2 className="h-sub">Good to know</h2>
            <p>
              Check-in times, house rules and the cancellation policy for this home are on our{' '}
              <Link href="/policies/">policies page</Link>.
            </p>
          </div>
          <BookingPanel slug={home.slug} homeName={home.name} phone={site.phone} />
        </div>
      </section>

      {others.length ? (
        <section className="section tinted">
          <div className="wrap">
            <div className="section-head">
              <h2>More homes in {city.name}</h2>
            </div>
            <div className="home-grid">
              {others.map((h) => (
                <HomeCard key={h.slug} home={h} />
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
