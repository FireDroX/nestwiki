export class OAuthAuthorizeDecisionDto {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  state?: string;
  scope?: string;
  decision: 'allow' | 'deny';
}
