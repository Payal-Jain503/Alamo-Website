'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

export interface SearchItem {
  slug: string;
  city: string;
  bedrooms?: number;
  maxGuests?: number;
  beds?: number;
  features: string[];
}

interface HomeSearchProps {
  items: SearchItem[];
  cards: Record<string, ReactNode>;
  cities: { slug: string; name: string }[];
  featureOptions: { key: string; label: string }[];
}

/** Filters the pre-rendered home cards by city, bedrooms and guests. */
export function HomeSearch({ items, cards, cities, featureOptions }: HomeSearchProps) {
  const [city, setCity] = useState('');
  const [bedrooms, setBedrooms] = useState('');
  const [guests, setGuests] = useState('');
  const [beds, setBeds] = useState('');
  const [feature, setFeature] = useState('');
  const [dates, setDates] = useState<{ in: string; out: string }>({ in: '', out: '' });

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setCity(q.get('city') ?? '');
    setBedrooms(['3', '4', '5'].includes(q.get('bedrooms') ?? '') ? q.get('bedrooms')! : '');
    setGuests(q.get('guests') ?? '');
    setBeds(['4', '6', '8'].includes(q.get('beds') ?? '') ? q.get('beds')! : '');
    setFeature(featureOptions.some((f) => f.key === q.get('amenity')) ? q.get('amenity')! : '');
    setDates({ in: q.get('in') ?? '', out: q.get('out') ?? '' });
  }, [featureOptions]);

  const results = useMemo(
    () =>
      items.filter((h) => {
        if (city && h.city !== city) return false;
        // 3 and 4 mean exactly that many; 5 means five or more.
        if (bedrooms && (bedrooms === '5' ? (h.bedrooms ?? 0) < 5 : h.bedrooms !== Number(bedrooms))) return false;
        // Homes without a confirmed guest limit stay in the results.
        if (guests && h.maxGuests !== undefined && h.maxGuests < Number(guests)) return false;
        // Homes whose bed count is not confirmed stay in the results.
        if (beds && h.beds !== undefined && h.beds < Number(beds)) return false;
        if (feature && !h.features.includes(feature)) return false;
        return true;
      }),
    [items, city, bedrooms, guests, beds, feature],
  );

  const enquiry = new URLSearchParams();
  if (dates.in) enquiry.set('in', dates.in);
  if (dates.out) enquiry.set('out', dates.out);
  if (guests) enquiry.set('guests', guests);

  return (
    <div className="search">
      <div className="filters" role="search">
        <label>
          <span>City</span>
          <select id="f-city" value={city} onChange={(e) => setCity(e.target.value)}>
            <option value="">All cities</option>
            {cities.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Bedrooms</span>
          <select id="f-beds" value={bedrooms} onChange={(e) => setBedrooms(e.target.value)}>
            <option value="">Any</option>
            <option value="3">3 bedrooms</option>
            <option value="4">4 bedrooms</option>
            <option value="5">5 or more</option>
          </select>
        </label>
        <label>
          <span>Beds</span>
          <select id="f-bed-count" value={beds} onChange={(e) => setBeds(e.target.value)}>
            <option value="">Any</option>
            <option value="4">4 or more</option>
            <option value="6">6 or more</option>
            <option value="8">8 or more</option>
          </select>
        </label>
        <label>
          <span>Amenities</span>
          <select id="f-amenity" value={feature} onChange={(e) => setFeature(e.target.value)}>
            <option value="">Any</option>
            {featureOptions.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Guests</span>
          <input id="f-guests" type="number" min={1} max={30} inputMode="numeric" placeholder="Any" value={guests} onChange={(e) => setGuests(e.target.value)} />
        </label>
        <p className="result-count" aria-live="polite">
          {results.length} {results.length === 1 ? 'home' : 'homes'}
        </p>
      </div>

      {dates.in && dates.out ? (
        <p className="dates-note">
          Live availability is coming soon. For {dates.in} to {dates.out}, pick a home and send an enquiry, or{' '}
          <Link href={`/contact/?${enquiry}`}>ask us which homes are free</Link>.
        </p>
      ) : null}

      {results.length ? (
        <div className="home-grid">{results.map((h) => <div key={h.slug}>{cards[h.slug]}</div>)}</div>
      ) : (
        <div className="empty">
          <p>No homes match those filters.</p>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setCity('');
              setBedrooms('');
              setGuests('');
              setBeds('');
              setFeature('');
            }}
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}
