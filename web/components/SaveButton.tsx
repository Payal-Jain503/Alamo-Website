'use client';

import { useEffect, useState } from 'react';
import { readSaved, toggleSaved } from '@/lib/saved';

/** A heart that saves a home to the guest's list. */
export function SaveButton({ slug, name, className = '' }: { slug: string; name: string; className?: string }) {
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const sync = () => setSaved(readSaved().includes(slug));
    sync();
    window.addEventListener('alamo-saved', sync);
    return () => window.removeEventListener('alamo-saved', sync);
  }, [slug]);

  return (
    <button
      type="button"
      className={`save-button ${saved ? 'is-saved' : ''} ${className}`}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${name} from saved homes` : `Save ${name}`}
      onClick={() => void toggleSaved(slug)}
    >
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <path d="M12 21s-7.5-4.6-9.5-9.1C1.1 8.6 3 5 6.5 5c2 0 3.7 1.1 5.5 3.2C13.8 6.1 15.5 5 17.5 5 21 5 22.9 8.6 21.5 11.9 19.500 16.400 12 21 12 21z" />
      </svg>
    </button>
  );
}
