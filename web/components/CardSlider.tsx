'use client';

import { useEffect, useRef, useState } from 'react';

const MAX_SLIDES = 6;
const AUTO_MS = 4000;

/**
 * The photo area of a home card. Photos rotate on their own while the card is
 * on screen, and visitors can also flip through them with the arrows. Rotation
 * pauses while the pointer or keyboard focus is on the card. Only photos that
 * have been shown are loaded, so a page full of cards stays fast.
 */
export function CardSlider({ slug, name, photos }: { slug: string; name: string; photos: string[] }) {
  const slides = photos.slice(0, MAX_SLIDES);
  const [index, setIndex] = useState(0);
  const [seen, setSeen] = useState<number[]>([0]);
  const paused = useRef(false);
  const visible = useRef(false);
  const root = useRef<HTMLDivElement>(null);

  const show = (next: number) => {
    const i = (next + slides.length) % slides.length;
    setIndex(i);
    setSeen((s) => (s.includes(i) ? s : [...s, i]));
  };

  useEffect(() => {
    if (slides.length < 2) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const el = root.current;
    const io = new IntersectionObserver(([entry]) => { visible.current = !!entry?.isIntersecting; }, { threshold: 0.3 });
    if (el) io.observe(el);
    // A random start delay keeps the cards from all flipping together.
    let interval: ReturnType<typeof setInterval> | undefined;
    const startDelay = setTimeout(() => {
      interval = setInterval(() => {
        if (paused.current || !visible.current) return;
        setIndex((i) => {
          const n = (i + 1) % slides.length;
          setSeen((s) => (s.includes(n) ? s : [...s, n]));
          return n;
        });
      }, AUTO_MS);
    }, Math.random() * AUTO_MS);
    return () => {
      io.disconnect();
      clearTimeout(startDelay);
      if (interval) clearInterval(interval);
    };
  }, [slides.length]);

  // The card is a link, so the controls must not follow it.
  const press = (e: React.SyntheticEvent, next: number) => {
    e.preventDefault();
    e.stopPropagation();
    show(next);
  };

  return (
    <div
      ref={root}
      className="card-slider"
      onMouseEnter={() => { paused.current = true; }}
      onMouseLeave={() => { paused.current = false; }}
      onFocus={() => { paused.current = true; }}
      onBlur={() => { paused.current = false; }}
    >
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
