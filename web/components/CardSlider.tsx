'use client';

import { useEffect, useRef, useState } from 'react';

const MAX_SLIDES = 6;
const HOVER_MS = 1800;

/**
 * The photo area of a home card. Shows the cover photo and lets visitors flip
 * through more with arrows and dots; photos also advance on their own while
 * the pointer is over the card. Only photos that have been shown are loaded,
 * so a page full of cards stays fast.
 */
export function CardSlider({ slug, name, photos }: { slug: string; name: string; photos: string[] }) {
  const slides = photos.slice(0, MAX_SLIDES);
  const [index, setIndex] = useState(0);
  const [seen, setSeen] = useState<number[]>([0]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const go = (next: number) => {
    const i = (next + slides.length) % slides.length;
    setIndex(i);
    setSeen((s) => (s.includes(i) ? s : [...s, i]));
  };

  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };
  const start = () => {
    if (slides.length < 2 || timer.current) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    timer.current = setInterval(() => setIndex((i) => {
      const n = (i + 1) % slides.length;
      setSeen((s) => (s.includes(n) ? s : [...s, n]));
      return n;
    }), HOVER_MS);
  };
  useEffect(() => stop, []);

  // The card is a link, so the controls must not follow it.
  const press = (e: React.SyntheticEvent, next: number) => {
    e.preventDefault();
    e.stopPropagation();
    go(next);
  };

  return (
    <div className="card-slider" onMouseEnter={start} onMouseLeave={stop} onFocus={stop}>
      {slides.map((file, i) =>
        seen.includes(i) ? (
          <img
            key={file}
            src={`/photos/${slug}/${file}`}
            alt={i === index ? name : ''}
            aria-hidden={i === index ? undefined : true}
            className={`photo card-slide${i === index ? ' is-active' : ''}`}
            loading={i === 0 ? 'lazy' : 'eager'}
            decoding="async"
          />
        ) : null,
      )}
      {slides.length > 1 ? (
        <>
          <button type="button" className="card-arrow card-prev" aria-label="Previous photo" onClick={(e) => press(e, index - 1)}>
            ‹
          </button>
          <button type="button" className="card-arrow card-next" aria-label="Next photo" onClick={(e) => press(e, index + 1)}>
            ›
          </button>
          <div className="card-dots" aria-hidden="true">
            {slides.map((f, i) => (
              <span key={f} className={i === index ? 'is-active' : ''} />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
