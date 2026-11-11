# PyChanter — Next.js frontend

A Next.js 15 (App Router, TypeScript) frontend for the Django blog in the repo root.
It reads data from the Django JSON API at `/api/` (see `blog/api.py`).

## Run locally

```bash
# 1. Start Django (repo root)
python manage.py runserver 127.0.0.1:8000

# 2. Start the frontend
cd frontend
cp .env.example .env.local   # adjust API_URL if Django runs elsewhere
npm install
npm run dev                  # http://localhost:3000
```

| Variable               | Purpose                                                     |
| ---------------------- | ----------------------------------------------------------- |
| `API_URL`              | Django base URL, used **server-side only** (no CORS needed). |
| `NEXT_PUBLIC_SITE_URL` | Public URL of the frontend, for share links and metadata.  |

## Pages

| Route              | What it shows                                              |
| ------------------ | ---------------------------------------------------------- |
| `/`                | Published posts, newest first, with pagination             |
| `/posts/[slug]`    | Post, tags, related posts, comments + comment form         |
| `/category/[slug]` | Posts in a category                                        |
| `/tag/[slug]`      | Posts with a tag                                           |
| `/search?q=`       | Title/content search                                       |
| `/about`           | About page (content lives in `src/lib/profile.ts`)         |

## Notes

- **Writing posts** stays in the Django admin (`/admin/`), which has the CKEditor rich-text editor.
  Only posts with *Is published* checked appear on the site.
- **Profile photos**: drop images into `public/images/` and set `avatar` in `src/lib/profile.ts`; initials are shown otherwise.
- **Comments** are submitted with a Server Action that calls `POST /api/posts/<slug>/comments/` from the Next.js server.
- Data is cached with ISR (`revalidate` 30–300s, see `src/lib/api.ts`); new comments revalidate their post immediately.
- Post images are served from Django's `MEDIA_URL`; make sure media is served in production.
