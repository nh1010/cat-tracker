# syntax=docker/dockerfile:1

############################
# Base image with deps
############################
FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Install Python deps
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

############################
# Development image (reload)
############################
FROM base AS dev
ENV APP_ENV=development \
    PORT=5000 \
    SQLITE_DB_PATH=/app/data/cat.db
COPY src /app/src
COPY main.py /app/main.py
COPY alembic.ini /app/alembic.ini
COPY alembic /app/alembic
RUN mkdir -p /app/data /app/uploads
EXPOSE 5000
CMD ["sh", "-c", "alembic upgrade head && python main.py"]

############################
# Production image
############################
FROM base AS prod
ENV APP_ENV=production \
    PORT=5000 \
    SQLITE_DB_PATH=/app/data/cat.db
COPY src /app/src
COPY main.py /app/main.py
COPY alembic.ini /app/alembic.ini
COPY alembic /app/alembic
RUN mkdir -p /app/data /app/uploads
EXPOSE 5000
CMD ["sh", "-c", "alembic upgrade head && uvicorn src.main:app --host 0.0.0.0 --port ${PORT:-5000}"]
