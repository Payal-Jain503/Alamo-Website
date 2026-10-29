'use client';

import { useEffect, useState, type ReactNode } from 'react';

export interface Slide {
  eyebrow: string;
  title: string;
  text: string;
  media: ReactNode;
}

/** Full-width hero slideshow with slow cross-fades. Stops autoplay for reduced-motion users. */
export function Slideshow({ slides, children }: { slides: Slide[]; children?: ReactNode }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || paused || slides.length < 2) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % slides.length), 6500);
    return () => window.clearInterval(id);
  }, [paused, slides.length]);

  const go = (i: number) => setIndex((i + slides.length) % slides.length);

  return (
    <section
      className="hero"
      aria-roledescription="carousel"
      aria-label="Welcome"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {slides.map((s, i) => (
        <div
          key={s.title}
          className={`slide${i === index ? ' active' : ''}`}
          role="group"
          aria-roledescription="slide"
          aria-label={`${i + 1} of ${slides.length}`}
          aria-hidden={i !== index}
        >
          <div className="slide-media">{s.media}</div>
          <div className="slide-shade" aria-hidden="true" />
          <div className="wrap slide-copy">
            <p className="eyebrow light">{s.eyebrow}</p>
            <h1>{s.title}</h1>
            <p className="slide-text">{s.text}</p>
          </div>
        </div>
      ))}

      <div className="wrap hero-controls">
        <div className="dots" role="tablist" aria-label="Choose slide">
          {slides.map((s, i) => (
            <button
              key={s.title}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Slide ${i + 1}: ${s.eyebrow}`}
              className={i === index ? 'on' : ''}
              onClick={() => go(i)}
            />
          ))}
        </div>
        <div className="arrows">
          <button type="button" aria-label="Previous slide" onClick={() => go(index - 1)}>
            ‹
          </button>
          <button type="button" aria-label="Next slide" onClick={() => go(index + 1)}>
            ›
          </button>
        </div>
      </div>
      {children}
    </section>
  );
}
