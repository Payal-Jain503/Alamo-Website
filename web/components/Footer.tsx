import Link from 'next/link';
import { cities, site } from '@/content/site';

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer">
      <div className="wrap footer-grid">
        <div>
          <p className="footer-brand">
            Alamo City <em>Rental</em>
          </p>
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
          <Link href="/about/">About us</Link>
          <Link href="/contact/">Contact</Link>
        </div>
        <div>
          <p className="footer-head">Get in touch</p>
          <a href={site.phoneHref}>{site.phone}</a>
          <a href={`mailto:${site.email}`}>{site.email}</a>
          {site.instagram ? (
            <a href={site.instagram} target="_blank" rel="noopener noreferrer">
              Instagram
            </a>
          ) : null}
        </div>
      </div>
      <div className="wrap footer-base">
        <span>© {year} Alamo City Rental</span>
        <span>San Antonio, Texas</span>
      </div>
    </footer>
  );
}
