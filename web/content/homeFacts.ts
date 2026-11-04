import type { Home } from './homes';

/** Features guests filter by. Each is found in a home's amenities, highlights or description. */
export const featureFilters: Array<{ key: string; label: string; test: RegExp }> = [
  { key: 'pool', label: 'Swimming pool', test: /swimming pool|\bpool\b(?! table)|\bpool,|pool and/i },
  { key: 'pool-table', label: 'Pool table', test: /pool table|billiard/i },
  { key: 'theater', label: 'Home theater', test: /theater|theatre|projector/i },
  { key: 'ping-pong', label: 'Ping pong', test: /ping.?pong|table tennis/i },
  { key: 'air-hockey', label: 'Air hockey', test: /air hockey/i },
  { key: 'gated', label: 'Gated community', test: /gated/i },
];

/** Number of beds, read from a highlight such as "6 beds" or "6 king beds". Undefined when not stated. */
export function bedCount(home: Home): number | undefined {
  for (const h of home.highlights) {
    const m = /^(\d+)\s+(?:[a-z]+\s+)?beds?\b/i.exec(h.trim());
    if (m) return Number(m[1]);
  }
  return undefined;
}

/** Keys of the featureFilters a home has. */
export function featuresOf(home: Home): string[] {
  const text = [...home.amenities, ...home.highlights, ...home.description].join(' | ');
  return featureFilters.filter((f) => f.test.test(text)).map((f) => f.key);
}
