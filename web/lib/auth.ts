/**
 * Guest sign-in with an emailed 6-digit code. Amazon Cognito sends and checks
 * the code; the browser talks to it directly, and the booking API checks the
 * resulting ID token. Nothing secret is kept here.
 */

export interface Trip {
  bookingId: string;
  homeId: string;
  homeName: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  totalCents: number;
  currency: 'usd';
  confirmedAt: string;
  status: 'upcoming' | 'past';
}

export interface Account {
  email: string;
  name?: string;
  phone?: string;
  trips: Trip[];
  saved: string[];
}

interface Config {
  clientId: string;
  region: string;
}

interface Saved {
  idToken: string;
  refreshToken: string;
  /** Milliseconds since 1970 when the ID token stops working. */
  expiresAt: number;
}

const KEY = 'alamo-guest-session';

function load(): Saved | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}

function save(s: Saved | null) {
  try {
    if (s) window.localStorage.setItem(KEY, JSON.stringify(s));
    else window.localStorage.removeItem(KEY);
  } catch {
    // Private browsing can refuse storage. The guest simply signs in again next visit.
  }
}

let config: Promise<Config> | undefined;

function getConfig(): Promise<Config> {
  config ??= fetch('/api/auth/config', { cache: 'no-store' }).then(async (res) => {
    if (!res.headers.get('content-type')?.includes('application/json') || !res.ok) throw new Error('Accounts are not available yet.');
    return (await res.json()) as Config;
  });
  config.catch(() => (config = undefined));
  return config;
}

async function cognito<T>(target: string, payload: Record<string, unknown>): Promise<T> {
  const { region, clientId } = await getConfig();
  const res = await fetch(`https://cognito-idp.${region}.amazonaws.com/`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-amz-json-1.1', 'x-amz-target': `AWSCognitoIdentityProviderService.${target}` },
    body: JSON.stringify({ ClientId: clientId, ...payload }),
  });
  const body = (await res.json().catch(() => ({}))) as { __type?: string; message?: string } & T;
  if (!res.ok) throw Object.assign(new Error(body.message ?? 'Sign-in failed'), { code: body.__type ?? '' });
  return body;
}

interface AuthResult {
  AuthenticationResult?: { IdToken: string; RefreshToken?: string; ExpiresIn: number };
  Session?: string;
  ChallengeName?: string;
}

/** Emails a 6-digit code to the address. Returns the session the code must be sent back with. */
export async function startSignIn(email: string): Promise<string> {
  const address = email.trim().toLowerCase();
  const res = await fetch('/api/auth/start', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: address }), cache: 'no-store' });
  if (res.status === 400) throw new Error('Please enter a valid email address.');
  if (!res.ok) throw new Error('We could not start sign-in. Please try again.');
  const r = await cognito<AuthResult>('InitiateAuth', { AuthFlow: 'USER_AUTH', AuthParameters: { USERNAME: address, PREFERRED_CHALLENGE: 'EMAIL_OTP' } });
  if (r.ChallengeName !== 'EMAIL_OTP' || !r.Session) throw new Error('We could not send the code. Please try again.');
  return r.Session;
}

export async function confirmCode(email: string, session: string, code: string): Promise<void> {
  try {
    const r = await cognito<AuthResult>('RespondToAuthChallenge', {
      ChallengeName: 'EMAIL_OTP',
      Session: session,
      ChallengeResponses: { USERNAME: email.trim().toLowerCase(), EMAIL_OTP_CODE: code.replace(/\s/g, '') },
    });
    const a = r.AuthenticationResult;
    if (!a?.RefreshToken) throw new Error('That code did not work. Please check it and try again.');
    save({ idToken: a.IdToken, refreshToken: a.RefreshToken, expiresAt: Date.now() + a.ExpiresIn * 1000 });
  } catch (err) {
    const code = (err as { code?: string }).code ?? '';
    if (code.includes('CodeMismatch') || code.includes('NotAuthorized') || code.includes('ExpiredCode')) throw new Error('That code did not work. Please check it, or ask for a new one.');
    throw err;
  }
}

/** A working ID token, renewed when it is about to run out, or null when nobody is signed in. */
export async function getToken(): Promise<string | null> {
  const s = load();
  if (!s) return null;
  if (s.expiresAt - Date.now() > 60_000) return s.idToken;
  try {
    const r = await cognito<AuthResult>('InitiateAuth', { AuthFlow: 'REFRESH_TOKEN_AUTH', AuthParameters: { REFRESH_TOKEN: s.refreshToken } });
    const a = r.AuthenticationResult;
    if (!a) throw new Error('expired');
    save({ idToken: a.IdToken, refreshToken: s.refreshToken, expiresAt: Date.now() + a.ExpiresIn * 1000 });
    return a.IdToken;
  } catch {
    save(null);
    return null;
  }
}

export function signOut() {
  save(null);
}

/** The signed-in guest's details and trips, or null when signed out. */
export async function getAccount(): Promise<Account | null> {
  const token = await getToken();
  if (!token) return null;
  const res = await fetch('/api/me', { headers: { authorization: `Bearer ${token}` }, cache: 'no-store' });
  if (res.status === 401) {
    save(null);
    return null;
  }
  if (!res.headers.get('content-type')?.includes('application/json') || !res.ok) throw new Error('Your trips are not available right now.');
  return (await res.json()) as Account;
}

/** Replaces the signed-in guest's saved homes on the server. Quietly does nothing when signed out. */
export async function putSavedHomes(homes: string[]): Promise<void> {
  const token = await getToken();
  if (!token) return;
  await fetch('/api/me/wishlist', {
    method: 'PUT',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ homes }),
  }).catch(() => undefined);
}
