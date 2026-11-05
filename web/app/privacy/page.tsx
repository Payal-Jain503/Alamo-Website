import type { Metadata } from 'next';
import Link from 'next/link';
import { site } from '@/content/site';

export const metadata: Metadata = {
  title: 'Privacy policy',
  description: 'How Home Over Hotels collects, uses and protects your information.',
};

// A plain-language starting point. The client should have it reviewed before launch.
const sections = [
  {
    title: 'What we collect',
    items: [
      'Booking details you give us: name, email, phone number, travel dates and number of guests.',
      'Your email address if you sign in to My trips, and the homes you save.',
      'Reviews you choose to write. Only your first name and last initial are shown with a review.',
      'Messages you send through our contact and enquiry forms.',
    ],
  },
  {
    title: 'Payments',
    items: [
      'Card payments are handled by Stripe. Your card number goes directly to Stripe and is never stored on our website or servers.',
    ],
  },
  {
    title: 'How we use it',
    items: [
      'To confirm and manage your booking, send your confirmation and arrival details, and reply to your questions.',
      'To let you see your trips, saved homes and reviews when you sign in.',
      'We do not sell your information or use it for advertising.',
    ],
  },
  {
    title: 'Who we share it with',
    items: [
      'Only the services that run the site for us: Amazon Web Services (hosting, storage and email) and Stripe (payments).',
      'The home owner or cleaning team may receive your name and stay dates so they can prepare the home.',
      'We may share information if the law requires it.',
    ],
  },
  {
    title: 'Cookies and storage',
    items: [
      'Your browser stores a sign-in token and your saved homes so you stay signed in. We do not use advertising cookies.',
    ],
  },
  {
    title: 'How long we keep it',
    items: ['Booking records are kept for as long as needed for accounting and tax rules, then deleted.'],
  },
  {
    title: 'Your choices',
    items: [
      'You can ask us to see, correct or delete your information at any time by emailing us.',
      'You can sign out at any time, which removes the sign-in from your browser.',
    ],
  },
];

export default function PrivacyPage() {
  return (
    <>
      <section className="page-head">
        <div className="wrap">
          <p className="eyebrow">Your information</p>
          <h1>Privacy policy</h1>
          <p className="lede">We collect only what we need to host your stay, and we never sell it.</p>
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
            Questions or requests? Email <a href={`mailto:${site.email}`}>{site.email}</a> or visit our <Link href="/contact/">contact page</Link>.
          </p>
        </div>
      </section>
    </>
  );
}
