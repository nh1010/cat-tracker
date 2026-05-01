import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv
from PIL import Image

load_dotenv()


def csv_env(name: str, default: str) -> list[str]:
    return [item.strip() for item in os.getenv(name, default).split(",") if item.strip()]


def bool_env(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


PORT = int(os.getenv("PORT", "5000"))
DEFAULT_SQLITE_PATH = Path(os.getenv("SQLITE_DB_PATH", "data/cat.db"))
DATABASE_URL = os.getenv("DATABASE_URL") or f"sqlite:///{DEFAULT_SQLITE_PATH}"


@dataclass(frozen=True)
class Settings:
    app_env: str
    cors_origins: list[str]
    cors_allow_credentials: bool
    upload_dir: str
    max_upload_mb: int
    max_upload_bytes: int
    max_image_pixels: int
    s3_bucket: str | None
    s3_upload_prefix: str
    s3_public_base_url: str
    aws_region: str | None
    rate_limit_window_seconds: int
    write_rate_limit: int
    upload_rate_limit: int
    export_rate_limit: int
    captcha_required: bool
    turnstile_secret_key: str | None
    admin_api_key: str | None
    trust_proxy_headers: bool


def load_settings() -> Settings:
    max_upload_mb = int(os.getenv("MAX_UPLOAD_MB", "10"))
    max_image_pixels = int(os.getenv("MAX_IMAGE_PIXELS", "20000000"))
    settings = Settings(
        app_env=os.getenv("APP_ENV", "development").strip().lower(),
        cors_origins=csv_env("CORS_ORIGINS", "http://localhost:3000,http://localhost:5173"),
        cors_allow_credentials=bool_env("CORS_ALLOW_CREDENTIALS", False),
        upload_dir=os.getenv("UPLOAD_DIR", "uploads"),
        max_upload_mb=max_upload_mb,
        max_upload_bytes=max_upload_mb * 1024 * 1024,
        max_image_pixels=max_image_pixels,
        s3_bucket=os.getenv("S3_BUCKET") or None,
        s3_upload_prefix=os.getenv("S3_UPLOAD_PREFIX", "uploads").strip("/"),
        s3_public_base_url=os.getenv("S3_PUBLIC_BASE_URL", "").rstrip("/"),
        aws_region=os.getenv("AWS_REGION") or None,
        rate_limit_window_seconds=int(os.getenv("RATE_LIMIT_WINDOW_SECONDS", "60")),
        write_rate_limit=int(os.getenv("WRITE_RATE_LIMIT", "20")),
        upload_rate_limit=int(os.getenv("UPLOAD_RATE_LIMIT", "10")),
        export_rate_limit=int(os.getenv("EXPORT_RATE_LIMIT", "10")),
        captcha_required=bool_env("CAPTCHA_REQUIRED", False),
        turnstile_secret_key=os.getenv("TURNSTILE_SECRET_KEY") or None,
        admin_api_key=os.getenv("ADMIN_API_KEY") or None,
        trust_proxy_headers=bool_env("TRUST_PROXY_HEADERS", False),
    )

    if settings.app_env == "production":
        if not settings.captcha_required:
            raise RuntimeError("CAPTCHA_REQUIRED=true is required in production")
        if not settings.turnstile_secret_key:
            raise RuntimeError("TURNSTILE_SECRET_KEY is required in production")
        if not settings.admin_api_key:
            raise RuntimeError("ADMIN_API_KEY is required in production")
        if any(origin == "*" for origin in settings.cors_origins):
            raise RuntimeError("Wildcard CORS origins are not allowed in production")

    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
    Image.MAX_IMAGE_PIXELS = settings.max_image_pixels
    return settings
