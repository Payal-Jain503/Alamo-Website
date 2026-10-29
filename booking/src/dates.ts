const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function assertIsoDate(value: string): void {
  if (!ISO_DATE.test(value)) throw new Error(`Expected a YYYY-MM-DD date, got "${value}"`);
}

/** Adds whole days to a YYYY-MM-DD date. */
export function addDays(date: string, days: number): string {
  assertIsoDate(date);
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Every night from `start` up to, but not including, `end`. */
export function eachNight(start: string, end: string): string[] {
  const nights: string[] = [];
  for (let night = start; night < end; night = addDays(night, 1)) nights.push(night);
  return nights;
}

/** The calendar date of an instant in the given time zone. */
export function dateInTimeZone(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

/**
 * node-ical builds all-day dates at local midnight, so their local
 * year, month and day are the calendar date as written in the feed.
 */
export function localCalendarDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
