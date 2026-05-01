from datetime import datetime, timezone

from sqlalchemy import CheckConstraint, Column, DateTime, Float, Integer, String

from .database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)

class CatSighting(Base):
    __tablename__ = "cat_sightings"

    id = Column(Integer, primary_key=True, index=True)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    address = Column(String, nullable=True)
    description = Column(String, nullable=False)
    cat_name = Column(String, nullable=True)
    image_url = Column(String, nullable=True)
    source = Column(String, nullable=False, default="map")  # 'map' | 'address'
    spotted_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    __table_args__ = (
        CheckConstraint("source in ('map','address')", name="cat_sightings_source_check"),
    )

