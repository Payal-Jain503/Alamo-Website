import { AdminCreateUserCommand, CognitoIdentityProviderClient, UsernameExistsException } from '@aws-sdk/client-cognito-identity-provider';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import type { AccountDirectory, AccountSupport, TokenVerifier } from '../accounts.js';

/** Checks Cognito ID tokens against the user pool's published signing keys. */
export class CognitoTokenVerifier implements TokenVerifier {
  private readonly verifier;

  constructor(userPoolId: string, clientId: string) {
    this.verifier = CognitoJwtVerifier.create({ userPoolId, clientId, tokenUse: 'id' });
  }

  async verify(token: string) {
    try {
      const claims = await this.verifier.verify(token);
      const email = claims.email;
      // The email must have been proven with the emailed code, which sets email_verified.
      return typeof email === 'string' && claims.email_verified === true ? email.trim().toLowerCase() : undefined;
    } catch {
      return undefined;
    }
  }
}

export class CognitoDirectory implements AccountDirectory {
  constructor(
    private readonly cognito: Pick<CognitoIdentityProviderClient, 'send'>,
    private readonly userPoolId: string,
  ) {}

  async ensure(email: string) {
    try {
      await this.cognito.send(
        new AdminCreateUserCommand({
          UserPoolId: this.userPoolId,
          Username: email,
          UserAttributes: [
            { Name: 'email', Value: email },
            // The sign-in code is sent to this address, so only its owner can finish signing in.
            { Name: 'email_verified', Value: 'true' },
          ],
          MessageAction: 'SUPPRESS',
        }),
      );
    } catch (err) {
      if (err instanceof UsernameExistsException) return;
      throw err;
    }
  }
}

export function cognitoAccounts(userPoolId: string, clientId: string): AccountSupport {
  return { config: { clientId, region: process.env.AWS_REGION ?? 'ap-south-1' }, verifier: new CognitoTokenVerifier(userPoolId, clientId), directory: new CognitoDirectory(new CognitoIdentityProviderClient({}), userPoolId) };
}
