/**
 * Checks one home's Airbnb and VRBO calendars and prints the merged result.
 *
 *   npm run check-calendar -- --name "San Antonio 5BR" \
 *     --airbnb <url or .ics file> --vrbo <url or .ics file> \
 *     [--from 2026-11-01] [--months 3] [--html preview.html] [--sample]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { findDoubleBookings } from './availability.js';
import { fetchFeed } from './fetchFeed.js';
import { FeedFormatError, parseFeed } from './parseFeed.js';
import { renderPreview, type FeedSummary } from './preview.js';
import type { Block, Source } from './types.js';

const TIME_ZONE = 'America/Chicago';

const { values } = parseArgs({
  options: {
    name: { type: 'string', default: 'Test home' },
    airbnb: { type: 'string' },
    vrbo: { type: 'string' },
    other: { type: 'string' },
    from: { type: 'string' },
    months: { type: 'string', default: '3' },
    html: { type: 'string' },
    sample: { type: 'boolean', default: false },
  },
});

/** Hides the private token in a feed link before printing it. */
function redact(origin: string): string {
  return /^https?:/i.test(origin) ? origin.replace(/([?&](s|t|token)=)[^&]+/gi, '$1…').replace(/\/ical\/[^/?]+/, '/ical/…') : origin;
}

async function load(origin: string): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  if (/^https?:\/\//i.test(origin)) return fetchFeed(origin);
  try {
    return { ok: true, text: await readFile(origin, 'utf8') };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

const inputs = (['airbnb', 'vrbo', 'other'] as const).filter((s) => values[s]).map((s) => ({ source: s as Source, origin: values[s]! }));
if (inputs.length === 0) {
  console.error('Give at least one calendar: --airbnb, --vrbo or --other (a link or an .ics file).');
  process.exit(1);
}

const blocks: Block[] = [];
const feeds: FeedSummary[] = [];
for (const { source, origin } of inputs) {
  const label = source === 'airbnb' ? 'Airbnb' : source === 'vrbo' ? 'VRBO' : 'Other';
  const loaded = await load(origin);
  if (!loaded.ok) {
    feeds.push({ source, label, origin: redact(origin), ok: false, error: loaded.error, count: 0 });
    continue;
  }
  try {
    const parsed = parseFeed(loaded.text, source, TIME_ZONE);
    blocks.push(...parsed.blocks);
    feeds.push({ source, label, origin: redact(origin), ok: true, count: parsed.blocks.length });
    for (const w of parsed.warnings) console.warn(`${label}: ${w}`);
  } catch (err) {
    if (!(err instanceof FeedFormatError)) throw err;
    feeds.push({ source, label, origin: redact(origin), ok: false, error: err.message, count: 0 });
  }
}

const overlaps = findDoubleBookings(blocks);
const from = values.from ?? new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(new Date());

console.log(`\n${values.name}`);
for (const f of feeds) console.log(`  ${f.label.padEnd(7)} ${f.ok ? `${f.count} events` : `FAILED: ${f.error}`}`);
console.log('\n  Site    Type         Check-in    Check-out   Nights  Title');
for (const b of [...blocks].sort((a, c) => a.start.localeCompare(c.start))) {
  const n = Math.round((Date.parse(b.end) - Date.parse(b.start)) / 86_400_000);
  console.log(`  ${b.source.padEnd(7)} ${b.kind.padEnd(12)} ${b.start}  ${b.end}  ${String(n).padStart(6)}  ${b.summary}`);
}
console.log(overlaps.length ? `\n  DOUBLE BOOKINGS: ${overlaps.map((o) => `${o.start} to ${o.end}`).join(', ')}` : '\n  No double bookings.');

if (values.html) {
  const html = renderPreview({
    propertyName: values.name!,
    from,
    months: Number(values.months),
    blocks,
    overlaps,
    feeds,
    generatedAt: new Date(),
    sample: values.sample!,
  });
  await writeFile(values.html, html);
  console.log(`\n  Preview written to ${values.html}`);
}
