import { existsSync } from 'node:fs';
import path from 'node:path';

type Tone = 'stone' | 'sage' | 'navy' | 'adobe' | 'sand' | 'olive';

interface PhotoProps {
  /** Path under public/, for example "photos/austin-home/1.jpg". */
  src?: string;
  alt: string;
  tone: Tone;
  className?: string;
  priority?: boolean;
  label?: string;
}

/**
 * A photo, or a solid placeholder with a mission-arch outline while the
 * photo hasn't been added yet. The check runs at build time, so dropping a
 * file into public/photos is all it takes to show it.
 */
export function Photo({ src, alt, tone, className = '', priority, label = 'Photo coming soon' }: PhotoProps) {
  const exists = src ? existsSync(path.join(process.cwd(), 'public', src)) : false;
  if (src && exists) {
    return (
      <img
        src={`/${src}`}
        alt={alt}
        className={`photo ${className}`}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        decoding="async"
      />
    );
  }
  return (
    <div className={`photo placeholder tone-${tone} ${className}`} role="img" aria-label={`${alt} (${label.toLowerCase()})`}>
      <svg viewBox="0 0 120 80" aria-hidden="true" preserveAspectRatio="xMidYMid meet">
        <path d="M30 72V40a30 30 0 0 1 60 0v32" />
        <path d="M42 72V44a18 18 0 0 1 36 0v28" />
        <path d="M18 72h84" />
      </svg>
      <span>{label}</span>
    </div>
  );
}
