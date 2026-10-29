import ical from 'node-ical';
import { addDays, dateInTimeZone, localCalendarDate } from './dates.js';
import type { Block, BlockKind, Source } from './types.js';

export class FeedFormatError extends Error {}

export interface ParsedFeed {
  blocks: Block[];
  warnings: string[];
}

type FeedDate = Date & { dateOnly?: boolean };

const RESERVATION = /\b(reserved|reservation|booked|booking)\b/i;

function toCalendarDate(value: FeedDate, timeZone: string): string {
  return value.dateOnly ? localCalendarDate(value) : dateInTimeZone(value, timeZone);
}

function textOf(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'val' in value) return String((value as { val: unknown }).val);
  return '';
}

export function classify(summary: string, description: string): BlockKind {
  return RESERVATION.test(summary) || /reservation url/i.test(description) ? 'reservation' : 'blocked';
}

/** Reads an Airbnb, VRBO or other iCal export into calendar blocks. */
export function parseFeed(text: string, source: Source, timeZone: string): ParsedFeed {
  if (!/BEGIN:VCALENDAR/.test(text) || !/END:VCALENDAR/.test(text)) {
    throw new FeedFormatError('The response is not a complete iCal calendar');
  }

  const blocks: Block[] = [];
  const warnings: string[] = [];

  for (const component of Object.values(ical.sync.parseICS(text))) {
    if (!component || component.type !== 'VEVENT') continue;
    const event = component;
    const summary = textOf(event.summary).trim();
    const description = textOf(event.description);

    if (event.status === 'CANCELLED') continue;
    if (!event.start) {
      warnings.push(`Skipped event ${event.uid}: it has no start date`);
      continue;
    }
    if (event.rrule) {
      warnings.push(`Event ${event.uid} repeats; only its first occurrence was used`);
    }

    const start = toCalendarDate(event.start as FeedDate, timeZone);
    let end = event.end ? toCalendarDate(event.end as FeedDate, timeZone) : addDays(start, 1);
    if (end <= start) {
      warnings.push(`Event ${event.uid} ends on or before its start; treated as one night`);
      end = addDays(start, 1);
    }

    blocks.push({
      source,
      kind: classify(summary, description),
      uid: event.uid,
      start,
      end,
      summary: summary || 'Not available',
    });
  }

  blocks.sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));
  return { blocks, warnings };
}
