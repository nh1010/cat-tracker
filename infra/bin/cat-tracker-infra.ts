#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";

import { CatTrackerWebStack } from "../lib/cat-tracker-web-stack";

const app = new cdk.App();

new CatTrackerWebStack(app, "CatTrackerWebStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || "us-east-1",
  },
  domainName: app.node.tryGetContext("domainName") ?? "cattracker.nyc",
});
