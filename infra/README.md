# Cat Tracker Infrastructure

AWS CDK app for the production frontend and media upload storage.

## What It Deploys

- Private S3 bucket for the Vite frontend build.
- CloudFront distribution for `https://cattracker.nyc`.
- ACM certificate for `cattracker.nyc` and `www.cattracker.nyc`.
- Route 53 A/AAAA alias records for the apex domain and `www`.
- CloudFront Function redirect from `www.cattracker.nyc` to `cattracker.nyc`.
- SPA fallback responses for `403` and `404` to `/index.html`.
- Private S3 bucket for backend image uploads.
- CloudFront media distribution for public image URLs.

## Prerequisites

- AWS credentials configured for the target account.
- CDK bootstrapped in `us-east-1`.
- A Route 53 hosted zone for `cattracker.nyc`.
- The frontend built at `frontend/dist`.

## Commands

From the monorepo root:

```bash
npm install
export AWS_ACCOUNT_ID=YOUR_AWS_ACCOUNT_ID
npm run infra:bootstrap
npm run frontend:build
npm run infra:synth
cdk deploy
```

The stack looks up the `cattracker.nyc` hosted zone in Route 53 during synth/deploy. It deploys in `us-east-1` because CloudFront requires ACM certificates in that region.

## Frontend Build-Time Values

Set production frontend values before `npm run frontend:build`:

```bash
VITE_API_URL=https://your-railway-api.example.com
VITE_MAPBOX_TOKEN=your_mapbox_public_token
VITE_BOROUGHS_GEOJSON_URL=/boroughs.geojson
VITE_TURNSTILE_SITE_KEY=your_turnstile_site_key
```

These values are embedded in the static bundle.

## Railway Backend Outputs

After deploy, copy these CDK outputs into Railway:

- `MediaBucketName` -> `S3_BUCKET`
- `MediaPublicBaseUrl` -> `S3_PUBLIC_BASE_URL`
- `BackendAwsRegion` -> `AWS_REGION`

Railway also needs AWS credentials that can write objects to the media bucket. Keep those credentials out of the frontend build.
