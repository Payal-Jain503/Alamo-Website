import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { homes } from '@/content/homes';
import { cities, cityBySlug, site } from '@/content/site';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: 'Alamo City Rental | Holiday homes in San Antonio, Austin and Houston', template: '%s | Alamo City Rental' },
  description:
    'Spacious holiday homes for families and groups in San Antonio, Austin and Houston. Book direct with Alamo City Rental.',
  openGraph: { siteName: 'Alamo City Rental', type: 'website', locale: 'en_US' },
};

export const viewport: Viewport = { themeColor: '#0e1724', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  const navHomes = homes.map((h) => ({ slug: h.slug, name: h.name, cityName: cityBySlug(h.city)?.name ?? '' }));
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Marcellus&family=Jost:wght@300;400;500;600&display=swap"
        />
      </head>
      <body>
        <a className="skip" href="#main">
          Skip to content
        </a>
        <Header
          homes={navHomes}
          cities={cities.map((c) => ({ slug: c.slug, name: c.name }))}
          phone={site.phone}
          phoneHref={site.phoneHref}
          email={site.email}
          instagram={site.instagram}
        />
        <main id="main">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
