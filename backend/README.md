# NYC Cat Tracker - Backend

FastAPI backend for tracking stray cat sightings in NYC.

## Setup

### Local Development with Docker

1. Start the backend:
```bash
cd backend
docker compose up
```

This will start:
- FastAPI backend on port 5050
- SQLite database persisted at `./data/cat.db`
- Local uploads persisted at `./uploads` when S3 is not configured

### SQLite Configuration

SQLite is the default database. Set `SQLITE_DB_PATH` for production so the file lives on persistent disk:

```bash
SQLITE_DB_PATH=/app/data/cat.db
```

You can also set a full SQLAlchemy URL:

```bash
DATABASE_URL=sqlite:////app/data/cat.db
```

Back up the SQLite file regularly. For a live deployment, schedule a copy of the database file from the persistent disk to S3 or another backup target.

### S3 Image Upload Configuration

Production uploads should use S3 so images survive deploys and can be served through CloudFront. To enable:

1. Deploy the CDK app in `../infra`.
2. Copy the CDK outputs into Railway/backend env vars.
3. Create or attach AWS credentials with `s3:PutObject` permission for the media bucket.
4. Add to `.env`:
```bash
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_key_here
AWS_SECRET_ACCESS_KEY=your_secret_here
S3_BUCKET=cdk_output_MediaBucketName
S3_UPLOAD_PREFIX=uploads
S3_PUBLIC_BASE_URL=cdk_output_MediaPublicBaseUrl
MAX_UPLOAD_MB=10
MAX_IMAGE_PIXELS=20000000
```

If `S3_BUCKET` is not provided, uploads fall back to local storage in `UPLOAD_DIR`. Use that only for local development.
Uploaded images are decoded and re-encoded before storage to strip metadata and reject malformed files.

### Manual Setup (without Docker)

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Set up your environment variables in `.env`:
```bash
SQLITE_DB_PATH=data/cat.db
PORT=5000
CORS_ORIGINS=http://localhost:5173
ADMIN_API_KEY=change_me_for_reports
```

3. Run the development server:
```bash
alembic upgrade head
python main.py
```

Docker runs `alembic upgrade head` automatically before starting the API.

### CAPTCHA Configuration

For production, enable Cloudflare Turnstile to reduce automated spam:

```bash
CAPTCHA_REQUIRED=true
TURNSTILE_SECRET_KEY=your_turnstile_secret_key
```

Set `VITE_TURNSTILE_SITE_KEY` in the frontend build environment. When configured, `POST /api/cats` and `POST /api/upload` require the frontend to send `X-Captcha-Token`.

### Reports Admin Access

Reports endpoints are protected with an admin key:

```bash
ADMIN_API_KEY=use_a_long_random_value
```

Clients must send this as `X-Admin-Key`. The frontend reports page prompts for the key at runtime and stores it in session storage, so it is not embedded in the public build.

### Railway Deployment

Railway should use the included `Dockerfile` and `railway.json`. Recommended Railway setup:

1. Create a Railway service from the monorepo and set the service root directory to `backend`.
2. Add a persistent volume mounted at `/app/data`.
3. Set `APP_ENV=production`.
4. Set `SQLITE_DB_PATH=/app/data/cat.db`.
5. Set `PORT` if Railway does not inject it automatically.
6. Set `CORS_ORIGINS=https://cattracker.nyc`.
7. Set S3 upload variables from CDK outputs for production image storage.
8. Set `CAPTCHA_REQUIRED=true` and `TURNSTILE_SECRET_KEY`.
9. Set `ADMIN_API_KEY` to a long random value.
10. Set `TRUST_PROXY_HEADERS=true` only if requests can reach the API only through Railway's trusted proxy.

Expected cost for this small backend is usually around the Railway Hobby floor: about `$5/month` if compute, egress, and volume usage fit inside the included credits. Railway volume storage is inexpensive, but it is billed continuously while provisioned.

## API Endpoints

### Cat Sightings
- `GET /api/cats` - Get all cat sightings
- `POST /api/cats` - Create a new cat sighting
- `GET /api/cats/{id}` - Get a specific cat sighting
- `GET /api/cats/recent-with-images` - Get 10 most recent sightings with images

### Uploads
- `POST /api/upload` - Upload an image (returns image URL)

### Reports
- `GET /api/reports/summary` - Get summary statistics; requires `X-Admin-Key`
- `GET /api/reports/export` - Export sightings as CSV; requires `X-Admin-Key`

### Health
- `GET /` - API info
- `GET /api/health` - Health check

## API Documentation

Once running, visit:
- Swagger UI: http://localhost:5050/docs with Docker Compose
- ReDoc: http://localhost:5050/redoc with Docker Compose

## Database Schema

### cat_sightings
- `id` (Integer, Primary Key)
- `lat` (Float, required)
- `lng` (Float, required)
- `description` (String, required)
- `cat_name` (String, optional)
- `address` (String, optional)
- `image_url` (String, optional)
- `source` (String, default: "map")
- `spotted_at` (DateTime with timezone, defaults to now)
- `created_at` (DateTime with timezone, auto)
- `updated_at` (DateTime with timezone, auto)

## Production Notes

- Set `CORS_ORIGINS=https://cattracker.nyc`.
- Set `APP_ENV=production`; startup will fail if CAPTCHA or report admin config is missing.
- Keep the SQLite file on persistent disk; do not store the active SQLite database on S3.
- Run Alembic migrations during deploys. The Dockerfile already runs `alembic upgrade head`.
- Configure `WRITE_RATE_LIMIT`, `UPLOAD_RATE_LIMIT`, and `EXPORT_RATE_LIMIT` for the expected traffic level.
- Enable `CAPTCHA_REQUIRED=true` for public production submissions.
- Use `TRUST_PROXY_HEADERS=true` only behind a trusted proxy. Otherwise IP rate limiting uses the direct client socket.
- CSV exports escape user-controlled cells that could be interpreted as spreadsheet formulas.
- Run only the API publicly. Do not expose local development volumes or admin tools.

