'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import { getAvailability } from '@/lib/bookingApi';
import { DateRangeFields } from '@/components/DateRangeFields';
import { GuestStepper } from '@/components/GuestStepper';

/** The search bar that floats under the hero. Sends guests to the search page with their choices. */
export function AvailabilityBar({ cities, homes }: { cities: { slug: string; name: string }[]; homes: { slug: string; city: string }[] }) {
  const router = useRouter();
  const [city, setCity] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guests, setGuests] = useState('');
  // Nights when every home in the chosen city (or every home) is taken. Those can't be picked.
  const [full, setFull] = useState<Set<string>>(new Set());
  const loaded = useRef(new Map<string, Set<string>>());

  const loadFull = async () => {
    const cached = loaded.current.get(city);
    if (cached) return setFull(cached);
    const pool = homes.filter((h) => !city || h.city === city);
    const sets = await Promise.all(pool.map((h) => getAvailability(h.slug).catch(() => new Set<string>())));
    // A home whose calendar can't be read counts as free, so nothing is crossed out by mistake.
    const all = sets.length ? [...sets[0]].filter((d) => sets.every((s) => s.has(d))) : [];
    const result = new Set(all);
    loaded.current.set(city, result);
    setFull(result);
  };

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
      <DateRangeFields
        idPrefix="bar"
        blocked={full}
        onOpen={loadFull}
        checkIn={checkIn}
        checkOut={checkOut}
        onChange={(a, b) => {
          setCheckIn(a);
          setCheckOut(b);
        }}
      />
      <div className="field">
        <span>Guests</span>
        <GuestStepper id="bar-guests" value={guests} onChange={setGuests} />
      </div>
      <button type="submit" className="btn btn-solid">
        Check availability
      </button>
    </form>
  );
}
