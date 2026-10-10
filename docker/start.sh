#!/bin/sh
# Runs Django (internal, 127.0.0.1:8000) and the public Next.js server ($PORT) in one container.
# Next.js serves the pages and proxies /api, /admin, /media, ... to Django.
set -eu

cd /app/backend
python manage.py migrate --noinput
gunicorn personal_blog.wsgi:application \
  --bind 127.0.0.1:8000 \
  --workers "${WEB_CONCURRENCY:-2}" \
  --timeout 60 \
  --access-logfile - &
django_pid=$!

cd /app/frontend
HOSTNAME=0.0.0.0 PORT="${PORT:-10000}" node server.js &
next_pid=$!

stop() {
  kill "$django_pid" "$next_pid" 2>/dev/null || true
}
trap 'stop; exit 0' TERM INT

# If either process exits, stop the other so the platform restarts the container.
while kill -0 "$django_pid" 2>/dev/null && kill -0 "$next_pid" 2>/dev/null; do
  sleep 2
done
echo "A server process exited; shutting down." >&2
stop
wait || true
exit 1
