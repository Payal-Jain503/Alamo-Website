/** Guest accounts. Sign-in itself (an emailed code) is done by Amazon Cognito; the API only checks the result. */

/** Checks the sign-in token a guest's browser sends, and returns their email address. */
export interface TokenVerifier {
  /** The guest's email in lower case, or undefined if the token is missing, forged or expired. */
  verify(token: string): Promise<string | undefined>;
}

/** Makes sure a Cognito user exists for an email address, so the emailed code can be sent. */
export interface AccountDirectory {
  ensure(email: string): Promise<void>;
}

export interface AccountSupport {
  /** What the browser needs to ask Cognito for the emailed code. Neither value is secret. */
  config: { clientId: string; region: string };
  verifier: TokenVerifier;
  directory: AccountDirectory;
}

export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The token from an `Authorization: Bearer …` header. */
export function bearerToken(header: string | undefined): string | undefined {
  const m = /^Bearer ([\w-]+\.[\w-]+\.[\w-]+)$/.exec(header?.trim() ?? '');
  return m?.[1];
}
