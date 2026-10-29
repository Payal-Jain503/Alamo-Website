import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'About us',
  description: 'Alamo City Rental is a San Antonio family business with holiday homes across Texas.',
};

export default function AboutPage() {
  return (
    <>
      <section className="page-head">
        <div className="wrap">
          <p className="eyebrow">About us</p>
          <h1>A San Antonio family business</h1>
        </div>
      </section>
      <section className="section tight">
        <div className="wrap narrow prose">
          <p className="lede-dark">
            Alamo City Rental looks after holiday homes in San Antonio, Austin and Houston, chosen for families and groups who
            want space, comfort and a local host.
          </p>
          <p>
            We started in San Antonio and still run everything from here: guest questions, cleaning, maintenance and the
            small touches that make a stay easy.
          </p>
          <p>
            Our team page and story are coming soon. In the meantime, <Link href="/contact/">get in touch</Link> with any
            question about a home or your trip.
          </p>
        </div>
      </section>
    </>
  );
}
