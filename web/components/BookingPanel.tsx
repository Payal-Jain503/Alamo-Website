'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { StayCalendar } from '@/components/StayCalendar';
import {
  STRIPE_PUBLISHABLE_KEY,
  addDays,
  getAvailability,
  getHold,
  getQuote,
  problemMessage,
  shortDate,
  reserve,
  todayInTexas,
  usd,
  type Guest,
  type SignedQuote,
} from '@/lib/bookingApi';

// Stripe's script only loads once a guest reaches the payment step.
const CardPayment = dynamic(() => import('@/components/CardPayment').then((m) => m.CardPayment), { ssr: false });

/** How far ahead the calendar goes. The server enforces each home's own booking window. */
const CALENDAR_DAYS = 540;
const POLL_MS = 2_000;
const POLL_LIMIT = 45;

type Step =
  | { name: 'dates' }
  | { name: 'guest' }
  | { name: 'pay'; holdId: string; clientSecret: string; expiresAt: string }
  | { name: 'confirming'; holdId: string }
  | { name: 'booked'; bookingId: string }
  | { name: 'released'; message: string }
  | { name: 'slow' };

/**
 * The booking box on each home's page. When the booking API answers for this
 * home, guests pick dates on a live calendar, see the full price and pay by
 * card. Otherwise, before launch or for homes not yet online, it sends them
 * to the enquiry form with their dates.
 */
export function BookingPanel({ slug, homeName, phone }: { slug: string; homeName: string; phone: string }) {
  const [blocked, setBlocked] = useState<Set<string> | null | undefined>(undefined);

  useEffect(() => {
    if (!STRIPE_PUBLISHABLE_KEY) return setBlocked(null);
    getAvailability(slug).then(setBlocked, () => setBlocked(null));
  }, [slug]);

  return (
    <aside className="booking-panel" aria-label={`Book ${homeName}`}>
      <p className="panel-title">Plan your stay</p>
      {blocked === undefined ? (
        <p className="muted small">Loading the calendar…</p>
      ) : blocked === null ? (
        <EnquiryPanel slug={slug} />
      ) : (
        <LiveBooking slug={slug} blocked={blocked} reload={() => getAvailability(slug).then(setBlocked, () => {})} />
      )}
      <p className="panel-phone">
        Or call <a href={`tel:${phone.replace(/[^\d+]/g, '')}`}>{phone}</a>
      </p>
    </aside>
  );
}

