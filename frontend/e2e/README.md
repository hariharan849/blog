# End-to-end tests

The tests drive a real browser against a running site seeded with demo data.

```bash
# 1. Start the site, e.g. the production image:
docker build -t pychanter . && docker run -d --name pychanter -p 10000:10000 \
  -e DJANGO_SECRET_KEY=dev -e DJANGO_ALLOWED_HOST=localhost -e SITE_URL=http://localhost:10000 pychanter
docker exec pychanter sh -c "cd /app/backend && python manage.py seed_demo --force --password demo-Pass-2026"

# 2. Run the tests
cd frontend
E2E_BASE_URL=http://localhost:10000 E2E_PASSWORD=demo-Pass-2026 npm run test:e2e
```

With the dev servers instead: run `python manage.py seed_demo --password demo-Pass-2026` in
`backend/` and use `E2E_BASE_URL=http://localhost:3000`.
