'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

interface NavHome {
  slug: string;
  name: string;
  cityName: string;
  bedrooms?: number;
}

interface HeaderProps {
  homes: NavHome[];
  cities: { slug: string; name: string }[];
  phone: string;
  phoneHref: string;
  email: string;
  instagram: string;
}

export function Header({ homes, cities, phone, phoneHref, email, instagram }: HeaderProps) {
  const [open, setOpen] = useState<'homes' | 'cities' | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(null);
        setMenuOpen(false);
      }
    };
    const onClick = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpen(null);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('click', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('click', onClick);
    };
  }, []);

  const close = () => {
    setOpen(null);
    setMenuOpen(false);
  };

  return (
    <>
      <div className="topbar topbar-top">
        <div className="wrap topbar-inner">
          <span className="topbar-phone">
            <a href={phoneHref} className="topbar-call">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z" />
              </svg>
              {phone}
            </a>
            <a href={phoneHref.replace(/^tel:/, 'sms:')} className="topbar-icon" aria-label={`Text ${phone}`} title="Send a text">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 4h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H8l-4 4V5a1 1 0 0 1 1-1z" />
              </svg>
            </a>
          </span>
          <a href={`mailto:${email}`}>{email}</a>
          {instagram ? (
            <a href={instagram} target="_blank" rel="noopener noreferrer" className="topbar-icon" aria-label="Instagram" title="Instagram">
              <svg viewBox="0 0 24 24" aria-hidden="true" className="ig-glyph">
                <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="17.2" cy="6.8" r="0.6" />
              </svg>
            </a>
          ) : null}
        </div>
      </div>
      <header className={`site-header${scrolled ? ' scrolled' : ''}`}>
        <nav className="wrap nav" ref={navRef} aria-label="Main">
          <Link href="/" className="brand" onClick={close}>
            <span className="brand-mark" aria-hidden="true">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/house.png" alt="" width={80} height={36} />
            </span>
            <span className="brand-text">
              <span className="brand-name">
                Home <em>Over</em> Hotels
              </span>
              <span className="brand-sub">Short-term · Mid-term · Insurance placement</span>
            </span>
          </Link>

          <button
            type="button"
            className="menu-toggle"
            aria-expanded={menuOpen}
            aria-controls="nav-links"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span className="sr-only">Menu</span>
            <span aria-hidden="true" className="bars" />
          </button>

          <ul id="nav-links" className={`nav-links${menuOpen ? ' open' : ''}`}>
            <li className="has-menu" onMouseEnter={() => setOpen('homes')} onMouseLeave={() => setOpen(null)}>
              <button
                type="button"
                aria-expanded={open === 'homes'}
                aria-controls="menu-homes"
                onClick={() => setOpen(open === 'homes' ? null : 'homes')}
              >
                Homes
                <span className="caret" aria-hidden="true" />
              </button>
              <div id="menu-homes" className={`dropdown${open === 'homes' ? ' show' : ''}`}>
                {cities.map((c) => {
                  const here = homes.filter((h) => h.cityName === c.name);
                  const sizes = [
                    { label: '3 Bedrooms', value: '3', count: here.filter((h) => h.bedrooms === 3).length },
                    { label: '4 Bedrooms', value: '4', count: here.filter((h) => h.bedrooms === 4).length },
                    { label: '5+ Bedrooms', value: '5', count: here.filter((h) => (h.bedrooms ?? 0) >= 5).length },
                  ].filter((x) => x.count > 0);
                  return (
                    <div key={c.slug} className="dropdown-group">
                      <p>{c.name}</p>
                      {sizes.map((x) => (
                        <Link key={x.value} href={`/homes/?city=${c.slug}&bedrooms=${x.value}`} onClick={close}>
                          {x.label}
                        </Link>
                      ))}
                      <Link href={`/homes/?city=${c.slug}`} onClick={close}>
                        All {c.name} homes
                      </Link>
                    </div>
                  );
                })}
                <Link href="/homes/" className="dropdown-all" onClick={close}>
                  All homes
                </Link>
              </div>
            </li>
            <li className="has-menu" onMouseEnter={() => setOpen('cities')} onMouseLeave={() => setOpen(null)}>
              <button
                type="button"
                aria-expanded={open === 'cities'}
                aria-controls="menu-cities"
                onClick={() => setOpen(open === 'cities' ? null : 'cities')}
              >
                Cities
                <span className="caret" aria-hidden="true" />
              </button>
              <div id="menu-cities" className={`dropdown narrow${open === 'cities' ? ' show' : ''}`}>
                {cities.map((c) => (
                  <Link key={c.slug} href={`/cities/${c.slug}/`} onClick={close}>
                    {c.name}
                  </Link>
                ))}
              </div>
            </li>
            <li>
              <Link href="/about/" onClick={close}>
                About
              </Link>
            </li>
            <li>
              <Link href="/policies/" onClick={close}>
                Policies
              </Link>
            </li>
            <li>
              <Link href="/contact/" onClick={close}>
                Contact
              </Link>
            </li>
            <li>
              <Link href="/account/" onClick={close}>
                My trips
              </Link>
            </li>
            <li className="nav-cta">
              <Link href="/homes/" className="btn btn-solid" onClick={close}>
                Book your stay
              </Link>
            </li>
          </ul>
        </nav>
      </header>
      <div className="topbar topbar-below">
        <div className="wrap topbar-inner">
          <span className="topbar-phone">
            <a href={phoneHref} className="topbar-call">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z" />
              </svg>
              {phone}
            </a>
            <a href={phoneHref.replace(/^tel:/, 'sms:')} className="topbar-icon" aria-label={`Text ${phone}`} title="Send a text">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 4h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H8l-4 4V5a1 1 0 0 1 1-1z" />
              </svg>
            </a>
          </span>
          <a href={`mailto:${email}`}>{email}</a>
          {instagram ? (
            <a href={instagram} target="_blank" rel="noopener noreferrer" className="topbar-icon" aria-label="Instagram" title="Instagram">
              <svg viewBox="0 0 24 24" aria-hidden="true" className="ig-glyph">
                <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="17.2" cy="6.8" r="0.6" />
              </svg>
            </a>
          ) : null}
        </div>
      </div>
    </>
  );
}
