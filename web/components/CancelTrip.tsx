'use client';

import { useState } from 'react';
import { cancelTrip, type Trip } from '@/lib/auth';
import { usd } from '@/lib/bookingApi';

/** Days from today to check-in, counted in whole calendar days. */
function daysUntil(iso: string) {
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const [y, m, d] = iso.split('-').map(Number);
  return Math.round((Date.UTC(y!, m! - 1, d!) - today) / 86_400_000);
}

/** The refund the policy gives today. The server works it out again when the guest confirms. */
function refundNow(trip: Trip) {
  return daysUntil(trip.checkIn) >= 5 ? trip.totalCents : Math.floor(trip.totalCents / 2);
}

export function CancelTrip({ trip, onDone }: { trip: Trip; onDone: (refundCents: number) => void }) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (daysUntil(trip.checkIn) < 1) return null;

  if (!asking)
    return (
      <p className="muted small">
        <button className="link-button" onClick={() => setAsking(true)}>
          Cancel booking
        </button>
      </p>
    );

  const refund = refundNow(trip);
  const confirm = async () => {
    setBusy(true);
    setError('');
    try {
      onDone(await cancelTrip(trip.bookingId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setBusy(false);
    }
  };

  return (
    <div className="review-form">
      <p className="small">
        {refund === trip.totalCents ? 'Full refund' : '50% refund'}: <strong>{usd(refund)}</strong> goes back to your card. {refund === trip.totalCents ? 'Cancelling less than 5 days before check-in refunds 50%.' : 'Cancelling 5 or more days before check-in refunds in full.'}
      </p>
      {error && <p className="form-error">{error}</p>}
      <div>
        <button className="btn btn-solid" disabled={busy} onClick={confirm}>
          {busy ? 'Cancelling…' : 'Yes, cancel my booking'}
        </button>{' '}
        <button className="link-button" onClick={() => setAsking(false)}>
          Keep it
        </button>
      </div>
    </div>
  );
}
