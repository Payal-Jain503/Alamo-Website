import type { Metadata } from 'next';
import { AccountPanel } from '@/components/AccountPanel';

export const metadata: Metadata = {
  title: 'My trips',
  description: 'Sign in to see your Alamo City Rental bookings.',
};

export default function AccountPage() {
  return (
    <>
      <section className="page-head">
        <div className="wrap">
          <p className="eyebrow">Your account</p>
          <h1>My trips</h1>
          <p className="lede">See your upcoming and past stays. You can always book without an account.</p>
        </div>
      </section>
      <section className="section tight">
        <div className="wrap">
          <AccountPanel />
        </div>
      </section>
    </>
  );
}
