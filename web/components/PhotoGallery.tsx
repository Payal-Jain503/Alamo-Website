'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const SLOTS = 5;

/**
 * A home's photo grid. Clicking a photo opens it large, with previous and
 * next arrows (also the arrow keys and swiping), and Esc or the close button
 * to leave.
 */
export function PhotoGallery({ name, slug, photos }: { name: string; slug: string; photos: string[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const touchX = useRef<number | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const total = photos.length;
  const src = (file: string) => `/photos/${slug}/${file}`;

  const show = useCallback((i: number) => setOpen((i + total) % total), [total]);
  const close = useCallback(() => {
    setOpen(null);
    opener.current?.focus();
  }, []);

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') show(open + 1);
      else if (e.key === 'ArrowLeft') show(open - 1);
    };
    window.addEventListener('keydown', onKey);
    const before = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = before;
    };
  }, [open, close, show]);

  const launch = (i: number) => (e: React.MouseEvent<HTMLElement>) => {
    opener.current = e.currentTarget;
    setOpen(i);
  };

  return (
    <>
      <section className="wrap gallery" aria-label="Photos">
        {photos.slice(0, SLOTS).map((file, i) => (
          <div key={file} className={`gallery-item g${i}`}>
            <button type="button" className="gallery-open" onClick={launch(i)} aria-label={`Open photo ${i + 1} of ${total}`}>
              <img
                src={src(file)}
                alt={`${name}, photo ${i + 1}`}
                className="photo"
                loading={i === 0 ? 'eager' : 'lazy'}
                fetchPriority={i === 0 ? 'high' : 'auto'}
                decoding="async"
              />
            </button>
          </div>
        ))}
        <button type="button" className="gallery-all-btn" onClick={launch(0)}>
          See all {total} photos
        </button>
      </section>

      {open !== null ? (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label={`${name} photos`} onClick={close}>
          <button ref={closeRef} type="button" className="lb-close" onClick={close} aria-label="Close photos">
            ×
          </button>
          <button
            type="button"
            className="lb-arrow lb-prev"
            onClick={(e) => (e.stopPropagation(), show(open - 1))}
            aria-label="Previous photo"
          >
            ‹
          </button>
          <img
            key={photos[open]}
            className="lb-img"
            src={src(photos[open]!)}
            alt={`${name}, photo ${open + 1} of ${total}`}
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => (touchX.current = e.touches[0]!.clientX)}
            onTouchEnd={(e) => {
              if (touchX.current === null) return;
              const dx = e.changedTouches[0]!.clientX - touchX.current;
              touchX.current = null;
              if (Math.abs(dx) > 50) show(open + (dx < 0 ? 1 : -1));
            }}
          />
          <button
            type="button"
            className="lb-arrow lb-next"
            onClick={(e) => (e.stopPropagation(), show(open + 1))}
            aria-label="Next photo"
          >
            ›
          </button>
          <p className="lb-count">
            {open + 1} / {total}
          </p>
        </div>
      ) : null}
    </>
  );
}
