from datetime import date, datetime, timezone
from typing import Any, Dict, Literal, Optional

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, field_validator


class CatSightingCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    lat: float = Field(ge=40.477399, le=40.917577)
    lng: float = Field(ge=-74.25909, le=-73.700272)
    address: Optional[str] = None
    description: str = Field(min_length=1, max_length=2000)
    cat_name: Optional[str] = Field(default=None, validation_alias=AliasChoices("cat_name", "catName"))
    image_url: Optional[str] = Field(default=None, validation_alias=AliasChoices("image_url", "imageUrl"))
    source: Literal["map", "address"] = "map"
    spotted_at: Optional[datetime] = Field(default=None, validation_alias=AliasChoices("spotted_at", "spottedAt"))
    turnstile_token: Optional[str] = Field(default=None, validation_alias=AliasChoices("turnstile_token", "turnstileToken"))

    @field_validator("spotted_at", mode="before")
    @classmethod
    def _parse_spotted_at(cls, v: Optional[object]) -> Optional[datetime]:
        if v is None:
            return None
        if isinstance(v, datetime):
            return v if v.tzinfo else v.replace(tzinfo=timezone.utc)
        if isinstance(v, (int, float)):
            try:
                return datetime.fromtimestamp(float(v), tz=timezone.utc)
            except Exception:
                return None
        if isinstance(v, str):
            s = v.strip()
            if not s:
                return None
            if s.endswith("Z"):
                s = s[:-1] + "+00:00"
            try:
                dt = datetime.fromisoformat(s)
                return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
            except Exception:
                pass
            try:
                d = date.fromisoformat(s)
                return datetime(d.year, d.month, d.day, 12, 0, tzinfo=timezone.utc)
            except Exception:
                return None
        return None


class CatSightingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    lat: float
    lng: float
    address: Optional[str] = None
    description: Optional[str] = None
    cat_name: Optional[str] = None
    image_url: Optional[str] = None
    source: str
    spotted_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class ReportsSummaryResponse(BaseModel):
    total: int
    by_source: Dict[str, int]
    per_day: list[Dict[str, Any]]
    start: datetime
    end: datetime
