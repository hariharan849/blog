# Hariharan Manoharan: portfolio, blog & Daily Dose

| Folder | What | Stack |
|---|---|---|
| [`frontend/`](frontend/README.md) | Portfolio, Markdown blog, Daily Dose pages, admin | Next.js 15, TypeScript, NextAuth (GitHub) → Vercel |
| [`backend/`](backend/README.md) | Nightly feed collector, email digest, API | Python 3.12, AWS Lambda, EventBridge Scheduler, DynamoDB, SES, API Gateway, AWS SAM |
| [`lessons/`](#daily-lessons) | Daily lessons from YouTube, Substack, Medium, RSS and GitHub | Python 3.12, youtube-transcript-api, yt-dlp, trafilatura, Claude API, GitHub Actions |

The site is a portfolio first (home, projects, about, blog). The **Daily Dose** tab is the engineering-world side: a daily lesson at the top, then new posts from the writers I follow.

```
Browser ─► Next.js (Vercel) ──server-side──► API Gateway ─► Lambda ─► DynamoDB
                ▲                                               ▲
                └── /api/revalidate ◄── Lambda (2 AM, EventBridge) ──► SES email digest
                                              │
                                Medium / Substack / RSS feeds
```

CI runs on every push and pull request (`.github/workflows/ci.yml`): typecheck and build the frontend, test and lint the backend.
The backend deploys from `main` once AWS is connected (see [backend/README.md](backend/README.md#deploys-from-github-actions)).

## Daily lessons

Every morning `.github/workflows/daily-lesson.yml` checks the sources listed in [`lessons/sources.yml`](lessons/sources.yml), finds what's new since the last run, and turns up to three items a day into lessons in `frontend/content/lessons/`. The newest lesson is featured at the top of `/daily`, and all of them are listed at `/daily/lessons`.

| Source `type` | What it watches | Text the lesson is written from |
|---|---|---|
| `youtube` | a video, a playlist or a channel | the transcript (youtube-transcript-api, yt-dlp fallback) |
| `substack`, `medium`, `rss` | a newsletter, author or any feed | the post body (from the feed, or the page via trafilatura) |
| `github` | a user/org (each new repo) or one repo | a snapshot of the repo; Claude writes an architecture-only post |

Extraction is plain Python with no LLM; Claude only writes the lesson. **Nothing is published twice**: every lesson records a `source_id` in its front matter, and `lessons/state.json` (committed by the workflow) remembers what was already in a source when you added it and which items failed. A new channel, feed or GitHub user only contributes things published after you add it; a single video, a playlist or a single repo is processed in full. Items that fail for a passing reason (YouTube blocking, network) are retried on the next three runs.

YouTube blocks transcript requests from many cloud servers, GitHub's included. Add a `YOUTUBE_PROXY_URL` (residential works best), `WEBSHARE_PROXY_USERNAME`/`WEBSHARE_PROXY_PASSWORD`, or `YOUTUBE_COOKIES` secret so the daily run can get through. Watch Later itself can't be read by any API, so put videos you want as lessons in an Unlisted playlist and list that playlist as a source.

To turn it on, add the `ANTHROPIC_API_KEY` secret in Settings → Secrets and variables → Actions. Run it by hand from the Actions tab (it also takes specific links), or locally:

```bash
pip install -r lessons/requirements.txt
python lessons/make_lesson.py --dry-run                          # what's new, writes nothing
export ANTHROPIC_API_KEY=...
python lessons/make_lesson.py                                    # the daily run
python lessons/make_lesson.py --url https://github.com/owner/repo  # one item now
python -m pytest -q lessons/tests
```

Lessons are plain Markdown, so edit or delete one like any other file.

Visitors can also **subscribe by email** from the Daily Dose pages. After each lesson is committed, the workflow runs `lessons/announce.py`, and the backend emails confirmed subscribers a short version that links back to the full lesson. This stays off until the backend is deployed and `FEED_API_URL` / `FEED_ADMIN_TOKEN` are set; see [backend/README.md](backend/README.md#email-subscriptions).
