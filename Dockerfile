# syntax=docker/dockerfile:1

# --- 1. Build the Next.js frontend (standalone output) ---
FROM node:22-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# --- 2. Runtime: Django (gunicorn, internal) + Next.js (public) in one container ---
FROM python:3.12-slim AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    BACKEND_URL=http://127.0.0.1:8000 \
    DJANGO_SECURE_SSL_REDIRECT=False \
    PORT=10000

# Node runtime for the Next.js server (same Debian base as python:3.12-slim).
COPY --from=frontend /usr/local/bin/node /usr/local/bin/node

WORKDIR /app
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY backend/ backend/
RUN DJANGO_SECRET_KEY=collectstatic-only python backend/manage.py collectstatic --noinput

COPY --from=frontend /app/frontend/.next/standalone frontend/
COPY --from=frontend /app/frontend/.next/static frontend/.next/static
COPY --from=frontend /app/frontend/public frontend/public
COPY docker/start.sh /app/start.sh

RUN useradd --create-home app && mkdir -p backend/media && chown -R app /app/backend
USER app

EXPOSE 10000
CMD ["/app/start.sh"]
