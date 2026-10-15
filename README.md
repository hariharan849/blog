# PyChanter Blog

Personal blogs of Hariharan Manoharan and Rajan Singh, with AI-ready search and a private
"Daily Bytes" learning digest.

## Architecture

```
backend/    Django + Django REST Framework: JSON API, admin, AI search, knowledge base,
            Daily Bytes pipeline (Celery tasks), MCP server
frontend/   Next.js (React, TypeScript): every page, server-side rendered for SEO
Dockerfile  One container: Next.js is the public server and proxies /api, /admin, /media,
            /sitemap.xml, /robots.txt and /llms.txt to Django on 127.0.0.1:8000
worker      The same image running `celery worker --beat` with Redis: feed polling,
            indexing, enrichment and the daily digest, with retries
```

The frontend uses Tailwind CSS with an editorial design that follows the system light/dark
setting. It includes a ⌘K / Ctrl+K command palette (search as you type, using the hybrid AI
search), instant topic and author filtering on the home page, and on posts a reading-progress
bar, a sticky table of contents and copy buttons on code blocks.

The browser only ever talks to one origin, so authentication uses Django's session cookie and
CSRF token, with no CORS setup. Public pages (home, posts, categories, tags, search, about) are
rendered on the server with metadata and `BlogPosting` JSON-LD. Login, comments, the post editor
and Daily Bytes call the API from the browser.

## Local development

You need Python 3.12+ and Node 22+.

