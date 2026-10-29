import type { Metadata } from 'next';
import { EnquiryForm } from '@/components/EnquiryForm';
import { homes } from '@/content/homes';
import { site } from '@/content/site';

export const metadata: Metadata = {
  title: 'Contact and enquiries',
  description: 'Send Alamo City Rental your dates, or call us to plan your stay.',
};

export default function ContactPage() {
  return (
    <>
      <section className="page-head">
        <div className="wrap">
          <p className="eyebrow">Plan your stay</p>
          <h1>Tell us about your trip</h1>
          <p className="lede">Send your dates and group size and we’ll confirm availability and price.</p>
        </div>
      </section>
      <section className="section tight">
        <div className="wrap contact-grid">
          <EnquiryForm email={site.email} phone={site.phone} homes={homes.map((h) => ({ slug: h.slug, name: h.name }))} />
          <aside className="contact-card">
            <p className="panel-title">Talk to us</p>
            <p>
              <span className="muted small">Phone</span>
              <br />
              <a href={site.phoneHref}>{site.phone}</a>
            </p>
            <p>
              <span className="muted small">Email</span>
              <br />
              <a href={`mailto:${site.email}`}>{site.email}</a>
            </p>
            <p className="muted small">Based in San Antonio, Texas.</p>
          </aside>
        </div>
      </section>
    </>
  );
}
