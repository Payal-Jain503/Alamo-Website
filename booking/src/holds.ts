import { eachNight } from './dates.js';

/**
 * The lock on each night of each home. Every hold and booking claims its
 * nights here, all or nothing, so two guests can never get the same night.
 *
 * Production stores these as one DynamoDB item per home and night, claimed
 * with a single conditional transaction. The in-memory store below has the
 * same rules and is what the tests and local runs use.
 */
export type NightLock =
  | { status: 'held'; holdId: string; expiresAt: string }
  | { status: 'booked'; holdId: string; bookingId: string };

export type ClaimResult = { ok: true } | { ok: false; takenNights: string[] };

export interface NightStore {
  /** Claims every night from check-in to the night before check-out, or none of them. */
  claim(homeId: string, checkIn: string, checkOut: string, holdId: string, expiresAt: Date, now: Date): Promise<ClaimResult>;
  /** Turns a hold into a booking. Fails if any night no longer belongs to the hold. */
  confirm(homeId: string, checkIn: string, checkOut: string, holdId: string, bookingId: string): Promise<boolean>;
  /** Frees the nights of a hold or booking. Nights owned by anything else are left alone. */
  release(homeId: string, checkIn: string, checkOut: string, holdId: string): Promise<void>;
  get(homeId: string, night: string): Promise<NightLock | undefined>;
}

/** A night is free when nobody holds it, or its hold has run out. A booking never expires. */
export function isFree(lock: NightLock | undefined, now: Date): boolean {
  if (!lock) return true;
  return lock.status === 'held' && Date.parse(lock.expiresAt) <= now.getTime();
}

export class InMemoryNightStore implements NightStore {
  private readonly locks = new Map<string, NightLock>();

  private key(homeId: string, night: string) {
    return `${homeId}|${night}`;
  }

  async claim(homeId: string, checkIn: string, checkOut: string, holdId: string, expiresAt: Date, now: Date): Promise<ClaimResult> {
    const nights = eachNight(checkIn, checkOut);
    // Check and write in one synchronous step, like a database transaction.
    const takenNights = nights.filter((n) => {
      const lock = this.locks.get(this.key(homeId, n));
      return !isFree(lock, now) && lock?.holdId !== holdId;
    });
    if (takenNights.length) return { ok: false, takenNights };
    for (const n of nights) this.locks.set(this.key(homeId, n), { status: 'held', holdId, expiresAt: expiresAt.toISOString() });
    return { ok: true };
  }

  async confirm(homeId: string, checkIn: string, checkOut: string, holdId: string, bookingId: string): Promise<boolean> {
    const nights = eachNight(checkIn, checkOut);
    // A hold that ran out still confirms as long as nobody else claimed its nights,
    // so a guest whose payment went through a little late is not turned away.
    const ours = nights.every((n) => this.locks.get(this.key(homeId, n))?.holdId === holdId);
    if (!ours) return false;
    for (const n of nights) this.locks.set(this.key(homeId, n), { status: 'booked', holdId, bookingId });
    return true;
  }

  async release(homeId: string, checkIn: string, checkOut: string, holdId: string): Promise<void> {
    for (const n of eachNight(checkIn, checkOut)) {
      const k = this.key(homeId, n);
      if (this.locks.get(k)?.holdId === holdId) this.locks.delete(k);
    }
  }

  async get(homeId: string, night: string): Promise<NightLock | undefined> {
    return this.locks.get(this.key(homeId, night));
  }
}
