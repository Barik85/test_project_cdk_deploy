import { Stack, StackProps, CfnOutput } from 'aws-cdk-lib'
import { Construct } from 'constructs'
import { Bucket } from 'aws-cdk-lib/aws-s3'
import {
  HostedZone,
  IHostedZone,
  ARecord,
  RecordTarget,
  // TxtRecord,
  // CnameRecord,
  // MxRecord,
} from 'aws-cdk-lib/aws-route53'
import {
  Certificate,
  CertificateValidation
} from 'aws-cdk-lib/aws-certificatemanager'
import {
  OriginAccessIdentity,
  CloudFrontWebDistribution,
  PriceClass,
  SecurityPolicyProtocol,
  SSLMethod,
  ViewerProtocolPolicy
} from 'aws-cdk-lib/aws-cloudfront'
import { CloudFrontTarget } from 'aws-cdk-lib/aws-route53-targets'
import {
  CanonicalUserPrincipal,
  CfnAccessKey,
  Effect,
  PolicyStatement,
  User,
  // Group
} from 'aws-cdk-lib/aws-iam'


const generateCertificate = (
  scope: Stack,
  domainName: string,
  routeZone: IHostedZone
): Certificate => {
  return new Certificate(scope, `Certificate-${domainName}`, {
    domainName,
    validation: CertificateValidation.fromDns(routeZone)
  })
}

const domainName = 'develop-everyday.xyz'
const appName = 'TestStack'

export class CdkProjectStack extends Stack {
  constructor (scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props)

    // The code that defines your stack goes here

    // s3 bucket
    const frontendAppBucket = new Bucket(this, 'Test-S3Bucket', {
      bucketName: 'test-v1-s3-bucket'
    })

    // hosted-zone
    const hostedZone = new HostedZone(this, 'MyHostedZone', {
      zoneName: domainName
    })

    // sertificate
    const appCert = generateCertificate(this, domainName, hostedZone)

    // Cloudfront user
    const cfoai = new OriginAccessIdentity(
      this,
      'CloudFrontOriginAccessIdentity',
      {
        comment:
          'Cloudfront user which will be allowed to access the site s3 bucket'
      }
    )

    // add access cloud-front-user to S3 bucket
    frontendAppBucket.addToResourcePolicy(
      new PolicyStatement({
        principals: [
          new CanonicalUserPrincipal(
            cfoai.cloudFrontOriginAccessIdentityS3CanonicalUserId
          )
        ],
        actions: ['s3:List*', 's3:Get*'],
        resources: [`${frontendAppBucket.bucketArn}/*`]
      })
    )

    // creat user for deploy
    const deployUser = new User(this, 'DeployFrontendUser', {
      userName: `${domainName}.AppDeploy.Frontend`
    })

    const accessKey = new CfnAccessKey(this, 'DeployFrontendAccessKey', {
      userName: deployUser.userName
    })

    // grand permissions for S3 bucket
    frontendAppBucket.grantReadWrite(deployUser)

    const cf = new CloudFrontWebDistribution(this, 'JsAppCloudFront', {
      viewerCertificate: {
        props: {
          acmCertificateArn: appCert.certificateArn,
          sslSupportMethod: SSLMethod.SNI,
          minimumProtocolVersion: SecurityPolicyProtocol.TLS_V1_2_2018
        },
        aliases: [domainName]
      },
      originConfigs: [
        {
          s3OriginSource: {
            s3BucketSource: frontendAppBucket,
            originAccessIdentity: cfoai
          },
          behaviors: [{ isDefaultBehavior: true }]
        }
      ],
      errorConfigurations: [
        { errorCode: 403, responseCode: 200, responsePagePath: '/index.html' },
        { errorCode: 404, responseCode: 200, responsePagePath: '/index.html' },
        { errorCode: 500, responseCode: 200, responsePagePath: '/index.html' }
      ],
      viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      priceClass: PriceClass.PRICE_CLASS_ALL
    })

    deployUser.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
          'cloudfront:GetInvalidation',
          'cloudfront:CreateInvalidation',
        ],
        resources: [
          `arn:aws:cloudfront::${process?.env?.account}:distribution/${cf.distributionId}`,
        ],
      })
    );

    new ARecord(this, 'AppDNS', {
      recordName: domainName,
      zone: hostedZone,
      target: RecordTarget.fromAlias(new CloudFrontTarget(cf)),
    });

    new CfnOutput(this, 'FrontendAppBucket', {
      description: 'Js App Bucket name',
      value: frontendAppBucket.bucketName,
      exportName: `${appName}AppBucket`,
    });

    new CfnOutput(this, `${appName}AppCloudFrontDistributionID`, {
      description: 'CloudFront Distribution ID',
      value: cf.distributionId,
      exportName: `${appName}AppCloudFrontDistributionID`,
    });

    new CfnOutput(this, 'DomainApp', {
      description: 'App domain',
      value: domainName,
      exportName: `${appName}App`,
    });

    new CfnOutput(this, `${appName}AppCertARN`, {
      description: 'App Certificate ARN',
      value: appCert.certificateArn,
      exportName: `${appName}AppCertARN`,
    });

    new CfnOutput(this, `${appName}AppDeployUserARN`, {
      description: 'Deploy frontend user ARN',
      value: deployUser.userArn,
      exportName: `${appName}AppDeployUserARN`,
    });

    new CfnOutput(this, 'DeployFrontendAccessKeyId', { value: accessKey.ref });

    new CfnOutput(this, 'DeployFrontendSecretAccessKey', {
      value: accessKey.attrSecretAccessKey,
    });
  }
}
