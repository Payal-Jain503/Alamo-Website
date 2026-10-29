import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Policies',
  description: 'Booking, cancellation and house policies for Alamo City Rental homes.',
};

// The client confirms the final wording, refund windows and times. Until then
// this page says which details are still to be confirmed rather than guessing.
const sections = [
  {
    title: 'Booking and payment',
    items: [
      'Bookings are confirmed once payment is received.',
      'Prices include nightly rates, a cleaning fee and Texas hotel occupancy taxes, shown separately before you pay.',
      'Deposit and payment schedule: to be confirmed.',
    ],
  },
  {
    title: 'Cancellations and refunds',
    items: ['Refund windows: to be confirmed.', 'Refunds go back to the original payment method.'],
  },
  {
    title: 'Check-in and check-out',
    items: ['Check-in and check-out times: to be confirmed.', 'Self check-in details are sent before arrival.'],
  },
  {
    title: 'House rules',
    items: [
      'No parties or events without written approval.',
      'Respect quiet hours and our neighbours.',
      'Pets, smoking and the maximum number of guests: listed on each home once confirmed.',
    ],
  },
];

export default function PoliciesPage() {
  return (
    <>
      <section className="page-head">
        <div className="wrap">
          <p className="eyebrow">Rules and policies</p>
          <h1>Good to know before you book</h1>
          <p className="lede">Final policy details are being confirmed and will be published here before online booking opens.</p>
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
            Questions about a policy? <Link href="/contact/">Contact us</Link>.
          </p>
        </div>
      </section>
    </>
  );
}
