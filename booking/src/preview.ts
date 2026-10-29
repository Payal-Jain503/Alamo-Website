import { addDays } from './dates.js';
import { nightMap, type Overlap } from './availability.js';
import type { Block, Source } from './types.js';

export interface FeedSummary {
  source: Source;
  label: string;
  origin: string;
  ok: boolean;
  error?: string;
  count: number;
}

export interface PreviewInput {
  propertyName: string;
  from: string;
  months: number;
  blocks: Block[];
  overlaps: Overlap[];
  feeds: FeedSummary[];
  generatedAt: Date;
  sample: boolean;
}

const LABEL: Record<Source, string> = { airbnb: 'Airbnb', vrbo: 'VRBO', direct: 'Direct', owner: 'Owner', other: 'Other' };
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function pretty(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return `${MONTHS[m! - 1]!.slice(0, 3)} ${d}, ${y}`;
}

function nights(b: { start: string; end: string }): number {
  return Math.round((Date.parse(b.end) - Date.parse(b.start)) / 86_400_000);
}

function monthGrid(year: number, month: number, map: Map<string, Block[]>, conflictNights: Set<string>): string {
  const first = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const lead = new Date(`${first}T00:00:00Z`).getUTCDay();
  const cells: string[] = [];
  for (let i = 0; i < lead; i++) cells.push('<div class="d empty" aria-hidden="true"></div>');
  for (let day = first; day.slice(0, 7) === first.slice(0, 7); day = addDays(day, 1)) {
    const on = map.get(day) ?? [];
    const sources = [...new Set(on.map((b) => b.source))];
    const reserved = on.some((b) => b.kind === 'reservation');
    const cls = ['d'];
    let title = 'Available';
    if (on.length) {
      cls.push(sources.length > 1 ? 'multi' : `s-${sources[0]}`, reserved ? 'res' : 'blk');
      title = on.map((b) => `${LABEL[b.source]}: ${b.kind === 'reservation' ? 'reserved' : 'blocked'}`).join(', ');
    } else cls.push('free');
    if (conflictNights.has(day)) {
      cls.push('conflict');
      title = `Double booking – ${title}`;
    }
    cells.push(`<div class="${cls.join(' ')}" title="${esc(`${pretty(day)}: ${title}`)}"><span>${Number(day.slice(8))}</span></div>`);
  }
  return `<div class="month"><h3>${MONTHS[month]} ${year}</h3><div class="dow"><span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span></div><div class="grid">${cells.join('')}</div></div>`;
}

