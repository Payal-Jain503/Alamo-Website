import { putSavedHomes } from './auth';

/** Saved homes live in this browser, and are copied to the guest's account when they are signed in. */
const KEY = 'alamo-saved-homes';

export function readSaved(): string[] {
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? '[]') as unknown;
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function write(ids: string[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    // Private browsing can refuse storage; the heart then lasts until the page closes.
  }
  window.dispatchEvent(new Event('alamo-saved'));
}

export async function toggleSaved(slug: string): Promise<string[]> {
  const now = readSaved();
  const next = now.includes(slug) ? now.filter((s) => s !== slug) : [...now, slug];
  write(next);
  await putSavedHomes(next);
  return next;
}

/** On sign-in: keeps what this browser saved and what the account already had. */
export async function mergeSaved(fromAccount: string[]): Promise<string[]> {
  const merged = [...new Set([...fromAccount, ...readSaved()])];
  write(merged);
  if (merged.length !== fromAccount.length) await putSavedHomes(merged);
  return merged;
}
