'use client';

import { useEffect, useState, type FormEvent } from 'react';

interface EnquiryFormProps {
  email: string;
  phone: string;
  homes: { slug: string; name: string }[];
}

/**
 * Booking enquiry. Until online booking is switched on, this opens the
 * guest's email app with the details filled in. The booking API replaces it.
 */
export function EnquiryForm({ email, phone, homes }: EnquiryFormProps) {
  const [values, setValues] = useState({ name: '', email: '', phone: '', home: '', checkIn: '', checkOut: '', guests: '', message: '' });
  const [error, setError] = useState('');
  const [opened, setOpened] = useState(false);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setValues((v) => ({
      ...v,
      home: q.get('home') ?? v.home,
      checkIn: q.get('in') ?? v.checkIn,
      checkOut: q.get('out') ?? v.checkOut,
      guests: q.get('guests') ?? v.guests,
    }));
  }, []);

  const set = (key: keyof typeof values) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [key]: e.target.value }));

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (values.checkIn && values.checkOut && values.checkOut <= values.checkIn) {
      setError('Check-out needs to be after check-in.');
      return;
    }
    setError('');
    const homeName = homes.find((h) => h.slug === values.home)?.name ?? 'Any home';
    const lines = [
      `Name: ${values.name}`,
      `Email: ${values.email}`,
      values.phone && `Phone: ${values.phone}`,
      `Home: ${homeName}`,
      values.checkIn && `Check-in: ${values.checkIn}`,
      values.checkOut && `Check-out: ${values.checkOut}`,
      values.guests && `Guests: ${values.guests}`,
      '',
      values.message,
    ].filter((l): l is string => typeof l === 'string');
    const subject = `Booking enquiry: ${homeName}${values.checkIn ? `, ${values.checkIn}` : ''}`;
    window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\n'))}`;
    setOpened(true);
  };

  return (
    <form className="enquiry" onSubmit={onSubmit} noValidate={false}>
      <div className="field-row">
        <label>
          <span>Your name</span>
          <input id="enq-name" required autoComplete="name" value={values.name} onChange={set('name')} />
        </label>
        <label>
          <span>Email</span>
          <input id="enq-email" type="email" required autoComplete="email" value={values.email} onChange={set('email')} />
        </label>
      </div>
      <div className="field-row">
        <label>
          <span>Phone (optional)</span>
          <input id="enq-phone" type="tel" autoComplete="tel" value={values.phone} onChange={set('phone')} />
        </label>
        <label>
          <span>Home</span>
          <select id="enq-home" value={values.home} onChange={set('home')}>
            <option value="">Any home</option>
            {homes.map((h) => (
              <option key={h.slug} value={h.slug}>
                {h.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="field-row three">
        <label>
          <span>Check-in</span>
          <input id="enq-in" type="date" value={values.checkIn} onChange={set('checkIn')} />
        </label>
        <label>
          <span>Check-out</span>
          <input id="enq-out" type="date" value={values.checkOut} min={values.checkIn || undefined} onChange={set('checkOut')} />
        </label>
        <label>
          <span>Guests</span>
          <input id="enq-guests" type="number" min={1} max={30} inputMode="numeric" value={values.guests} onChange={set('guests')} />
        </label>
      </div>
      <label>
        <span>Anything we should know?</span>
        <textarea id="enq-message" rows={4} value={values.message} onChange={set('message')} placeholder="Occasion, pets, early check-in…" />
      </label>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <div className="form-actions">
        <button type="submit" className="btn btn-solid">
          Send enquiry
        </button>
        <p className="muted small">
          This opens your email app with the details filled in. Prefer to talk? Call <a href={`tel:${phone.replace(/[^\d+]/g, '')}`}>{phone}</a>.
        </p>
      </div>
      {opened ? (
        <p className="form-note" role="status">
          If your email app didn&apos;t open, write to <strong>{email}</strong> and we&apos;ll get back to you.
        </p>
      ) : null}
    </form>
  );
}
