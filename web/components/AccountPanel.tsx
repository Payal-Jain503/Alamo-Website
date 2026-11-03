'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { confirmCode, getAccount, signOut, startSignIn, type Account } from '@/lib/auth';
import { usd } from '@/lib/bookingApi';
import { homeBySlug } from '@/content/homes';
import { ReviewForm } from './ReviewForm';
import { mergeSaved } from '@/lib/saved';

type View = { name: 'loading' } | { name: 'signed-out' } | { name: 'code'; email: string; session: string } | { name: 'in'; account: Account } | { name: 'unavailable' };

const shortDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export function AccountPanel() {
  const [view, setView] = useState<View>({ name: 'loading' });
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const account = await getAccount();
      if (account) account.saved = await mergeSaved(account.saved ?? []);
      setView(account ? { name: 'in', account } : { name: 'signed-out' });
    } catch {
      setView({ name: 'unavailable' });
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const session = await startSignIn(email);
      setCode('');
      setView({ name: 'code', email: email.trim().toLowerCase(), session });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (view.name !== 'code') return;
    setBusy(true);
    setError('');
    try {
      await confirmCode(view.email, view.session, code);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  if (view.name === 'loading') return <p className="muted">Loading…</p>;
  if (view.name === 'unavailable')
    return <p className="muted">Guest accounts are not available just yet. You can still book without an account.</p>;

  if (view.name === 'signed-out')
    return (
      <form className="contact-card account-card" onSubmit={send}>
        <p className="panel-title">Sign in</p>
        <p className="muted small">Enter your email and we will send you a 6-digit code. No password needed.</p>
        <label>
          <span>Email</span>
          <input required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button className="btn btn-solid wide" disabled={busy}>
          {busy ? 'Sending…' : 'Email me a code'}
        </button>
      </form>
    );

  if (view.name === 'code')
    return (
      <form className="contact-card account-card" onSubmit={verify}>
        <p className="panel-title">Check your email</p>
        <p className="muted small">We sent a 6-digit code to {view.email}. It can take a minute to arrive.</p>
        <label>
          <span>Code</span>
          <input required inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={code} onChange={(e) => setCode(e.target.value)} />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button className="btn btn-solid wide" disabled={busy}>
          {busy ? 'Checking…' : 'Sign in'}
        </button>
        <button type="button" className="btn btn-ghost wide" onClick={() => { setError(''); setView({ name: 'signed-out' }); }}>
          Use a different email
        </button>
      </form>
    );

  const { account } = view;
  const upcoming = account.trips.filter((t) => t.status === 'upcoming').reverse();
  const past = account.trips.filter((t) => t.status === 'past');
  const list = (title: string, trips: typeof upcoming) =>
    trips.length > 0 && (
      <div className="trip-group">
        <h2>{title}</h2>
        {trips.map((t) => (
          <article key={t.bookingId} className="trip">
            <div>
              <p className="panel-title">{t.homeName}</p>
              <p className="muted small">
                {shortDate(t.checkIn)} to {shortDate(t.checkOut)} · {t.guests} {t.guests === 1 ? 'guest' : 'guests'} · {usd(t.totalCents)}
              </p>
              <p className="muted small">Confirmation {t.bookingId}</p>
              {t.status === 'past' && <ReviewForm trip={t} />}
            </div>
            <Link className="btn btn-ghost" href={`/homes/${t.homeId}/`}>
              View home
            </Link>
          </article>
        ))}
      </div>
    );

  return (
    <div className="account-trips">
      <p className="muted">
        Signed in as <strong>{account.email}</strong>{' '}
        <button className="link-button" onClick={() => { signOut(); setView({ name: 'signed-out' }); }}>
          Sign out
        </button>
      </p>
      {account.saved.length > 0 && (
        <div className="trip-group">
          <h2>Saved homes</h2>
          {account.saved.flatMap((slug) => {
            const h = homeBySlug(slug);
            return h ? [<Link key={slug} className="saved-link" href={`/homes/${slug}/`}>{h.name}</Link>] : [];
          })}
        </div>
      )}
      {account.trips.length === 0 ? (
        <p>No trips yet. Bookings made with this email address will show up here.</p>
      ) : (
        <>
          {list('Upcoming trips', upcoming)}
          {list('Past trips', past)}
        </>
      )}
    </div>
  );
}
