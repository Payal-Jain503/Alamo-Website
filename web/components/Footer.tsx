import Link from 'next/link';
import { cities, site } from '@/content/site';

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer">
      <div className="wrap footer-grid">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="footer-logo" src="/logo.png" alt="Home Over Hotels: short and mid term rentals and insurance placement" width={300} height={200} />
          <p className="muted">Curated holiday homes in San Antonio, Austin and Houston.</p>
        </div>
        <div>
          <p className="footer-head">Cities</p>
          {cities.map((c) => (
            <Link key={c.slug} href={`/cities/${c.slug}/`}>
              {c.name}
            </Link>
          ))}
        </div>
        <div>
          <p className="footer-head">Stay with us</p>
          <Link href="/homes/">All homes</Link>
          <Link href="/policies/">Policies</Link>
          <Link href="/terms/">Terms</Link>
          <Link href="/privacy/">Privacy</Link>
          <Link href="/about/">About us</Link>
          <Link href="/contact/">Contact</Link>
        </div>
        <div>
          <p className="footer-head">Get in touch</p>
          <a href={site.phoneHref}>{site.phone}</a>
          <a href={`mailto:${site.email}`}>{site.email}</a>
          {site.instagram ? (
            <a href={site.instagram} target="_blank" rel="noopener noreferrer" className="footer-icon" aria-label="Instagram" title="Instagram">
              <svg viewBox="0 0 24 24" aria-hidden="true" className="ig-glyph">
                <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="17.2" cy="6.8" r="0.6" />
              </svg>
            </a>
          ) : null}
        </div>
      </div>
      <div className="wrap footer-base">
        <span>© {year} Home Over Hotels</span>
        <span>San Antonio, Texas</span>
      </div>
    </footer>
  );
}
