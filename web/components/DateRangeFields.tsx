'use client';

import { useEffect, useRef, useState } from 'react';
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
  const [up, setUp] = useState(false);
  const cell = useRef<HTMLDivElement>(null);
  const pop = useRef<HTMLDivElement>(null);

  // The calendar is about 380px tall. Open it above the field when there is no room below it.
  const show = () => {
    const box = cell.current?.getBoundingClientRect();
    if (box) setUp(window.innerHeight - box.bottom < 400 && box.top > 400);
    setOpen(true);
  };

  useEffect(() => {
    if (open) pop.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [open]);

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
      <div className={cellClass} data-date-range ref={cell}>
        <span>Check-in</span>
        <button type="button" id={`${idPrefix}-in`} className="date-btn" aria-expanded={open} onClick={show}>
          {checkIn ? shortDate(checkIn) : <em>Add date</em>}
        </button>
        {open ? (
          <div className={`date-pop${up ? ' up' : ''}`} ref={pop} role="dialog" aria-label="Choose your dates">
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
        <button type="button" id={`${idPrefix}-out`} className="date-btn" aria-expanded={open} onClick={show}>
          {checkOut ? shortDate(checkOut) : <em>Add date</em>}
        </button>
      </div>
    </>
  );
}
