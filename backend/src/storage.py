import io
import logging
import pathlib
import uuid

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import HTTPException, UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError

from .config import Settings

logger = logging.getLogger("cat-api")

ALLOWED_IMAGE_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
}


async def store_upload(file: UploadFile, settings: Settings) -> str:
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image uploads are allowed")

    data = await _read_limited_upload(file, settings.max_upload_bytes, settings.max_upload_mb)
    if not _sniff_image_type(data):
        raise HTTPException(status_code=400, detail="Unsupported or invalid image file")
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported image type")

    data, content_type, ext = _normalize_image_upload(data)
    name = f"{uuid.uuid4().hex}{ext}"
    key = f"{settings.s3_upload_prefix}/{name}" if settings.s3_upload_prefix else name

    if settings.s3_bucket:
        return _upload_to_s3(key, data, content_type, settings)

    dest_path = pathlib.Path(settings.upload_dir) / name
    dest_path.write_bytes(data)
    return _public_upload_url(name, settings)


async def _read_limited_upload(file: UploadFile, max_bytes: int, max_mb: int) -> bytes:
    chunks: list[bytes] = []
    total = 0
    try:
        while True:
            chunk = await file.read(1024 * 1024)
            if not chunk:
                break
            total += len(chunk)
            if total > max_bytes:
                raise HTTPException(status_code=413, detail=f"Upload exceeds {max_mb} MB")
            chunks.append(chunk)
    finally:
        await file.close()
    return b"".join(chunks)


def _sniff_image_type(data: bytes) -> tuple[str, str] | None:
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg", ".jpg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png", ".png"
    if data.startswith(b"GIF87a") or data.startswith(b"GIF89a"):
        return "image/gif", ".gif"
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp", ".webp"
    return None


def _normalize_image_upload(data: bytes) -> tuple[bytes, str, str]:
    try:
        with Image.open(io.BytesIO(data)) as image:
            image.load()
            image = ImageOps.exif_transpose(image)
            has_alpha = image.mode in {"RGBA", "LA"} or "transparency" in image.info

            output = io.BytesIO()
            if image.format == "WEBP":
                normalized = image.convert("RGBA" if has_alpha else "RGB")
                normalized.save(output, format="WEBP", quality=85, method=6)
                return output.getvalue(), "image/webp", ".webp"

            if image.format in {"PNG", "GIF"} or has_alpha:
                normalized = image.convert("RGBA" if has_alpha else "RGB")
                normalized.save(output, format="PNG", optimize=True)
                return output.getvalue(), "image/png", ".png"

            normalized = image.convert("RGB")
            normalized.save(output, format="JPEG", quality=85, optimize=True)
            return output.getvalue(), "image/jpeg", ".jpg"
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="Unsupported or invalid image file") from exc


def _public_upload_url(key: str, settings: Settings) -> str:
    if settings.s3_public_base_url:
        return f"{settings.s3_public_base_url}/{key}"
    if settings.s3_bucket:
        region_part = f".s3.{settings.aws_region}" if settings.aws_region else ".s3"
        return f"https://{settings.s3_bucket}{region_part}.amazonaws.com/{key}"
    return f"/uploads/{pathlib.Path(key).name}"


def _upload_to_s3(key: str, data: bytes, content_type: str, settings: Settings) -> str:
    client = boto3.client("s3", region_name=settings.aws_region)
    try:
        client.put_object(
            Bucket=settings.s3_bucket,
            Key=key,
            Body=data,
            ContentType=content_type,
        )
    except (BotoCoreError, ClientError) as exc:
        logger.exception("S3 upload failed")
        raise HTTPException(status_code=502, detail="Image storage failed") from exc
    return _public_upload_url(key, settings)
