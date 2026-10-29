'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

/** The search bar that floats under the hero. Sends guests to the search page with their choices. */
export function AvailabilityBar({ cities }: { cities: { slug: string; name: string }[] }) {
  const router = useRouter();
  const [city, setCity] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guests, setGuests] = useState('');

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const q = new URLSearchParams();
    if (city) q.set('city', city);
    if (checkIn) q.set('in', checkIn);
    if (checkOut) q.set('out', checkOut);
    if (guests) q.set('guests', guests);
    router.push(`/homes/${q.size ? `?${q}` : ''}`);
  };

  return (
    <form className="availability" onSubmit={onSubmit} aria-label="Check availability">
      <label>
        <span>Destination</span>
        <select id="bar-city" value={city} onChange={(e) => setCity(e.target.value)}>
          <option value="">All cities</option>
          {cities.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Check-in</span>
        <input id="bar-in" type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
      </label>
      <label>
        <span>Check-out</span>
        <input id="bar-out" type="date" value={checkOut} min={checkIn || undefined} onChange={(e) => setCheckOut(e.target.value)} />
      </label>
      <label>
        <span>Guests</span>
        <input id="bar-guests" type="number" min={1} max={30} inputMode="numeric" placeholder="2" value={guests} onChange={(e) => setGuests(e.target.value)} />
      </label>
      <button type="submit" className="btn btn-solid">
        Check availability
      </button>
    </form>
  );
}
