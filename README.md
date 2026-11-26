# Hariharan Manoharan: portfolio, blog & Daily Dose

| Folder | What | Stack |
|---|---|---|
| [`frontend/`](frontend/README.md) | Portfolio, Markdown blog, Daily Dose pages, admin | Next.js 15, TypeScript, NextAuth (GitHub) → Vercel |
| [`backend/`](backend/README.md) | Nightly feed collector, email digest, API | Python 3.12, AWS Lambda, EventBridge Scheduler, DynamoDB, SES, API Gateway, AWS SAM |
| [`lessons/`](#daily-lessons) | Daily lesson written from a YouTube video | Python 3.12, youtube-transcript-api, Claude API, GitHub Actions |

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

Every morning `.github/workflows/daily-lesson.yml` takes the next video from a YouTube playlist, reads its transcript, has Claude write it up as a lesson in plain paragraphs, and commits it to `frontend/content/lessons/`. The newest lesson is featured at the top of `/daily`, and all of them are listed at `/daily/lessons`.

YouTube's Watch Later list can't be read by any API, so keep the videos you want as lessons in an **Unlisted** playlist and add videos to it as you go. Videos that already have a lesson (matched by `youtube_id` in the front matter) are skipped, and videos without captions are skipped with a note in the run log.

To turn it on, in the repository's Settings → Secrets and variables → Actions add:

- secret `ANTHROPIC_API_KEY`
- variable `LESSON_PLAYLIST_URL`, for example `https://www.youtube.com/playlist?list=PL...`

Run it by hand from the Actions tab (it also takes specific video links), or locally:

```bash
pip install -r lessons/requirements.txt
export ANTHROPIC_API_KEY=...
python lessons/make_lesson.py --video https://youtu.be/VIDEO_ID       # one video
python lessons/make_lesson.py --playlist "$LESSON_PLAYLIST_URL" --count 3
python -m pytest -q lessons/tests
```

Lessons are plain Markdown, so edit or delete one like any other file.
