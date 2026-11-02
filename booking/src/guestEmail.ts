import type { Booking } from './checkout.js';
import { formatUsd } from './pricing.js';

/** Sends one plain email to a guest. Production uses Amazon SES. */
export interface GuestMailer {
  send(to: string, subject: string, text: string): Promise<void>;
}

/** The confirmation a guest gets once their stay is booked and paid. */
export function bookingConfirmationEmail(b: Booking, homeName: string, contact: { phone?: string; email?: string } = {}): { subject: string; text: string } {
  const lines = [
    `Hi ${b.guest.name},`,
    '',
    `Your stay is confirmed. Thank you for booking direct with Alamo City Rental.`,
    '',
    `Confirmation: ${b.id}`,
    `Home: ${homeName}`,
    `Check-in: ${b.quote.checkIn}`,
    `Check-out: ${b.quote.checkOut} (${b.quote.nights.length} nights)`,
    `Guests: ${b.quote.guests}`,
    '',
    `Nights: ${formatUsd(b.quote.nightsTotal)}`,
    ...b.quote.fees.map((f) => `${f.label}: ${formatUsd(f.amount)}`),
    ...b.quote.taxes.map((t) => `${t.label}: ${formatUsd(t.amount)}`),
    `Total charged: ${formatUsd(b.quote.total)}`,
    '',
    'Check-in details and house rules will follow before your arrival.',
    contact.phone || contact.email ? `Questions? ${[contact.phone, contact.email].filter(Boolean).join(' or ')}.` : '',
    '',
    'Alamo City Rental',
  ];
  return { subject: `Your booking ${b.id} is confirmed`, text: lines.join('\n') };
}