function LiveBooking({ slug, blocked, reload }: { slug: string; blocked: Set<string>; reload: () => void }) {
  const today = todayInTexas();
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guests, setGuests] = useState('2');
  const [signed, setSigned] = useState<SignedQuote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<Step>({ name: 'dates' });
  const [guest, setGuest] = useState<Guest>({ name: '', email: '', phone: '' });
  const [busy, setBusy] = useState(false);
  // A hold this guest already placed. Going back and choosing the same stay reuses it instead of clashing with it.
  const [lastHold, setLastHold] = useState<{ key: string; step: Extract<Step, { name: 'pay' }> } | null>(null);
  const stayKey = `${checkIn}|${checkOut}|${guests}`;

  const fetchQuote = useCallback(async () => {
    setSigned(null);
    setError('');
    const n = Number(guests);
    if (!checkIn || !checkOut || !Number.isInteger(n) || n < 1) return;
    setQuoting(true);
    try {
      const { body } = await getQuote({ homeId: slug, checkIn, checkOut, guests: n });
      if (body.signed) setSigned(body.signed);
      else setError(body.error === 'unavailable' ? problemMessage('unavailable') : (body.message ?? problemMessage(body.error ?? '')));
    } catch {
      setError(problemMessage(''));
    } finally {
      setQuoting(false);
    }
  }, [slug, checkIn, checkOut, guests]);

  useEffect(() => {
    const t = setTimeout(fetchQuote, 250);
    return () => clearTimeout(t);
  }, [fetchQuote]);

  // After the card step, wait for the final calendar check and the charge.
  useEffect(() => {
    if (step.name !== 'confirming') return;
    let tries = 0;
    let stop = false;
    const tick = async () => {
      if (stop) return;
      tries++;
      const hold = await getHold(step.holdId).catch(() => undefined);
      if (hold?.status === 'confirmed' && hold.bookingId) return setStep({ name: 'booked', bookingId: hold.bookingId });
      if (hold?.status === 'released') return setStep({ name: 'released', message: problemMessage(hold.reason ?? '') });
      if (tries >= POLL_LIMIT) {
        return setStep({ name: 'slow' });
      }
      setTimeout(tick, POLL_MS);
    };
    tick();
    return () => {
      stop = true;
    };
  }, [step]);

  const onReserve = async (e: FormEvent) => {
    e.preventDefault();
    if (!signed) return;
    if (lastHold?.key === stayKey && Date.parse(lastHold.step.expiresAt) > Date.now() + 60_000) return setStep(lastHold.step);
    setBusy(true);
    setError('');
    try {
      const r = await reserve(signed, { name: guest.name.trim(), email: guest.email.trim(), phone: guest.phone?.trim() || undefined });
      if (r.ok) {
        const pay = { name: 'pay', holdId: r.holdId, clientSecret: r.clientSecret, expiresAt: r.expiresAt } as const;
        setLastHold({ key: stayKey, step: pay });
        return setStep(pay);
      }
      setError(problemMessage(r.problem, r.message));
      if (r.problem === 'dates-taken' || r.problem === 'unavailable') {
        reload();
        setStep({ name: 'dates' });
      }
      if (r.problem === 'price-changed' || r.problem === 'quote-expired') {
        await fetchQuote();
        setStep({ name: 'dates' });
      }
    } catch {
      setError(problemMessage(''));
    } finally {
      setBusy(false);
    }
  };

  if (step.name === 'booked') {
    return (
      <div className="booking-result" role="status">
        <p className="result-title">You&rsquo;re booked</p>
        <p>
          Confirmation <strong>{step.bookingId}</strong>, {shortDate(checkIn)} to {shortDate(checkOut)}. Your receipt goes to {guest.email}.
        </p>
      </div>
    );
  }
  if (step.name === 'released') {
    return (
      <div className="booking-result" role="alert">
        <p className="result-title">Not booked</p>
        <p>
          {step.message} Your card was not charged.
        </p>
        <button type="button" className="btn btn-ghost wide" onClick={() => (reload(), setStep({ name: 'dates' }))}>
          Choose dates again
        </button>
      </div>
    );
  }
  if (step.name === 'slow') {
    return (
      <p className="form-note" role="status">
        We&rsquo;re still confirming your booking. Please don&rsquo;t pay again. Call us and we&rsquo;ll check it for you.
      </p>
    );
  }
  if (step.name === 'confirming') {
    return (
      <p className="form-note" role="status">
        Confirming your dates with our calendars. This takes a few seconds; please keep this page open.
      </p>
    );
  }
  if (step.name === 'pay' && signed) {
    return (
      <CardPayment
        clientSecret={step.clientSecret}
        total={signed.quote.total}
        expiresAt={step.expiresAt}
        onPaid={() => setStep({ name: 'confirming', holdId: step.holdId })}
        onCancel={() => setStep({ name: 'dates' })}
      />
    );
  }

  const q = signed?.quote;
  return (
    <div className="live-booking">
      <StayCalendar
        blocked={blocked}
        today={today}
        lastDay={addDays(today, CALENDAR_DAYS)}
        checkIn={checkIn}
        checkOut={checkOut}
        onChange={(a, b) => {
          setCheckIn(a);
          setCheckOut(b);
          setStep({ name: 'dates' });
        }}
      />
      <label>
        <span>Guests</span>
        <input type="number" min={1} max={30} inputMode="numeric" value={guests} onChange={(e) => setGuests(e.target.value)} />
      </label>

      {quoting ? <p className="muted small">Checking the price…</p> : null}
      {q ? (
        <dl className="price-lines">
          <div>
            <dt>
              {q.nights.length} night{q.nights.length === 1 ? '' : 's'}
            </dt>
            <dd>{usd(q.nightsTotal)}</dd>
          </div>
          {[...q.fees, ...q.taxes].map((c) => (
            <div key={c.label}>
              <dt>{c.label}</dt>
              <dd>{usd(c.amount)}</dd>
            </div>
          ))}
          <div className="price-total">
            <dt>Total</dt>
            <dd>{usd(q.total)}</dd>
          </div>
        </dl>
      ) : null}
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      {step.name === 'dates' ? (
        <button type="button" className="btn btn-solid wide" disabled={!q} onClick={() => setStep({ name: 'guest' })}>
          Reserve
        </button>
      ) : (
        <form onSubmit={onReserve} className="guest-form">
          <label>
            <span>Full name</span>
            <input required autoComplete="name" value={guest.name} onChange={(e) => setGuest({ ...guest, name: e.target.value })} />
          </label>
          <label>
            <span>Email</span>
            <input required type="email" autoComplete="email" value={guest.email} onChange={(e) => setGuest({ ...guest, email: e.target.value })} />
          </label>
          <label>
            <span>Phone (optional)</span>
            <input type="tel" autoComplete="tel" value={guest.phone} onChange={(e) => setGuest({ ...guest, phone: e.target.value })} />
          </label>
          <button type="submit" className="btn btn-solid wide" disabled={busy || !q}>
            {busy ? 'Holding your dates…' : 'Continue to payment'}
          </button>
        </form>
      )}
    </div>
  );
}

/** Before online booking is live for a home: send the dates to the enquiry form. */
function EnquiryPanel({ slug }: { slug: string }) {
  const router = useRouter();
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guests, setGuests] = useState('');
  const [error, setError] = useState('');

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (checkIn && checkOut && checkOut <= checkIn) {
      setError('Check-out needs to be after check-in.');
      return;
    }
    const q = new URLSearchParams({ home: slug });
    if (checkIn) q.set('in', checkIn);
    if (checkOut) q.set('out', checkOut);
    if (guests) q.set('guests', guests);
    router.push(`/contact/?${q}`);
  };

  return (
    <>
      <form onSubmit={onSubmit}>
        <div className="field-row">
          <label>
            <span>Check-in</span>
            <input id="bp-in" type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
          </label>
          <label>
            <span>Check-out</span>
            <input id="bp-out" type="date" value={checkOut} min={checkIn || undefined} onChange={(e) => setCheckOut(e.target.value)} />
          </label>
        </div>
        <label>
          <span>Guests</span>
          <input id="bp-guests" type="number" min={1} max={30} inputMode="numeric" placeholder="2" value={guests} onChange={(e) => setGuests(e.target.value)} />
        </label>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit" className="btn btn-solid wide">
          Request these dates
        </button>
      </form>
      <p className="muted small">Online booking with live prices is coming soon. Until then we confirm every request personally.</p>
    </>
  );
}
