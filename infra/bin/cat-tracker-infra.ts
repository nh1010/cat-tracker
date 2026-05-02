#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";

import { CatTrackerWebStack } from "../lib/cat-tracker-web-stack";

const app = new cdk.App();
const account = process.env.CDK_DEFAULT_ACCOUNT ?? process.env.AWS_ACCOUNT_ID;

new CatTrackerWebStack(app, "CatTrackerWebStack", {
  env: {
    account,
    region: "us-east-1",
  },
  domainName: app.node.tryGetContext("domainName") ?? "cattracker.nyc",
});
