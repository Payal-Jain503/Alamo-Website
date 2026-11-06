'use client';

import { useEffect, useState } from 'react';
import { StayCalendar } from '@/components/StayCalendar';
import { addDays, shortDate, todayInTexas } from '@/lib/bookingApi';

const NO_DATES = new Set<string>();
const CALENDAR_DAYS = 365;

/**
 * The check-in and check-out fields. Either one opens a single calendar:
 * the first click picks check-in, the next later day is check-out, and the calendar closes.
 * Renders two cells for the parent grid; the calendar hangs under the check-in cell.
 */
export function DateRangeFields({
  idPrefix,
  checkIn,
  checkOut,
  onChange,
  cellClass = 'field',
}: {
  idPrefix: string;
  checkIn: string;
  checkOut: string;
  onChange: (checkIn: string, checkOut: string) => void;
  cellClass?: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !(e.target as Element).closest?.('[data-date-range]')) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  const today = todayInTexas();
  return (
    <>
      <div className={cellClass} data-date-range>
        <span>Check-in</span>
        <button type="button" id={`${idPrefix}-in`} className="date-btn" aria-expanded={open} onClick={() => setOpen(true)}>
          {checkIn ? shortDate(checkIn) : <em>Add date</em>}
        </button>
        {open ? (
          <div className="date-pop" role="dialog" aria-label="Choose your dates">
            <StayCalendar
              blocked={NO_DATES}
              today={today}
              lastDay={addDays(today, CALENDAR_DAYS)}
              checkIn={checkIn}
              checkOut={checkOut}
              onChange={(a, b) => {
                onChange(a, b);
                if (a && b) setOpen(false);
              }}
            />
          </div>
        ) : null}
      </div>
      <div className={cellClass} data-date-range>
        <span>Check-out</span>
        <button type="button" id={`${idPrefix}-out`} className="date-btn" aria-expanded={open} onClick={() => setOpen(true)}>
          {checkOut ? shortDate(checkOut) : <em>Add date</em>}
        </button>
      </div>
    </>
  );
}
