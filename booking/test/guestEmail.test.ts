import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bookingConfirmationEmail } from '../src/guestEmail.js';
import type { Booking } from '../src/checkout.js';

test('the HTML confirmation escapes the guest name and lists the charges', () => {
  const booking = {
    id: 'AC-1',
    guest: { name: 'Eve <script>alert(1)</script>', email: 'eve@example.com' },
    quote: {
      checkIn: '2027-02-03',
      checkOut: '2027-02-05',
      nights: ['2027-02-03', '2027-02-04'],
      guests: 2,
      nightsTotal: 40800,
      fees: [{ label: 'Cleaning fee', amount: 15000 }],
      taxes: [{ label: 'City hotel tax (9%)', amount: 5022 }],
      total: 60822,
    },
  } as unknown as Booking;
  const mail = bookingConfirmationEmail(booking, 'Pendant Pass Theater', { email: 'help@example.com' });
  assert.doesNotMatch(mail.html, /<script>/);
  assert.match(mail.html, /Eve &lt;script&gt;/);
  assert.match(mail.html, /Wed, Feb 3, 2027/);
  assert.match(mail.html, /Cleaning fee/);
  assert.match(mail.html, /\$608\.22/);
  assert.match(mail.html, /help@example\.com/);
});

test('the confirmation lists pets only when the guest brings some', () => {
  const quote = { checkIn: '2027-02-03', checkOut: '2027-02-05', nights: ['2027-02-03', '2027-02-04'], guests: 2, nightsTotal: 40800, fees: [], taxes: [], total: 40800 };
  const withPet = bookingConfirmationEmail({ id: 'AC-2', guest: { name: 'Sam', email: 's@example.com' }, quote: { ...quote, pets: 1 } } as unknown as Booking, 'Hideaway');
  assert.match(withPet.text, /Pets: 1/);
  assert.match(withPet.html, />Pets</);
  const none = bookingConfirmationEmail({ id: 'AC-3', guest: { name: 'Sam', email: 's@example.com' }, quote: { ...quote, pets: 0 } } as unknown as Booking, 'Hideaway');
  assert.doesNotMatch(none.text, /Pets/);
});
