import type { Booking } from './checkout.js';
import { formatUsd } from './pricing.js';

/** Sends one email to a guest, with an optional HTML version beside the plain text. Production uses Amazon SES. */
export interface GuestMailer {
  send(to: string, subject: string, text: string, html?: string): Promise<void>;
}

const SITE = 'https://www.homeoverhotels.com';

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function longDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

/** The confirmation a guest gets once their stay is booked and paid. */
export function bookingConfirmationEmail(b: Booking, homeName: string, contact: { phone?: string; email?: string } = {}): { subject: string; text: string; html: string } {
  const lines = [
    `Hi ${b.guest.name},`,
    '',
    `Your stay is confirmed. Thank you for booking direct with Home Over Hotels.`,
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
    '',
    'By booking you agreed to our Terms and Policies:',
    `Terms: ${SITE}/terms`,
    `Policies (cancellation and house rules): ${SITE}/policies`,
    `Privacy: ${SITE}/privacy`,
    '',
    contact.phone || contact.email ? `Questions? ${[contact.phone, contact.email].filter(Boolean).join(' or ')}.` : '',
    '',
    'Home Over Hotels',
  ];
  return { subject: `Your booking ${b.id} is confirmed`, text: lines.join('\n'), html: confirmationHtml(b, homeName, contact) };
}

const INK = '#16202e';
const MUTED = '#6b7280';
const BRASS = '#a67c3d';
const LINE = '#e6e1d7';

function confirmationHtml(b: Booking, homeName: string, contact: { phone?: string; email?: string }): string {
  const row = (label: string, value: string, strong = false) =>
    `<tr><td style="padding:6px 0;color:${strong ? INK : MUTED};${strong ? 'font-weight:700;' : ''}">${escapeHtml(label)}</td><td align="right" style="padding:6px 0;color:${INK};${strong ? 'font-weight:700;' : ''}">${escapeHtml(value)}</td></tr>`;
  const stay = (label: string, value: string) =>
    `<tr><td style="padding:8px 0;color:${MUTED};width:38%;vertical-align:top">${escapeHtml(label)}</td><td style="padding:8px 0;color:${INK}">${value}</td></tr>`;
  const charges = [
    row(`Nights (${b.quote.nights.length})`, formatUsd(b.quote.nightsTotal)),
    ...b.quote.fees.map((f) => row(f.label, formatUsd(f.amount))),
    ...b.quote.taxes.map((t) => row(t.label, formatUsd(t.amount))),
  ].join('');
  const link = (href: string, text: string) => `<a href="${href}" style="color:${BRASS};text-decoration:underline">${text}</a>`;
  const contactLine = [contact.phone, contact.email].filter(Boolean).map((c) => escapeHtml(c!)).join(' or ');
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f4f2ec;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:${INK}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f2ec"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden">
<tr><td style="background:${INK};padding:22px 28px;color:#ffffff;font-size:20px;letter-spacing:0.04em">Home <span style="color:#d8b26a">Over</span> Hotels</td></tr>
<tr><td style="padding:28px 28px 8px">
<p style="margin:0 0 4px;font-size:22px;font-weight:700">Your stay is confirmed</p>
<p style="margin:0;color:${MUTED}">Hi ${escapeHtml(b.guest.name)}, thank you for booking direct with Home Over Hotels.</p>
</td></tr>
<tr><td style="padding:8px 28px 0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${LINE};border-bottom:1px solid ${LINE}">
${stay('Confirmation', `<strong>${escapeHtml(b.id)}</strong>`)}
${stay('Home', escapeHtml(homeName))}
${stay('Check-in', escapeHtml(longDate(b.quote.checkIn)))}
${stay('Check-out', `${escapeHtml(longDate(b.quote.checkOut))} (${b.quote.nights.length} ${b.quote.nights.length === 1 ? 'night' : 'nights'})`)}
${stay('Guests', String(b.quote.guests))}
</table></td></tr>
<tr><td style="padding:16px 28px 0">
<p style="margin:0 0 4px;font-weight:700">Payment</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${charges}
<tr><td colspan="2" style="border-top:1px solid ${LINE};padding:0"></td></tr>
${row('Total charged', formatUsd(b.quote.total), true)}
</table></td></tr>
<tr><td style="padding:20px 28px 0">
<p style="margin:0;color:${MUTED}">Check-in details and house rules will follow before your arrival.</p>
</td></tr>
<tr><td style="padding:16px 28px 0">
<p style="margin:0 0 4px;font-weight:700">Terms and policies</p>
<p style="margin:0;color:${MUTED}">By booking you agreed to our ${link(`${SITE}/terms`, 'Terms')} and ${link(`${SITE}/policies`, 'Policies')} (cancellation and house rules). Our ${link(`${SITE}/privacy`, 'Privacy policy')} explains how we use your details.</p>
</td></tr>
<tr><td style="padding:20px 28px 28px">
${contactLine ? `<p style="margin:0 0 12px">Questions? ${contactLine}.</p>` : ''}
<p style="margin:0;color:${MUTED}">Home Over Hotels</p>
</td></tr>
</table></td></tr></table>
</body></html>`;
}
