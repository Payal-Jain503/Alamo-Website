export type FetchResult = { ok: true; text: string } | { ok: false; error: string };

export interface FetchOptions {
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

/**
 * Downloads a feed. Any problem comes back as an error result instead of an
 * empty calendar, so a failed download can never open up booked dates.
 */
export async function fetchFeed(url: string, options: FetchOptions = {}): Promise<FetchResult> {
  const { timeoutMs = 15_000, fetchImpl = fetch } = options;
  try {
    const response = await fetchImpl(url, {
      headers: { accept: 'text/calendar, text/plain;q=0.9, */*;q=0.1' },
      signal: AbortSignal.timeout(timeoutMs),
      redirect: 'follow',
    });
    if (!response.ok) return { ok: false, error: `HTTP ${response.status}` };
    const text = await response.text();
    if (!text.includes('BEGIN:VCALENDAR')) return { ok: false, error: 'Response was not an iCal calendar' };
    return { ok: true, text };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
