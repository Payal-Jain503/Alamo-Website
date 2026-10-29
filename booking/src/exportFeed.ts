import ical, { ICalCalendarMethod } from 'ical-generator';
import type { Block, Property } from './types.js';

/** Sources we publish to Airbnb and VRBO. Imported dates are left out so calendars never echo. */
const EXPORTED = new Set<Block['source']>(['direct', 'owner']);

/**
 * Builds the calendar file Airbnb and VRBO read from us. It carries no guest
 * names or contact details, only "Reserved" or "Not available".
 */
export function buildExportCalendar(property: Property, blocks: Block[], now = new Date()): string {
  const calendar = ical({
    name: `${property.name} – Alamo City Rental`,
    prodId: { company: 'Alamo City Rental', product: 'Booking Calendar', language: 'EN' },
    method: ICalCalendarMethod.PUBLISH,
  });

  for (const block of blocks) {
    if (!EXPORTED.has(block.source)) continue;
    calendar.createEvent({
      id: `${block.uid}@alamocityrental.com`,
      start: block.start,
      end: block.end,
      allDay: true,
      stamp: now,
      summary: block.kind === 'reservation' ? 'Reserved' : 'Not available',
    });
  }
  return calendar.toString();
}
