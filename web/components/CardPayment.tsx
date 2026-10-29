'use client';

import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { useEffect, useState, type FormEvent } from 'react';
import { STRIPE_PUBLISHABLE_KEY, usd } from '@/lib/bookingApi';

let stripePromise: Promise<Stripe | null> | undefined;
// A blocked script (some ad blockers do this) resolves to null instead of breaking the page.
const stripe = () => (stripePromise ??= loadStripe(STRIPE_PUBLISHABLE_KEY).catch(() => null));

// Matches the site's colours and fonts inside Stripe's card form.
const appearance = {
  theme: 'flat' as const,
  variables: {
    colorPrimary: '#a67b3d',
    colorText: '#142033',
    colorBackground: '#f6f4ef',
    colorDanger: '#9b2c1f',
    fontFamily: 'Jost, "Avenir Next", "Segoe UI", system-ui, sans-serif',
    borderRadius: '2px',
  },
};

function minutesLeft(expiresAt: string) {
  return Math.max(0, Math.ceil((Date.parse(expiresAt) - Date.now()) / 60_000));
}

function PayForm({ total, expiresAt, onPaid, onCancel }: { total: number; expiresAt: string; onPaid: () => void; onCancel: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [left, setLeft] = useState(minutesLeft(expiresAt));

  useEffect(() => {
    const t = setInterval(() => setLeft(minutesLeft(expiresAt)), 15_000);
    return () => clearInterval(t);
  }, [expiresAt]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true);
    setError('');
    // The card is authorised here, not charged. It is charged once the dates are confirmed.
    const result = await stripe.confirmPayment({ elements, redirect: 'if_required', confirmParams: { return_url: window.location.href } });
    if (result.error) {
      setError(result.error.message ?? 'Your card was not accepted. Nothing was charged.');
      setBusy(false);
      return;
    }
    onPaid();
  };

  return (
    <form onSubmit={onSubmit} className="pay-form">
      <p className="form-note">
        Your dates are held for {left} more minute{left === 1 ? '' : 's'}. Your card is only charged once we&rsquo;ve confirmed the dates.
      </p>
      <PaymentElement options={{ layout: 'tabs' }} />
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <button type="submit" className="btn btn-solid wide" disabled={!stripe || busy || left === 0}>
        {busy ? 'Checking…' : `Pay ${usd(total)}`}
      </button>
      <button type="button" className="text-link" onClick={onCancel} disabled={busy}>
        Change dates
      </button>
    </form>
  );
}

/** Stripe's card form for a held stay. Card details go straight to Stripe and never touch our server. */
export function CardPayment(props: { clientSecret: string; total: number; expiresAt: string; onPaid: () => void; onCancel: () => void }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    stripe().then((s) => setFailed(!s));
  }, []);
  if (failed) {
    return (
      <div className="pay-form">
        <p className="form-error" role="alert">
          The secure card form couldn&rsquo;t load. If you use an ad blocker, please pause it for this site and reload. Nothing has been charged.
        </p>
        <button type="button" className="text-link" onClick={props.onCancel}>
          Change dates
        </button>
      </div>
    );
  }
  return (
    <Elements stripe={stripe()} options={{ clientSecret: props.clientSecret, appearance }}>
      <PayForm {...props} />
    </Elements>
  );
}
