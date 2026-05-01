"""create cat sightings

Revision ID: 20260429_0001
Revises:
Create Date: 2026-04-29
"""

from typing import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260429_0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "cat_sightings" not in inspector.get_table_names():
        op.create_table(
            "cat_sightings",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("lat", sa.Float(), nullable=False),
            sa.Column("lng", sa.Float(), nullable=False),
            sa.Column("address", sa.String(), nullable=True),
            sa.Column("description", sa.String(), nullable=False),
            sa.Column("cat_name", sa.String(), nullable=True),
            sa.Column("image_url", sa.String(), nullable=True),
            sa.Column("source", sa.String(), nullable=False),
            sa.Column("spotted_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.CheckConstraint("source in ('map','address')", name="cat_sightings_source_check"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_cat_sightings_id"), "cat_sightings", ["id"], unique=False)
        return

    existing_columns = {col["name"] for col in inspector.get_columns("cat_sightings")}
    if "spotted_at" not in existing_columns:
        op.add_column("cat_sightings", sa.Column("spotted_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_index(op.f("ix_cat_sightings_id"), table_name="cat_sightings")
    op.drop_table("cat_sightings")
