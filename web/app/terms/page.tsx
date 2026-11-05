import type { Metadata } from 'next';
import Link from 'next/link';
import { site } from '@/content/site';

export const metadata: Metadata = {
  title: 'Terms and conditions',
  description: 'Booking terms, damage waiver and indemnification for Home Over Hotels homes.',
};

// A plain-language starting point. The client's lawyer should review it before launch.
const sections = [
  {
    title: 'Booking and payment',
    items: [
      'A booking is confirmed once payment is received. Prices are in US dollars and include taxes and fees shown before you pay.',
      'The guest who books must be at least 25 years old and stay in the home for the whole stay.',
    ],
  },
  {
    title: 'Cancellations and refunds',
    items: ['Cancel 5 or more days before check-in for a full refund.', 'Cancel less than 5 days before check-in for a 50% refund.'],
  },
  {
    title: 'Check-in and check-out',
    items: ['Check-in is any time after 3:00 PM and check-out is by 11:00 AM.', 'Late check-out or early check-in must be agreed with us in advance.'],
  },
  {
    title: 'Occupancy, pets and house rules',
    items: [
      'Do not exceed the maximum number of guests listed for the home. Visitors who are not booked are not allowed to stay overnight.',
      'Pets are allowed only in homes that say so, and pet fees apply. Pets are not allowed at Sitio Plains or Grey Woodpecker.',
      'No parties or events, and no smoking inside. Respect quiet hours and the neighbours.',
    ],
  },
  {
    title: 'Damage waiver',
    items: [
      'The guest is responsible for any loss of or damage to the home, its furnishings and contents caused by the guest, their party or their visitors, beyond normal wear and tear.',
      'We may charge the cost of repair or replacement to the card used for the booking, with photos or receipts as proof.',
    ],
  },
  {
    title: 'Indemnification',
    items: [
      'The guest agrees to indemnify, defend and hold harmless Home Over Hotels, its property management team and the property owner from any claim, loss, injury, damage or expense arising from the guest, their party or their visitors, or their use of the property.',
      'The guest stays at their own risk. We are not responsible for injury, illness or loss of personal belongings during the stay.',
    ],
  },
  {
    title: 'Insurance',
    items: [
      'The guest is required to carry adequate insurance for injury to themselves, their party and their visitors while on the property, and for damage they may cause, so that these claims are covered without recourse to us or the owner.',
      'We recommend travel insurance that includes accidental damage and medical cover.',
    ],
  },
  {
    title: 'Events outside our control',
    items: ['We are not liable if a stay is shortened or cancelled by severe weather, a power or utility outage, or other events outside our control. We will work with you to find a fair solution.'],
  },
  {
    title: 'Governing law',
    items: ['These terms are governed by the laws of the State of Texas.'],
  },
];

export default function TermsPage() {
  return (
    <>
      <section className="page-head">
        <div className="wrap">
          <p className="eyebrow">Booking terms</p>
          <h1>Terms and conditions</h1>
          <p className="lede">By booking, you agree to these terms, including the damage waiver and indemnification.</p>
        </div>
      </section>
      <section className="section tight">
        <div className="wrap narrow policy-list">
          {sections.map((s) => (
            <div key={s.title} className="policy">
              <h2 className="h-sub">{s.title}</h2>
              <ul className="ticks">
                {s.items.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            </div>
          ))}
          <p>
            Questions? Email <a href={`mailto:${site.email}`}>{site.email}</a> or visit our <Link href="/contact/">contact page</Link>.
          </p>
        </div>
      </section>
    </>
  );
}
