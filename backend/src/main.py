import io
import csv
import logging
import os
from datetime import date, datetime, timedelta, timezone
from typing import Dict, Optional

from fastapi import Depends, FastAPI, File, HTTPException, Query, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import func, text as sql_text
from sqlalchemy.orm import Session

from .config import load_settings
from .database import DATABASE_URL, get_db
from .models import CatSighting as CatSightingModel
from .rate_limit import FixedWindowRateLimiter
from .schemas import CatSightingCreate, CatSightingResponse, ReportsSummaryResponse
from .security import csv_safe_text, verify_admin_key, verify_captcha
from .storage import store_upload

app = FastAPI(title="NYC Cat Tracker API")
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("cat-api")
settings = load_settings()
rate_limiter = FixedWindowRateLimiter(settings.rate_limit_window_seconds)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=settings.cors_allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")


@app.get("/")
def read_root():
    return {"message": "NYC Cat Tracker API", "version": "1.0.0", "database": DATABASE_URL.split(":", 1)[0]}

@app.get("/api/health")
def health(db: Session = Depends(get_db)):
    db.execute(sql_text("SELECT 1"))
    return {"ok": True}

@app.get("/api/cats", response_model=list[CatSightingResponse])
def get_cat_sightings(db: Session = Depends(get_db)):
    rows = db.query(CatSightingModel).order_by(CatSightingModel.created_at.desc()).all()
    return rows

@app.post("/api/cats", response_model=CatSightingResponse, status_code=201)
async def create_cat_sighting(sighting: CatSightingCreate, request: Request, db: Session = Depends(get_db)):
    rate_limiter.check(
        request,
        "create_cat_sighting",
        settings.write_rate_limit,
        trust_proxy_headers=settings.trust_proxy_headers,
    )
    await verify_captcha(request, settings)
    spotted_at = sighting.spotted_at or datetime.now(timezone.utc)

    row = CatSightingModel(
        lat=sighting.lat,
        lng=sighting.lng,
        address=sighting.address,
        description=sighting.description,
        cat_name=sighting.cat_name,
        image_url=sighting.image_url,
        source=sighting.source,
        spotted_at=spotted_at,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row

@app.get("/api/cats/recent-with-images", response_model=list[CatSightingResponse])
def get_recent_cats_with_images(db: Session = Depends(get_db)):
    rows = (
        db.query(CatSightingModel)
        .filter(CatSightingModel.image_url.isnot(None))
        .order_by(CatSightingModel.created_at.desc())
        .limit(10)
        .all()
    )
    return rows

@app.get("/api/cats/{sighting_id}", response_model=CatSightingResponse)
def get_cat_sighting(sighting_id: int, db: Session = Depends(get_db)):
    row = db.query(CatSightingModel).filter(CatSightingModel.id == sighting_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Cat sighting not found")
    return row

@app.post("/api/upload")
async def upload_image(request: Request, file: UploadFile = File(...)):
    rate_limiter.check(
        request,
        "upload_image",
        settings.upload_rate_limit,
        trust_proxy_headers=settings.trust_proxy_headers,
    )
    await verify_captcha(request, settings)
    return {"url": await store_upload(file, settings)}

def _parse_date_range(start: Optional[str], end: Optional[str]) -> tuple[datetime, datetime]:
    """Parse ISO date strings into inclusive UTC datetime bounds."""
    now = datetime.now(timezone.utc)
    if not end:
        end_dt = now
    else:
        end_date = date.fromisoformat(end)
        end_dt = datetime(end_date.year, end_date.month, end_date.day, 23, 59, 59, 999999, tzinfo=timezone.utc)
    if not start:
        start_dt = end_dt - timedelta(days=29)
        start_dt = start_dt.replace(hour=0, minute=0, second=0, microsecond=0)
    else:
        start_date = date.fromisoformat(start)
        start_dt = datetime(start_date.year, start_date.month, start_date.day, tzinfo=timezone.utc)
    return start_dt, end_dt

@app.get("/api/reports/summary", response_model=ReportsSummaryResponse)
def get_reports_summary(
    request: Request,
    start: Optional[str] = Query(None, description="Start date YYYY-MM-DD"),
    end: Optional[str] = Query(None, description="End date YYYY-MM-DD"),
    db: Session = Depends(get_db),
):
    verify_admin_key(request, settings)
    start_dt, end_dt = _parse_date_range(start, end)

    base_q = db.query(CatSightingModel).filter(
        CatSightingModel.created_at >= start_dt,
        CatSightingModel.created_at <= end_dt,
    )

    total = base_q.count()

    # by source
    src_rows = (
        db.query(CatSightingModel.source, func.count(CatSightingModel.id))
        .filter(
            CatSightingModel.created_at >= start_dt,
            CatSightingModel.created_at <= end_dt,
        )
        .group_by(CatSightingModel.source)
        .all()
    )
    by_source: Dict[str, int] = {s or "unknown": c for s, c in src_rows}

    # per day counts (using date(created_at))
    day_rows = (
        db.query(func.date(CatSightingModel.created_at), func.count(CatSightingModel.id))
        .filter(
            CatSightingModel.created_at >= start_dt,
            CatSightingModel.created_at <= end_dt,
        )
        .group_by(func.date(CatSightingModel.created_at))
        .order_by(func.date(CatSightingModel.created_at))
        .all()
    )
    per_day = [
        {"date": str(d), "count": count}
        for d, count in day_rows
    ]

    return ReportsSummaryResponse(
        total=total,
        by_source=by_source,
        per_day=per_day,
        start=start_dt,
        end=end_dt,
    )

@app.get("/api/reports/export")
def export_reports_csv(
    request: Request,
    start: Optional[str] = Query(None, description="Start date YYYY-MM-DD"),
    end: Optional[str] = Query(None, description="End date YYYY-MM-DD"),
    db: Session = Depends(get_db),
):
    verify_admin_key(request, settings)
    rate_limiter.check(
        request,
        "export_reports_csv",
        settings.export_rate_limit,
        trust_proxy_headers=settings.trust_proxy_headers,
    )
    start_dt, end_dt = _parse_date_range(start, end)

    rows: list[CatSightingModel] = (
        db.query(CatSightingModel)
        .filter(
            CatSightingModel.created_at >= start_dt,
            CatSightingModel.created_at <= end_dt,
        )
        .order_by(CatSightingModel.created_at.desc())
        .all()
    )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "id",
        "lat",
        "lng",
        "address",
        "description",
        "cat_name",
        "image_url",
        "source",
        "spotted_at",
        "created_at",
        "updated_at",
    ])
    for r in rows:
        writer.writerow([
            r.id,
            r.lat,
            r.lng,
            csv_safe_text(r.address),
            csv_safe_text(r.description),
            csv_safe_text(r.cat_name),
            csv_safe_text(r.image_url),
            csv_safe_text(r.source),
            r.spotted_at.isoformat() if getattr(r, "spotted_at", None) else "",
            r.created_at.isoformat() if r.created_at else "",
            r.updated_at.isoformat() if r.updated_at else "",
        ])

    output.seek(0)
    filename = f"cat_sightings_{start_dt.date()}_to_{end_dt.date()}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename={filename}",
        },
    )

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 5000))
    uvicorn.run("src.main:app", host="0.0.0.0", port=port, reload=True)
