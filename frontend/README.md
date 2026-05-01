# NYC Cat Tracker - Frontend

Vite + React frontend for the NYC Cat Tracker.

## Local Development

From the monorepo root:

```bash
npm run frontend:dev
```

Or from this directory:

```bash
npm run dev
```

The Vite dev server usually runs at `http://localhost:5173`.

Copy `.env.example` to `.env` and set:

```bash
VITE_API_URL=http://localhost:5050
VITE_MAPBOX_TOKEN=your_mapbox_public_token
VITE_BOROUGHS_GEOJSON_URL=/boroughs.geojson
VITE_TURNSTILE_SITE_KEY=
```

`VITE_*` values are embedded at build time, so production values must be present when building the static bundle.

## Build

From the monorepo root:

```bash
npm run frontend:build
```

Or from this directory:

```bash
npm run build
```

The production output is written to `dist/`.

## CDK Deployment

The `infra/` CDK app deploys the production frontend to `https://cattracker.nyc` with S3, CloudFront, ACM, and Route 53.

1. Set production `VITE_*` values in this build environment.
2. Run `npm run frontend:build` from the monorepo root.
3. Run `npm run infra:deploy -- --parameters HostedZoneId=YOUR_ROUTE53_HOSTED_ZONE_ID`.
4. Restrict the Mapbox public token to `cattracker.nyc` in the Mapbox dashboard.
5. If backend CAPTCHA is enabled, set `VITE_TURNSTILE_SITE_KEY` before building.

Deep links like `/sightings/123` require the CloudFront fallback to `index.html`.

The reports page prompts for the backend `ADMIN_API_KEY` at runtime. Do not add that key to `VITE_*` environment variables because Vite embeds them in the public bundle.
