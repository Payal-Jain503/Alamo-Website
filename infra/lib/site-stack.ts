import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cwActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, OutputFormat, type NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subs from 'aws-cdk-lib/aws-sns-subscriptions';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import type { Construct } from 'constructs';

const repoPath = (p: string) => fileURLToPath(new URL(`../../${p}`, import.meta.url));

/** Must match ORIGIN_HEADER in booking/src/server/http.ts. */
const ORIGIN_HEADER = 'x-alamo-origin';

export interface SiteStackProps extends StackProps {
  /** Where booking emails and calendar alerts go. */
  ownerEmail: string;
  /** Parameter Store prefix for the secrets, for example /alamo/. */
  parameterPrefix: string;
  /** For example ['alamocityrental.com', 'www.alamocityrental.com']. Leave out to use the CloudFront address. */
  domainNames?: string[];
  /** An ACM certificate in us-east-1 covering every domain name. */
  certificateArn?: string;
}

/**
 * Everything the site needs, sized for the lowest bill:
 * S3 and CloudFront for the pages, one Lambda function behind CloudFront for
 * the booking API, one for the scheduled jobs, one DynamoDB table, SNS email
 * alerts. No API Gateway, NAT gateway or always-on servers.
 */
export class SiteStack extends Stack {
  constructor(scope: Construct, id: string, props: SiteStackProps) {
    super(scope, id, props);
    const prefix = props.parameterPrefix.replace(/\/?$/, '/');

    const table = new dynamodb.TableV2(this, 'Table', {
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billing: dynamodb.Billing.onDemand(),
      timeToLiveAttribute: 'ttl',
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      deletionProtection: true,
      removalPolicy: RemovalPolicy.RETAIN,
      globalSecondaryIndexes: [
        {
          indexName: 'gsi1',
          partitionKey: { name: 'gsi1pk', type: dynamodb.AttributeType.STRING },
          sortKey: { name: 'gsi1sk', type: dynamodb.AttributeType.STRING },
        },
      ],
    });

    const alerts = new sns.Topic(this, 'OwnerAlerts', { displayName: 'Alamo City Rental bookings' });
    alerts.addSubscription(new subs.EmailSubscription(props.ownerEmail));

    const bookingDir = repoPath('booking');
    const common: NodejsFunctionProps = {
      entry: `${bookingDir}/src/aws/handlers.ts`,
      projectRoot: bookingDir,
      depsLockFilePath: `${bookingDir}/package-lock.json`,
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 512,
      environment: { TABLE_NAME: table.tableName, ALERT_TOPIC_ARN: alerts.topicArn, PARAMETER_PREFIX: prefix, NODE_OPTIONS: '--enable-source-maps' },
      bundling: {
        format: OutputFormat.ESM,
        target: 'node22',
        minify: true,
        sourceMap: true,
        // The AWS SDK ships with the Lambda runtime.
        externalModules: ['@aws-sdk/*'],
        mainFields: ['module', 'main'],
        // node-ical uses require(); this lets it run inside an ES module bundle.
        banner: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
      },
    };

    const api = new NodejsFunction(this, 'Api', {
      ...common,
      handler: 'api',
      timeout: Duration.seconds(29),
      description: 'Booking API: availability, quotes, checkout, Stripe webhook, export calendars',
      logGroup: new logs.LogGroup(this, 'ApiLogs', { retention: logs.RetentionDays.THREE_MONTHS }),
    });
    const jobs = new NodejsFunction(this, 'Jobs', {
      ...common,
      handler: 'jobs',
      timeout: Duration.minutes(5),
      description: 'Calendar sync and hold sweeper',
      logGroup: new logs.LogGroup(this, 'JobLogs', { retention: logs.RetentionDays.ONE_MONTH }),
    });

    for (const fn of [api, jobs]) {
      table.grantReadWriteData(fn);
      alerts.grantPublish(fn);
      fn.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ['ssm:GetParametersByPath'],
          resources: [this.formatArn({ service: 'ssm', resource: 'parameter', resourceName: prefix.replace(/^\/|\/$/g, '') })],
        }),
      );
    }

    new events.Rule(this, 'SyncEvery15Minutes', {
      schedule: events.Schedule.rate(Duration.minutes(15)),
      targets: [new targets.LambdaFunction(jobs, { event: events.RuleTargetInput.fromObject({ job: 'sync' }), retryAttempts: 0 })],
    });
    new events.Rule(this, 'SweepEvery5Minutes', {
      schedule: events.Schedule.rate(Duration.minutes(5)),
      targets: [new targets.LambdaFunction(jobs, { event: events.RuleTargetInput.fromObject({ job: 'sweep' }), retryAttempts: 0 })],
    });

    // Errors in either function email the owner. Calendar problems already send their own alerts.
    for (const [name, fn] of [['Api', api], ['Jobs', jobs]] as const) {
      new cloudwatch.Alarm(this, `${name}Errors`, {
        metric: fn.metricErrors({ period: Duration.minutes(15) }),
        threshold: 3,
        evaluationPeriods: 1,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        alarmDescription: `The ${name.toLowerCase()} function failed 3 or more times in 15 minutes. Check its logs in CloudWatch.`,
      }).addAlarmAction(new cwActions.SnsAction(alerts));
    }

    // The function is reachable only through CloudFront, which adds this secret header.
    const apiUrl = api.addFunctionUrl({ authType: lambda.FunctionUrlAuthType.NONE });
    const originSecret = ssm.StringParameter.valueForStringParameter(this, `${prefix}origin-secret`);
    const apiOrigin = new origins.FunctionUrlOrigin(apiUrl, { customHeaders: { [ORIGIN_HEADER]: originSecret }, readTimeout: Duration.seconds(30) });

    const siteBucket = new s3.Bucket(this, 'SiteBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    // The site is a static export with trailing slashes: /homes/ is stored as /homes/index.html.
    const indexPages = new cloudfront.Function(this, 'IndexPages', {
      runtime: cloudfront.FunctionRuntime.JS_2_0,
      code: cloudfront.FunctionCode.fromInline(`
function handler(event) {
  var request = event.request;
  var uri = request.uri;
  if (uri.endsWith('/')) request.uri = uri + 'index.html';
  else if (!uri.split('/').pop().includes('.')) request.uri = uri + '/index.html';
  return request;
}`),
    });

    const apiBehavior: cloudfront.BehaviorOptions = {
      origin: apiOrigin,
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
      allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
      cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
      originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
    };

    const distribution = new cloudfront.Distribution(this, 'Site', {
      comment: 'Alamo City Rental',
      defaultRootObject: 'index.html',
      domainNames: props.domainNames,
      certificate: props.certificateArn ? acm.Certificate.fromCertificateArn(this, 'Certificate', props.certificateArn) : undefined,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      minimumProtocolVersion: props.certificateArn ? cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021 : undefined,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(siteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
        functionAssociations: [{ function: indexPages, eventType: cloudfront.FunctionEventType.VIEWER_REQUEST }],
      },
      additionalBehaviors: { '/api/*': apiBehavior, '/cal/*': apiBehavior },
      errorResponses: [
        { httpStatus: 403, responseHttpStatus: 404, responsePagePath: '/404.html', ttl: Duration.minutes(5) },
        { httpStatus: 404, responseHttpStatus: 404, responsePagePath: '/404.html', ttl: Duration.minutes(5) },
      ],
    });

    // Uploads the built website (web/out) when it exists, and clears CloudFront's cache.
    const webOut = repoPath('web/out');
    if (existsSync(webOut)) {
      new s3deploy.BucketDeployment(this, 'DeployWebsite', {
        sources: [s3deploy.Source.asset(webOut)],
        destinationBucket: siteBucket,
        distribution,
        distributionPaths: ['/*'],
        memoryLimit: 512,
      });
    }

    new CfnOutput(this, 'SiteUrl', { value: `https://${props.domainNames?.[0] ?? distribution.distributionDomainName}` });
    new CfnOutput(this, 'CloudFrontDomain', { value: distribution.distributionDomainName, description: 'Point the domain’s DNS (CNAME or alias) here' });
    new CfnOutput(this, 'StripeWebhookUrl', { value: `https://${props.domainNames?.[0] ?? distribution.distributionDomainName}/api/stripe-webhook` });
    new CfnOutput(this, 'TableName', { value: table.tableName });
  }
}
