'use client';

import { useState } from 'react';
import { sendReview, type Trip } from '@/lib/auth';
import { Stars } from './Stars';

/** Lets a guest rate a finished stay, and change it later. */
export function ReviewForm({ trip }: { trip: Trip }) {
  const [saved, setSaved] = useState(trip.review);
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(trip.review?.rating ?? 5);
  const [comment, setComment] = useState(trip.review?.comment ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await sendReview(trip.bookingId, rating, comment.trim());
      setSaved({ rating, comment: comment.trim() });
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  if (!open)
    return (
      <p className="muted small">
        {saved ? <>Your review: <Stars rating={saved.rating} />{' '}</> : null}
        <button className="link-button" onClick={() => setOpen(true)}>
          {saved ? 'Edit review' : 'Leave a review'}
        </button>
      </p>
    );

  return (
    <form className="review-form" onSubmit={submit}>
      <label>
        <span>Rating</span>
        <select value={rating} onChange={(e) => setRating(Number(e.target.value))}>
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>{'★'.repeat(n)} {n}</option>
          ))}
        </select>
      </label>
      <label>
        <span>Your comments (optional)</span>
        <textarea maxLength={1000} rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
      </label>
      {error && <p className="form-error">{error}</p>}
      <button className="btn btn-solid" disabled={busy}>{busy ? 'Saving…' : 'Save review'}</button>{' '}
      <button type="button" className="link-button" onClick={() => setOpen(false)}>Cancel</button>
    </form>
  );
}