/** A self-contained page showing one home's merged calendar, for checking against Airbnb and VRBO. */
export function renderPreview(input: PreviewInput): string {
  const [fy, fm] = input.from.split('-').map(Number);
  const startMonth = `${fy}-${String(fm).padStart(2, '0')}-01`;
  let endMonth = startMonth;
  for (let i = 0; i < input.months; i++) endMonth = addDays(endMonth, 32).slice(0, 8) + '01';

  const map = nightMap(input.blocks, startMonth, endMonth);
  const conflictNights = new Set<string>();
  for (const o of input.overlaps) for (let n = o.start; n < o.end; n = addDays(n, 1)) conflictNights.add(n);

  const months: string[] = [];
  for (let i = 0, y = fy!, m = fm! - 1; i < input.months; i++, m++) {
    if (m === 12) { m = 0; y++; }
    months.push(monthGrid(y, m, map, conflictNights));
  }

  const inRange = input.blocks
    .filter((b) => b.end > startMonth && b.start < endMonth)
    .sort((a, b) => a.start.localeCompare(b.start) || a.source.localeCompare(b.source));
  const bookedNights = map.size;
  const totalNights = Math.round((Date.parse(endMonth) - Date.parse(startMonth)) / 86_400_000);

  const feedRows = input.feeds
    .map((f) => `<tr><td>${esc(f.label)}</td><td>${f.ok ? '<span class="pill ok">Read</span>' : `<span class="pill bad">Failed</span> ${esc(f.error ?? '')}`}</td><td class="num">${f.count}</td><td class="mono">${esc(f.origin)}</td></tr>`)
    .join('');

  const blockRows = inRange
    .map((b) => {
      const conflict = input.overlaps.some((o) => o.blocks.includes(b));
      return `<tr${conflict ? ' class="row-conflict"' : ''}><td><span class="sw s-${b.source} ${b.kind === 'reservation' ? 'res' : 'blk'}"></span>${LABEL[b.source]}</td><td>${b.kind === 'reservation' ? 'Reservation' : 'Blocked'}</td><td>${pretty(b.start)}</td><td>${pretty(b.end)}</td><td class="num">${nights(b)}</td><td>${esc(b.summary)}</td></tr>`;
    })
    .join('');

  const conflictBox = input.overlaps.length
    ? `<div class="callout bad"><b>${input.overlaps.length} double booking${input.overlaps.length > 1 ? 's' : ''} found.</b> ${input.overlaps
        .map((o) => `${pretty(o.start)} (${nights(o)} night${nights(o) > 1 ? 's' : ''}): ${[...new Set(o.blocks.map((b) => LABEL[b.source]))].join(' and ')} both have a guest reservation.`)
        .join(' ')}</div>`
    : '<div class="callout good"><b>No double bookings.</b> No night has guest reservations on more than one site.</div>';

  return `<title>${esc(input.propertyName)} Calendar Check</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:opsz,wght@6..96,500&family=Figtree:wght@400;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
/* Layout: summary row, legend, month grids that wrap, then the raw event list */
:root {
  --bg: #f2f2ee; --surface: #fbfbf8; --ink: #15203a; --muted: #5a6273; --line: #d8d9d2;
  --airbnb: #d9604c; --airbnb-soft: #f3d3cc; --vrbo: #2f5fa8; --vrbo-soft: #cfdcf0;
  --direct: #9a6a22; --direct-soft: #ecdcc0; --free: #fbfbf8;
  --bad: #b3261e; --bad-bg: #f7e1df; --good: #2c6a6e; --good-bg: #e3efec;
  --display: "Bodoni Moda", Didot, Georgia, serif; --body: "Figtree", "Segoe UI", system-ui, sans-serif; --mono: "IBM Plex Mono", ui-monospace, Menlo, monospace;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg: #10151f; --surface: #171e2b; --ink: #e8e8e2; --muted: #a2a8b5; --line: #2b3444;
  --airbnb: #ee8676; --airbnb-soft: #4a2a27; --vrbo: #7ea6e6; --vrbo-soft: #22324d;
  --direct: #d6a65a; --direct-soft: #3d3220; --free: #171e2b;
  --bad: #f08a80; --bad-bg: #3d2220; --good: #6fb3b5; --good-bg: #1c3130; color-scheme: dark; } }
:root[data-theme="dark"] {
  --bg: #10151f; --surface: #171e2b; --ink: #e8e8e2; --muted: #a2a8b5; --line: #2b3444;
  --airbnb: #ee8676; --airbnb-soft: #4a2a27; --vrbo: #7ea6e6; --vrbo-soft: #22324d;
  --direct: #d6a65a; --direct-soft: #3d3220; --free: #171e2b;
  --bad: #f08a80; --bad-bg: #3d2220; --good: #6fb3b5; --good-bg: #1c3130; color-scheme: dark; }
* { box-sizing: border-box; }
body { background: var(--bg); color: var(--ink); font-family: var(--body); font-size: 15px; line-height: 1.55;
  padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
main { max-width: 1080px; margin: 0 auto; padding-block: 36px 72px; }
.eyebrow { font-family: var(--mono); font-size: 12px; letter-spacing: .12em; text-transform: uppercase; color: var(--direct); }
h1 { font-family: var(--display); font-weight: 500; font-size: clamp(30px, 5vw, 46px); line-height: 1.1; margin: 8px 0 6px; text-wrap: balance; }
h2 { font-family: var(--display); font-weight: 500; font-size: 24px; margin: 36px 0 10px; }
.sub { color: var(--muted); margin: 0; max-width: 70ch; }
.sample { display: inline-block; margin-top: 12px; font-family: var(--mono); font-size: 12px; padding: 3px 9px; border-radius: 3px; background: var(--direct-soft); color: var(--ink); }
.stats { display: flex; flex-wrap: wrap; gap: 10px 32px; margin: 22px 0 8px; }
.stat b { display: block; font-family: var(--display); font-size: 30px; font-weight: 500; font-variant-numeric: tabular-nums; }
.stat span { font-size: 13px; color: var(--muted); }
.callout { padding: 12px 16px; border-radius: 6px; margin: 18px 0; border-left: 3px solid; max-width: 78ch; }
.callout.bad { background: var(--bad-bg); border-color: var(--bad); }
.callout.good { background: var(--good-bg); border-color: var(--good); }
.legend { display: flex; flex-wrap: wrap; gap: 8px 20px; font-size: 13px; color: var(--muted); margin: 10px 0 4px; }
.legend span { display: inline-flex; align-items: center; gap: 7px; }
.sw { display: inline-block; width: 14px; height: 14px; border-radius: 3px; border: 1px solid var(--line); vertical-align: -2px; margin-right: 6px; }
.months { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 18px; margin-top: 14px; }
.month { background: var(--surface); border: 1px solid var(--line); border-radius: 6px; padding: 14px; min-width: 0; }
.month h3 { margin: 0 0 8px; font-size: 15px; }
.dow, .grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 3px; }
.dow span { font-family: var(--mono); font-size: 10.5px; color: var(--muted); text-align: center; padding-bottom: 3px; }
.d { aspect-ratio: 1; max-width: 100%; border-radius: 4px; display: grid; place-items: center; font-size: 12.5px; font-variant-numeric: tabular-nums; position: relative; }
.d.free { background: var(--free); border: 1px solid var(--line); }
.d.empty { background: transparent; }
.s-airbnb.res { background: var(--airbnb); color: #fff; } .s-airbnb.blk { background: var(--airbnb-soft); color: var(--ink); }
.s-vrbo.res { background: var(--vrbo); color: #fff; } .s-vrbo.blk { background: var(--vrbo-soft); color: var(--ink); }
.s-direct.res, .s-owner.res { background: var(--direct); color: #fff; } .s-direct.blk, .s-owner.blk, .s-other.blk, .s-other.res { background: var(--direct-soft); color: var(--ink); }
.d.multi { background: repeating-linear-gradient(135deg, var(--airbnb-soft) 0 5px, var(--vrbo-soft) 5px 10px); color: var(--ink); }
.d.multi.res { background: repeating-linear-gradient(135deg, var(--airbnb) 0 5px, var(--vrbo) 5px 10px); color: #fff; }
.d.conflict { outline: 2.5px solid var(--bad); outline-offset: 1px; }
.d.conflict::after { content: "!"; position: absolute; top: -6px; right: -4px; width: 14px; height: 14px; border-radius: 50%; background: var(--bad); color: var(--bg); font-size: 10px; font-weight: 700; display: grid; place-items: center; }
.tablewrap { overflow-x: auto; border: 1px solid var(--line); border-radius: 6px; background: var(--surface); margin-top: 10px; }
table { border-collapse: collapse; width: 100%; font-size: 13.5px; }
th, td { text-align: left; padding: 8px 12px; border-bottom: 1px solid var(--line); white-space: nowrap; }
th { font-family: var(--mono); font-size: 10.5px; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); font-weight: 500; background: var(--bg); }
tr:last-child td { border-bottom: 0; }
td.num { text-align: right; font-variant-numeric: tabular-nums; }
td.mono { font-family: var(--mono); font-size: 12px; color: var(--muted); }
tr.row-conflict td { background: var(--bad-bg); }
.pill { font-family: var(--mono); font-size: 11px; padding: 1px 7px; border-radius: 3px; }
.pill.ok { background: var(--good-bg); color: var(--good); } .pill.bad { background: var(--bad-bg); color: var(--bad); }
footer { margin-top: 40px; font-size: 13px; color: var(--muted); }
</style>
<main>
  <div class="eyebrow">Calendar check · Alamo City Rental</div>
  <h1>${esc(input.propertyName)}</h1>
  <p class="sub">Airbnb and VRBO calendars merged into one, the way the booking engine sees them. Compare these dates with each site's own calendar.</p>
  ${input.sample ? '<span class="sample">Sample data in the Airbnb and VRBO format, not a real listing</span>' : ''}
  <div class="stats">
    <div class="stat"><b>${bookedNights} / ${totalNights}</b><span>nights unavailable</span></div>
    <div class="stat"><b>${inRange.filter((b) => b.kind === 'reservation').length}</b><span>guest reservations</span></div>
    <div class="stat"><b>${inRange.filter((b) => b.kind === 'blocked').length}</b><span>blocked periods</span></div>
    <div class="stat"><b>${input.overlaps.length}</b><span>double bookings</span></div>
  </div>
  ${conflictBox}
  <h2>Calendar</h2>
  <div class="legend">
    <span><i class="sw s-airbnb res"></i>Airbnb reservation</span>
    <span><i class="sw s-airbnb blk"></i>Airbnb blocked</span>
    <span><i class="sw s-vrbo res"></i>VRBO reservation</span>
    <span><i class="sw s-vrbo blk"></i>VRBO blocked</span>
    <span><i class="sw multi res d" style="aspect-ratio:auto"></i>On both sites</span>
    <span><i class="sw" style="outline:2px solid var(--bad)"></i>Double booking</span>
    <span><i class="sw free d" style="aspect-ratio:auto"></i>Available</span>
  </div>
  <p class="sub" style="font-size:13px">A coloured square is a night that is not available. Check-out days stay open for the next guest. Airbnb blocks dates it copies from VRBO (and the other way round), so a reservation on one site with a block on the other is normal.</p>
  <div class="months">${months.join('')}</div>
  <h2>Feeds read</h2>
  <div class="tablewrap"><table><thead><tr><th>Site</th><th>Status</th><th>Events</th><th>Source</th></tr></thead><tbody>${feedRows}</tbody></table></div>
  <h2>Every event</h2>
  <div class="tablewrap"><table><thead><tr><th>Site</th><th>Type</th><th>Check-in</th><th>Check-out</th><th>Nights</th><th>Title in feed</th></tr></thead><tbody>${blockRows || '<tr><td colspan="6">No events in this period</td></tr>'}</tbody></table></div>
  <footer>Generated ${esc(input.generatedAt.toISOString().replace('T', ' ').slice(0, 16))} UTC by the Alamo City Rental booking engine.</footer>
</main>
`;
}
