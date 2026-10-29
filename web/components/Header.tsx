'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

interface NavHome {
  slug: string;
  name: string;
  cityName: string;
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

  const byCity = cities.map((c) => ({ ...c, homes: homes.filter((h) => h.cityName === c.name) }));

  return (
    <>
      <div className="topbar">
        <div className="wrap topbar-inner">
          <a href={phoneHref}>{phone}</a>
          <a href={`mailto:${email}`}>{email}</a>
          {instagram ? (
            <a href={instagram} target="_blank" rel="noopener noreferrer">
              Instagram
            </a>
          ) : null}
        </div>
      </div>
      <header className={`site-header${scrolled ? ' scrolled' : ''}`}>
        <nav className="wrap nav" ref={navRef} aria-label="Main">
          <Link href="/" className="brand" onClick={close}>
            <span className="brand-mark" aria-hidden="true">
              <svg viewBox="0 0 40 40">
                <path d="M8 34V20a12 12 0 0 1 24 0v14" />
                <path d="M14 34V21a6 6 0 0 1 12 0v13" />
                <path d="M4 34h32" />
              </svg>
            </span>
            <span className="brand-name">
              Alamo City <em>Rental</em>
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
                {byCity.map((c) => (
                  <div key={c.slug} className="dropdown-group">
                    <p>{c.name}</p>
                    {c.homes.map((h) => (
                      <Link key={h.slug} href={`/homes/${h.slug}/`} onClick={close}>
                        {h.name}
                      </Link>
                    ))}
                  </div>
                ))}
                <Link href="/homes/" className="dropdown-all" onClick={close}>
                  See all homes
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
            <li className="nav-cta">
              <Link href="/homes/" className="btn btn-solid" onClick={close}>
                Book your stay
              </Link>
            </li>
          </ul>
        </nav>
      </header>
    </>
  );
}
