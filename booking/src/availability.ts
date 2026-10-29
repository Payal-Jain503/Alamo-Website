import { eachNight } from './dates.js';
import type { Block } from './types.js';

/** The blocks covering each night in [from, to). Nights with no blocks are left out. */
export function nightMap(blocks: Block[], from: string, to: string): Map<string, Block[]> {
  const map = new Map<string, Block[]>();
  for (const block of blocks) {
    const start = block.start > from ? block.start : from;
    const end = block.end < to ? block.end : to;
    for (const night of eachNight(start, end)) {
      const list = map.get(night) ?? [];
      list.push(block);
      map.set(night, list);
    }
  }
  return map;
}

/** Whether a stay from check-in to check-out is free. Check-out day itself is never needed. */
export function checkAvailability(blocks: Block[], checkIn: string, checkOut: string) {
  if (checkOut <= checkIn) throw new Error('Check-out must be after check-in');
  const conflicts = blocks.filter((b) => b.start < checkOut && b.end > checkIn);
  return { available: conflicts.length === 0, conflicts };
}

export interface Overlap {
  start: string;
  end: string;
  blocks: Block[];
}

/**
 * Runs of nights reserved by guests on two or more different sources: a
 * real double booking. A reservation on one site next to a plain block on
 * another is normal, because each site blocks dates it imports from the other.
 */
export function findDoubleBookings(blocks: Block[]): Overlap[] {
  const reservations = blocks.filter((b) => b.kind === 'reservation');
  if (reservations.length < 2) return [];
  const from = reservations.reduce((m, b) => (b.start < m ? b.start : m), reservations[0]!.start);
  const to = reservations.reduce((m, b) => (b.end > m ? b.end : m), reservations[0]!.end);
  const nights = [...nightMap(reservations, from, to).entries()].sort(([a], [b]) => a.localeCompare(b));

  const overlaps: Overlap[] = [];
  for (const [night, onNight] of nights) {
    if (new Set(onNight.map((b) => b.source)).size < 2) continue;
    const last = overlaps.at(-1);
    const next = new Date(`${night}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    const nextNight = next.toISOString().slice(0, 10);
    if (last && last.end === night) {
      last.end = nextNight;
      for (const b of onNight) if (!last.blocks.includes(b)) last.blocks.push(b);
    } else {
      overlaps.push({ start: night, end: nextNight, blocks: [...onNight] });
    }
  }
  return overlaps;
}
