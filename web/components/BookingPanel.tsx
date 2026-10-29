'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

/**
 * The booking box on each home's page. For now it sends guests to the
 * enquiry form with their dates. Live prices, the calendar and checkout
 * plug in here once the booking API is running.
 */
export function BookingPanel({ slug, homeName, phone }: { slug: string; homeName: string; phone: string }) {
  const router = useRouter();
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guests, setGuests] = useState('');
  const [error, setError] = useState('');

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (checkIn && checkOut && checkOut <= checkIn) {
      setError('Check-out needs to be after check-in.');
      return;
    }
    const q = new URLSearchParams({ home: slug });
    if (checkIn) q.set('in', checkIn);
    if (checkOut) q.set('out', checkOut);
    if (guests) q.set('guests', guests);
    router.push(`/contact/?${q}`);
  };

  return (
    <aside className="booking-panel" aria-label={`Book ${homeName}`}>
      <p className="panel-title">Plan your stay</p>
      <form onSubmit={onSubmit}>
        <div className="field-row">
          <label>
            <span>Check-in</span>
            <input id="bp-in" type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
          </label>
          <label>
            <span>Check-out</span>
            <input id="bp-out" type="date" value={checkOut} min={checkIn || undefined} onChange={(e) => setCheckOut(e.target.value)} />
          </label>
        </div>
        <label>
          <span>Guests</span>
          <input id="bp-guests" type="number" min={1} max={30} inputMode="numeric" placeholder="2" value={guests} onChange={(e) => setGuests(e.target.value)} />
        </label>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <button type="submit" className="btn btn-solid wide">
          Request these dates
        </button>
      </form>
      <p className="muted small">Online booking with live prices is coming soon. Until then we confirm every request personally.</p>
      <p className="panel-phone">
        Or call <a href={`tel:${phone.replace(/[^\d+]/g, '')}`}>{phone}</a>
      </p>
    </aside>
  );
}
