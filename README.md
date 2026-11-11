# Hariharan Manoharan: portfolio, blog & Daily Dose

| Folder | What | Stack |
|---|---|---|
| [`frontend/`](frontend/README.md) | Portfolio, Markdown blog, Daily Dose pages, admin | Next.js 15, TypeScript, NextAuth (GitHub) → Vercel |
| [`backend/`](backend/README.md) | Nightly feed collector, email digest, API | Python 3.12, AWS Lambda, EventBridge Scheduler, DynamoDB, SES, API Gateway, AWS SAM |

```
Browser ─► Next.js (Vercel) ──server-side──► API Gateway ─► Lambda ─► DynamoDB
                ▲                                               ▲
                └── /api/revalidate ◄── Lambda (2 AM, EventBridge) ──► SES email digest
                                              │
                                Medium / Substack / RSS feeds
```

CI runs on every push and pull request (`.github/workflows/ci.yml`): typecheck and build the frontend, test and lint the backend.
The backend deploys from `main` once AWS is connected (see [backend/README.md](backend/README.md#deploys-from-github-actions)).

> The original Django app (`blog/`, `personal_blog/`, `templates/`, `manage.py`, …) is still in the repo but no
> longer used by the new site. It's scheduled for removal.
