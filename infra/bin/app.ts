import { App } from 'aws-cdk-lib';
import { GithubDeployStack } from '../lib/github-deploy-stack.js';
import { SiteStack } from '../lib/site-stack.js';

/**
 * Settings come from `-c name=value` on the command line, or from the
 * GitHub repository variables in the deploy workflow.
 *
 *   ownerEmail       where booking emails and alerts go (required to deploy)
 *   domainNames      comma separated, for example alamocityrental.com,www.alamocityrental.com
 *   certificateArn   ACM certificate in us-east-1 for those names
 *   parameterPrefix  defaults to /alamo-web/
 *   githubProviderArn  only if the account already has GitHub's OIDC provider
 */
const app = new App();
const ctx = (name: string) => {
  const v = app.node.tryGetContext(name);
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
};

// Everything runs in us-east-1: CloudFront certificates must live there, and one region keeps it simple.
const env = { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'us-east-1' };

new SiteStack(app, 'AlamoWebsite', {
  env,
  description: 'Alamo City Rental website and booking engine',
  ownerEmail: ctx('ownerEmail') ?? 'owner@example.com',
  parameterPrefix: ctx('parameterPrefix') ?? '/alamo-web/',
  domainNames: ctx('domainNames')?.split(',').map((d) => d.trim()),
  certificateArn: ctx('certificateArn'),
});

new GithubDeployStack(app, 'AlamoWebsiteGithubDeploy', {
  env,
  description: 'Lets GitHub Actions deploy Alamo City Rental without stored keys',
  repository: 'Payal-Jain503/Alamo-Website',
  branch: 'main',
  existingProviderArn: ctx('githubProviderArn'),
});
