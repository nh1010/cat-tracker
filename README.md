# NYC Cat Tracker

Monorepo for the NYC Cat Tracker app.

## Structure

- `frontend/` - Vite + React static site deployed to `https://cattracker.nyc`
- `backend/` - FastAPI API, currently deployed separately on Railway
- `infra/` - AWS CDK app for S3, CloudFront, Route 53, ACM, and media storage

## Common Commands

Install JavaScript workspace dependencies from the repository root:

```bash
npm install
```

Run the frontend locally:

```bash
npm run frontend:dev
```

Build and lint the frontend:

```bash
npm run frontend:lint
npm run frontend:build
```

Synthesize or deploy the AWS infrastructure:

```bash
npm run infra:synth
npm run infra:deploy -- --parameters HostedZoneId=YOUR_ROUTE53_HOSTED_ZONE_ID
```

The frontend build uses public `VITE_*` values at build time. Set production values before running `npm run frontend:build` for deployment.
