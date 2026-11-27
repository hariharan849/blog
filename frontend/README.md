# Portfolio + blog + Daily Dose (Next.js)

Next.js 15 (App Router, TypeScript). The backend for the Daily Dose lives in [`/backend`](../backend/README.md).

| Route | What it shows | Data |
|---|---|---|
| `/` | Hero, featured projects, today's Daily Dose, latest posts | all of the below |
| `/projects` | All projects grouped by area | `src/lib/projects.ts` |
| `/blog`, `/blog/[slug]`, `/blog/tag/[tag]` | Blog | Markdown in `content/posts/` |
| `/daily`, `/daily/[day]` | Daily Dose: new posts from followed authors | backend API |
| `/about` | Bio, skills, experience, links | `src/lib/profile.ts` |
| `/admin` | Add / pause / remove followed authors, run the job now | backend API, GitHub sign-in |
| `/rss.xml` | RSS feed of the blog | Markdown posts |

## Run locally

```bash
# terminal 1: fake backend (no AWS needed)
cd backend && uv sync && uv run scripts/local_api.py

# terminal 2
cd frontend
cp .env.example .env.local   # set FEED_API_URL=http://127.0.0.1:8787 and FEED_ADMIN_TOKEN=dev-token
npm install
npm run dev                   # http://localhost:3000
```

## Writing a post

Add `content/posts/my-post.md` (the file name becomes the URL):

```markdown
---
title: My post
date: 2026-11-12
summary: One line shown on cards and in search results.
tags: [genai, agents]
draft: false
---

Markdown content…
```

Drafts show up in `npm run dev` but are hidden in production builds.

## Admin sign-in

`/admin` uses GitHub OAuth through NextAuth and only lets in the GitHub usernames listed in `ADMIN_GITHUB_LOGINS`.

1. Create a GitHub OAuth app (GitHub → Settings → Developer settings → OAuth Apps). Callback URL:
   `https://<your-site>/api/auth/callback/github` (and `http://localhost:3000/api/auth/callback/github` for local use).
2. Set `GITHUB_ID`, `GITHUB_SECRET`, `NEXTAUTH_SECRET` (`openssl rand -base64 32`) and `NEXTAUTH_URL`.

Every admin action is a Server Action that re-checks the session before calling the backend with
`FEED_ADMIN_TOKEN`. The token never reaches the browser.

## Deploy (Vercel)

Import the repo in Vercel as **one Next.js project** with **Root Directory** `frontend`. If Vercel offers a
multi-service setup (it spots the Python folders), don't use it: `backend/` deploys to AWS with SAM and
`lessons/` runs in GitHub Actions. `frontend/vercel.json` skips a build when a push changes nothing under
`frontend/` (new lessons land in `frontend/content/lessons`, so they still redeploy).

Environment variables (Production):

| Variable | When | Value |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | now | the site URL, e.g. `https://<project>.vercel.app` |
| `GITHUB_ID`, `GITHUB_SECRET` | now, for /admin | GitHub OAuth app (see above) |
| `NEXTAUTH_SECRET` | now, for /admin | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | now, for /admin | same as `NEXT_PUBLIC_SITE_URL` |
| `ADMIN_GITHUB_LOGINS` | now, for /admin | `hariharan849` |
| `FEED_API_URL` | after the backend deploy | the SAM `ApiUrl` output |
| `FEED_ADMIN_TOKEN` | after the backend deploy | SSM `/dailydose/admin-token` |
| `REVALIDATE_SECRET` | after the backend deploy | SSM `/dailydose/revalidate-secret` |

Without the backend the site still works: lessons and posts are Markdown, and the subscribe form says
"Email subscriptions open soon." Preview deployments need their own OAuth callback URL if you want to sign in on them.

## Personal content to finish

- `src/lib/profile.ts`: fill in `experience` from LinkedIn. The section stays hidden while the list is empty.
- Add a photo at `public/images/profile.jpg` and set `avatar`. Initials are shown until then.
- Add `public/resume.pdf` and set `resume` to show a Resume button.
