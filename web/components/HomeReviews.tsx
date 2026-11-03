'use client';

import { useEffect, useState } from 'react';
import { Stars } from './Stars';

interface Data {
  count: number;
  average: number | null;
  reviews: Array<{ name: string; rating: number; comment: string; date: string }>;
}

/** Guest reviews for a home. Shows nothing until there is at least one. */
export function HomeReviews({ slug }: { slug: string }) {
  const [data, setData] = useState<Data | null>(null);

  useEffect(() => {
    fetch(`/api/reviews?home=${encodeURIComponent(slug)}`)
      .then((r) => (r.ok && r.headers.get('content-type')?.includes('application/json') ? (r.json() as Promise<Data>) : null))
      .then((d) => setData(d && d.count > 0 ? d : null))
      .catch(() => setData(null));
  }, [slug]);

  if (!data) return null;
  return (
    <section className="section tight reviews">
      <div className="wrap">
        <h2>
          Guest reviews <span className="muted small">{data.average} average · {data.count} {data.count === 1 ? 'review' : 'reviews'}</span>
        </h2>
        <div className="review-list">
          {data.reviews.map((r, i) => (
            <article key={i} className="review">
              <p><Stars rating={r.rating} /> <strong>{r.name}</strong> <span className="muted small">{new Date(`${r.date}T12:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span></p>
              {r.comment && <p>{r.comment}</p>}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
