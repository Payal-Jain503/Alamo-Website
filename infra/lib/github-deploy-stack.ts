import { CfnOutput, Stack, type StackProps } from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import type { Construct } from 'constructs';

export interface GithubDeployStackProps extends StackProps {
  /** owner/name of the GitHub repository allowed to deploy. */
  repository: string;
  /** Only this branch can deploy. */
  branch: string;
  /** Set when the account already has GitHub's OIDC provider, since an account can hold only one. */
  existingProviderArn?: string;
}

/**
 * Lets GitHub Actions deploy without any stored AWS keys. GitHub proves which
 * repository and branch a run comes from, and AWS hands it short-lived
 * credentials for this one role. Deployed once by the account owner.
 */
export class GithubDeployStack extends Stack {
  constructor(scope: Construct, id: string, props: GithubDeployStackProps) {
    super(scope, id, props);
    const issuer = 'token.actions.githubusercontent.com';

    const providerArn =
      props.existingProviderArn ??
      new iam.OidcProviderNative(this, 'GithubOidc', { url: `https://${issuer}`, clientIds: ['sts.amazonaws.com'] }).oidcProviderArn;

    const role = new iam.Role(this, 'DeployRole', {
      roleName: 'alamo-website-github-deploy',
      description: `GitHub Actions deploys from ${props.repository} (${props.branch} only)`,
      assumedBy: new iam.WebIdentityPrincipal(providerArn, {
        StringEquals: {
          [`${issuer}:aud`]: 'sts.amazonaws.com',
          [`${issuer}:sub`]: `repo:${props.repository}:ref:refs/heads/${props.branch}`,
        },
      }),
    });

    // CDK deploys through the roles `cdk bootstrap` created, so this role only needs to assume those.
    role.addToPolicy(
      new iam.PolicyStatement({
        actions: ['sts:AssumeRole'],
        resources: [`arn:aws:iam::${this.account}:role/cdk-hnb659fds-*`],
      }),
    );

    new CfnOutput(this, 'DeployRoleArn', { value: role.roleArn, description: 'Save as the AWS_DEPLOY_ROLE_ARN variable in the GitHub repository settings' });
  }
}
