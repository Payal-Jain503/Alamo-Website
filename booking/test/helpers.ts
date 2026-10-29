import type { Block } from '../src/types.js';

export function block(partial: Partial<Block> & Pick<Block, 'start' | 'end'>): Block {
  return { source: 'airbnb', kind: 'reservation', uid: `${partial.start}-${partial.end}`, summary: 'Reserved', ...partial };
}

export function ics(...events: string[]): string {
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Test//EN', ...events, 'END:VCALENDAR', ''].join('\r\n');
}

export function vevent(fields: Record<string, string>): string {
  return ['BEGIN:VEVENT', ...Object.entries(fields).map(([k, v]) => `${k}:${v}`), 'END:VEVENT'].join('\r\n');
}
