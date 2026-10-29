'use client';

import { useMemo, useState } from 'react';
import { addDays, shortDate } from '@/lib/bookingApi';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function monthStart(date: string) {
  return `${date.slice(0, 7)}-01`;
}

function shiftMonth(first: string, by: number) {
  const d = new Date(`${first}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + by);
  return d.toISOString().slice(0, 10);
}

function monthLabel(first: string) {
  return new Date(`${first}T00:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/**
 * A month calendar for picking a stay. Booked nights are crossed out. A booked
 * night can still be a check-out day, because the guest leaves that morning.
 */
export function StayCalendar({
  blocked,
  today,
  lastDay,
  checkIn,
  checkOut,
  onChange,
}: {
  blocked: Set<string>;
  today: string;
  lastDay: string;
  checkIn: string;
  checkOut: string;
  onChange: (checkIn: string, checkOut: string) => void;
}) {
  const [month, setMonth] = useState(monthStart(checkIn || today));

  const days = useMemo(() => {
    const lead = new Date(`${month}T00:00:00Z`).getUTCDay();
    const next = shiftMonth(month, 1);
    const list: (string | null)[] = Array.from({ length: lead }, () => null);
    for (let d = month; d < next; d = addDays(d, 1)) list.push(d);
    return list;
  }, [month]);

  const freeBetween = (from: string, to: string) => {
    for (let d = from; d < to; d = addDays(d, 1)) if (blocked.has(d)) return false;
    return true;
  };

  const pick = (day: string) => {
    if (checkIn && !checkOut && day > checkIn && freeBetween(checkIn, day)) return onChange(checkIn, day);
    if (!blocked.has(day)) return onChange(day, '');
  };

  const canPick = (day: string) => {
    if (day < today || day > lastDay) return false;
    if (checkIn && !checkOut && day > checkIn) return freeBetween(checkIn, day);
    return !blocked.has(day);
  };

  const first = monthStart(today);
  return (
    <div className="stay-calendar">
      <div className="cal-head">
        <button type="button" onClick={() => setMonth(shiftMonth(month, -1))} disabled={month <= first} aria-label="Previous month">
          ‹
        </button>
        <p aria-live="polite">{monthLabel(month)}</p>
        <button type="button" onClick={() => setMonth(shiftMonth(month, 1))} disabled={shiftMonth(month, 1) > lastDay} aria-label="Next month">
          ›
        </button>
      </div>
      <div className="cal-grid">
        {WEEKDAYS.map((w, i) => (
          <span key={i} className="cal-dow" aria-hidden="true">
            {w}
          </span>
        ))}
        {days.map((day, i) => {
          if (!day) return <span key={i} />;
          const selected = day === checkIn || day === checkOut;
          const inRange = checkIn && checkOut && day > checkIn && day < checkOut;
          const enabled = canPick(day);
          const label = new Date(`${day}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
          return (
            <button
              key={day}
              type="button"
              className={['cal-day', blocked.has(day) && 'booked', selected && 'selected', inRange && 'in-range'].filter(Boolean).join(' ')}
              disabled={!enabled}
              aria-pressed={selected}
              aria-label={`${label}${blocked.has(day) ? ', booked' : ''}`}
              onClick={() => pick(day)}
            >
              {Number(day.slice(8))}
            </button>
          );
        })}
      </div>
      <p className="cal-hint muted small">
        {!checkIn ? 'Choose your check-in day.' : !checkOut ? 'Now choose your check-out day.' : `${shortDate(checkIn)} to ${shortDate(checkOut)}`}
        {checkIn ? (
          <button type="button" className="cal-clear" onClick={() => onChange('', '')}>
            Clear
          </button>
        ) : null}
      </p>
    </div>
  );
}
