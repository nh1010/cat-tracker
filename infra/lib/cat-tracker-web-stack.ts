import * as path from "path";

import * as cdk from "aws-cdk-lib";
import { Duration, RemovalPolicy, Stack, StackProps } from "aws-cdk-lib";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as targets from "aws-cdk-lib/aws-route53-targets";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import { Construct } from "constructs";

interface CatTrackerWebStackProps extends StackProps {
  domainName: string;
}

export class CatTrackerWebStack extends Stack {
  constructor(scope: Construct, id: string, props: CatTrackerWebStackProps) {
    super(scope, id, props);

    const wwwDomainName = `www.${props.domainName}`;
    const hostedZone = route53.HostedZone.fromLookup(this, "HostedZone", {
      domainName: props.domainName,
    });

    const certificate = new acm.Certificate(this, "SiteCertificate", {
      domainName: props.domainName,
      subjectAlternativeNames: [wwwDomainName],
      validation: acm.CertificateValidation.fromDns(hostedZone),
    });

    const frontendBucket = new s3.Bucket(this, "FrontendBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    const mediaBucket = new s3.Bucket(this, "MediaBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.HEAD],
          allowedOrigins: [`https://${props.domainName}`, `https://${wwwDomainName}`],
          allowedHeaders: ["*"],
          maxAge: 3000,
        },
      ],
      removalPolicy: RemovalPolicy.RETAIN,
    });

    const frontendOrigin = origins.S3BucketOrigin.withOriginAccessControl(frontendBucket);
    const mediaOrigin = origins.S3BucketOrigin.withOriginAccessControl(mediaBucket);

    const siteDistribution = new cloudfront.Distribution(this, "SiteDistribution", {
      certificate,
      domainNames: [props.domainName],
      defaultRootObject: "index.html",
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      defaultBehavior: {
        origin: frontendOrigin,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
        compress: true,
      },
      additionalBehaviors: {
        "assets/*": {
          origin: frontendOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
          cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          compress: true,
        },
      },
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
          ttl: Duration.minutes(5),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
          ttl: Duration.minutes(5),
        },
      ],
    });

    const wwwRedirectFunction = new cloudfront.Function(this, "WwwRedirectFunction", {
      code: cloudfront.FunctionCode.fromInline(`
function handler(event) {
  var request = event.request;
  return {
    statusCode: 301,
    statusDescription: 'Moved Permanently',
    headers: {
      location: { value: 'https://${props.domainName}' + request.uri }
    }
  };
}
`),
    });

    const wwwRedirectDistribution = new cloudfront.Distribution(this, "WwwRedirectDistribution", {
      certificate,
      domainNames: [wwwDomainName],
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      defaultBehavior: {
        origin: frontendOrigin,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        functionAssociations: [
          {
            eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
            function: wwwRedirectFunction,
          },
        ],
      },
    });

    const mediaDistribution = new cloudfront.Distribution(this, "MediaDistribution", {
      defaultBehavior: {
        origin: mediaOrigin,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        compress: true,
      },
    });

    new route53.ARecord(this, "SiteAliasRecord", {
      zone: hostedZone,
      recordName: props.domainName,
      target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(siteDistribution)),
    });

    new route53.AaaaRecord(this, "SiteIpv6AliasRecord", {
      zone: hostedZone,
      recordName: props.domainName,
      target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(siteDistribution)),
    });

    new route53.ARecord(this, "WwwAliasRecord", {
      zone: hostedZone,
      recordName: "www",
      target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(wwwRedirectDistribution)),
    });

    new route53.AaaaRecord(this, "WwwIpv6AliasRecord", {
      zone: hostedZone,
      recordName: "www",
      target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(wwwRedirectDistribution)),
    });

    new s3deploy.BucketDeployment(this, "DeployFrontend", {
      sources: [s3deploy.Source.asset(path.join(__dirname, "..", "..", "frontend", "dist"))],
      destinationBucket: frontendBucket,
      distribution: siteDistribution,
      distributionPaths: ["/*"],
      prune: true,
    });

    new cdk.CfnOutput(this, "SiteUrl", {
      value: `https://${props.domainName}`,
    });

    new cdk.CfnOutput(this, "FrontendBucketName", {
      value: frontendBucket.bucketName,
    });

    new cdk.CfnOutput(this, "SiteDistributionId", {
      value: siteDistribution.distributionId,
    });

    new cdk.CfnOutput(this, "MediaBucketName", {
      value: mediaBucket.bucketName,
    });

    new cdk.CfnOutput(this, "MediaPublicBaseUrl", {
      value: `https://${mediaDistribution.distributionDomainName}`,
    });

    new cdk.CfnOutput(this, "MediaDistributionId", {
      value: mediaDistribution.distributionId,
    });

    new cdk.CfnOutput(this, "BackendAwsRegion", {
      value: this.region,
    });
  }
}