**Backend** (http://127.0.0.1:8000):

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # DEBUG=True, etc.
python manage.py migrate
python manage.py seed_demo --password choose-a-password   # optional demo users and posts
python manage.py runserver
```

**Frontend** (http://localhost:3000, in a second terminal):

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000. Next.js forwards `/api`, `/admin` and `/media` to Django, so the
admin is at http://localhost:3000/admin/.

Background tasks run inline when `REDIS_URL` isn't set, so you don't need Redis for development.

**Or with Docker Compose** (Postgres, Redis, a Celery worker and both dev servers with hot reload):

```bash
docker compose up
```

## Configuration

Backend settings come from environment variables; `backend/.env` is loaded automatically. See
[`backend/.env.example`](backend/.env.example) for the full list. The important ones:

| Variable | Purpose |
| --- | --- |
| `DEBUG` | `True` for local development |
| `DJANGO_SECRET_KEY` | Required when `DEBUG` is off |
| `DJANGO_ALLOWED_HOST` | Comma-separated public host names |
| `SITE_URL` | Public URL, e.g. `https://blog.example.com` (canonical links, CSRF trusted origin) |
| `DATABASE_URL` | e.g. `postgres://user:pass@host/db`; SQLite is used when unset |
| `AI_SEARCH_EMBEDDER` | Embedding provider (see below) |
| `ANTHROPIC_API_KEY` | Optional: Daily Bytes enrichment and Ask answers |
| `REDIS_URL` | Celery broker, e.g. `redis://localhost:6379/0`; without it tasks run inline |

The frontend reads `BACKEND_URL` (default `http://127.0.0.1:8000`) and optionally `SITE_URL`;
see [`frontend/.env.example`](frontend/.env.example).

## Deployment

Build and run the production image locally:

```bash
docker build -t pychanter .
docker run -p 10000:10000 -e DJANGO_SECRET_KEY=... -e DJANGO_ALLOWED_HOST=localhost \
  -e SITE_URL=http://localhost:10000 pychanter
```

On start the container runs migrations, then starts gunicorn (internal) and the Next.js server on
`$PORT`.

**Render:** create everything from [`render.yaml`](render.yaml) (Blueprint): the web service, a
background worker (Celery worker + scheduler, same image), a Key Value (Redis) instance and a
Postgres database. Set `SITE_URL` and `DJANGO_ALLOWED_HOST` to your domain. Uploaded images are
stored on the container's disk, which is lost on redeploy, so attach a persistent disk at
`/app/backend/media` (or move media to object storage) if you upload images.

## API

All endpoints live under `/api/v1/` and return JSON. Errors look like
`{"error": "...", "fields": {...}}`.

| Endpoint | Access |
| --- | --- |
| `GET search/`, `GET posts/`, `GET posts/<slug>/`, `GET posts/<slug>/comments/`, `GET categories/`, `GET tags/<slug>/` | Public |
| `POST posts/<slug>/comments/` | Logged-in users |
| `POST posts/` (multipart, with image) | Superusers |
| `GET auth/csrf/`, `GET auth/me/`, `POST auth/login/`, `POST auth/logout/`, `POST auth/register/` | Public |
| `GET kb/search/`, `POST kb/ask/` (throttled) | Public over blog posts; newsletter scopes are staff-only |
| `bytes/digests/`, `bytes/articles/`, `bytes/sources/`, `bytes/interests/`, `bytes/failures/` | Staff |

## AI search

Every saved post is converted to plain text, split into overlapping, heading-aware chunks
(~200 words) and embedded. Searches can then run in three modes:

- **keyword**: PostgreSQL full-text ranking (title, tags, category, excerpt, body), with a portable fallback on SQLite
- **semantic**: nearest chunks by embedding similarity; matching passages are returned, ready to ground an LLM answer (RAG)
- **hybrid** (default): both, merged with reciprocal rank fusion; falls back to keyword if the embedding provider is down

Embedding providers are set with `AI_SEARCH_EMBEDDER`:

| Provider | Value | Notes |
| --- | --- | --- |
| Hashing (default) | `blog.search.embeddings.HashingEmbedder` | Offline, no key; word-overlap only |
| Voyage AI | `blog.search.embeddings.VoyageEmbedder` | Set `AI_SEARCH_EMBEDDING_API_KEY` |
| OpenAI-compatible | `blog.search.embeddings.OpenAICompatibleEmbedder` | OpenAI, Ollama, vLLM, ... via `AI_SEARCH_EMBEDDING_API_BASE` |

After changing provider or model, rebuild the index:

```bash
cd backend && python manage.py reindex_posts --force
```

Unchanged posts are skipped automatically, so it is cheap to run `reindex_posts` after every deploy.
Vectors live in the `PostChunk` table. For a large corpus, implement `save()`/`query()` on top of
pgvector (or Qdrant, etc.) and point `AI_SEARCH_VECTOR_STORE` at it; nothing else changes.

### Endpoints for search engines and AI agents

| URL | Description |
| --- | --- |
| `/api/v1/search/?q=...&mode=hybrid&limit=10` | Search; optional `blog`, `category`, `tag` filters |
| `/api/v1/posts/` | Paginated list of published posts |
| `/api/v1/posts/<slug>/` | One post with HTML and plain-text content, related posts and JSON-LD |
| `/sitemap.xml`, `/robots.txt` | Crawling |
| `/llms.txt` | Markdown site map for LLMs ([llmstxt.org](https://llmstxt.org)) |

Post pages also include `BlogPosting` JSON-LD structured data.

## Knowledge base and Ask

Blog posts and the full text of every newsletter article you follow are split into heading-aware
passages and embedded. `GET /api/v1/kb/search/` runs hybrid search over these passages.
`POST /api/v1/kb/ask/`, and the `/ask` page (also reachable from ⌘K → "Ask AI"), answers
questions from the top passages with numbered citations. Citations that don't match a source
that was actually sent are dropped. Without `ANTHROPIC_API_KEY` it returns the passages only.

- **Who sees what:** anyone can ask about blog posts. Newsletter passages are other people's
  writing kept privately, so only staff can search or ask over them.
- **Cost control:** Ask is rate-limited (`KB_ASK_RATE_ANON`, `KB_ASK_RATE_USER`).
- **Edited articles:** when an article changes upstream, its old passages are kept with
  `valid_to` set rather than deleted, so earlier citations still resolve. Search only uses the
  current version.

### MCP server

Query the knowledge base from Claude Code, Claude Desktop, Cursor or any MCP client:

```bash
claude mcp add pychanter -- python /path/to/blog/backend/manage.py kb_mcp
```

It runs over stdio using the database in `backend/.env` (or `DATABASE_URL`). Tools:

| Tool | What it does |
| --- | --- |
| `kb_search` | Passages from posts and newsletters |
| `kb_ask` | An answer with citations |
| `kb_add_source` | Follow a feed and fetch it |
| `kb_sync` | Poll all feeds now |

The two write tools queue Celery tasks and return the task id.

For Claude Desktop or Cursor, add the same command to their MCP config, e.g.
`{"command": "python", "args": ["/path/to/blog/backend/manage.py", "kb_mcp"]}`.

### Reliable pipeline

`poll_feeds` → `fetch_source` (ETag-aware) → `process_article` (index, then enrich) are Celery
tasks:
- **No double charges:** each step records the content hash it finished for. A retry, a rerun or
  a duplicate message skips completed steps and never pays twice for embeddings or Claude calls.
- **Retries:** network errors, rate limits and provider outages retry with exponential backoff.
- **Worker crashes:** tasks are acknowledged late, so a task on a killed worker is redelivered
  and resumes.
- **Failures dataset:** steps that still fail are stored as `PipelineFailure` rows, shown under
  Daily Bytes → Sources ("Pipeline health"). Export them with
  `python manage.py export_failures -o failures.jsonl` (JSON Lines) to build an evaluation set.

## Daily Bytes: personal learning digest

A private, staff-only page at `/bytes/`. Every day it reads the feeds of the writers and
publications you follow (Substack, Medium, Towards AI, any blog with RSS/Atom). Each new article
gets a summary, its most interesting points, tags, a difficulty level and a relevance score
against your interests. The best few are then turned into a short daily lesson.

Only public feeds are read. Paywalled and member-only content is never bypassed, nothing is
republished, and every item links to the original.

1. **Add sources** at `/bytes/sources/`: paste profile/publication URLs, one per line, or upload
   an OPML export from a feed reader. Supported formats:
   - `https://name.substack.com` or a Substack custom domain
   - `https://medium.com/@writer`, `https://medium.com/<publication>`, `https://medium.com/tag/<tag>`
   - `https://pub.towardsai.net`
   - any site with an RSS/Atom feed

   You can also import from the command line: `cd backend && python manage.py import_sources follows.opml`.
2. **Set your interests** on the same page (e.g. "LLM agents" with priority 5, "RAG" with 3).
   They drive the relevance score.
3. **Run the pipeline** once a day:

   ```bash
   cd backend
   python manage.py run_daily_bytes            # fetch -> enrich -> digest (-> email)
   python manage.py run_daily_bytes --no-email --limit 3   # quick test
   ```

Set `ANTHROPIC_API_KEY` to have Claude extract the insights and write the daily lesson.
Without it a keyword-based fallback is used. With the default model (`claude-opus-5-5`, low effort),
about 30 articles a day costs roughly $0.50 to $1 per day. Set `DAILY_BYTES_MODEL=claude-haiku-5-5`
to bring that down to about 2 cents a day. All settings are listed in [`backend/.env.example`](backend/.env.example).

**Scheduling.** The Celery worker's scheduler (`celery -A personal_blog worker --beat`) polls
feeds every hour and builds the digest at 06:15 UTC. This needs Redis and a persistent database
(Postgres via `DATABASE_URL`).

Without a worker, run `python manage.py run_daily_bytes` from cron, or trigger the manual
`.github/workflows/daily-bytes.yml` workflow. Both run the same steps inline.

To get the digest by email, set `DAILY_BYTES_EMAIL_TO` and the `EMAIL_*` settings.

## Testing

```bash
cd backend && python manage.py test blog learning
cd frontend && npm run lint && npm run typecheck && npm test && npm run build
cd frontend && npm run test:e2e    # Playwright, against a running site (see e2e/README.md)
```

## License

This project is licensed under the MIT License.

## Screenshot

![Blog Screenshot](blog.png)
