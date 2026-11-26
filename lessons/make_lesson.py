"""Turn YouTube videos into readable lessons and save them as blog posts.

Each lesson is a Markdown file in frontend/content/lessons with a
`youtube_id` in its front matter. The site shows lessons in the Daily Dose tab
(/daily and /daily/lessons), and the next run uses youtube_id to skip videos
that already have a lesson.

Usage:
    # Next unwritten video(s) from a playlist (what the daily workflow runs)
    python lessons/make_lesson.py --playlist "https://www.youtube.com/playlist?list=..." --count 1

    # Specific videos
    python lessons/make_lesson.py --video https://youtu.be/abc123 --video https://youtu.be/def456

YouTube's Watch Later list cannot be read by any API, so keep the videos you
want turned into lessons in an Unlisted (or public) playlist instead.
Needs ANTHROPIC_API_KEY in the environment.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import sys
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
POSTS_DIR = ROOT / "frontend" / "content" / "lessons"
MODEL = os.environ.get("LESSON_MODEL", "claude-opus-5-5")

VIDEO_ID_RE = re.compile(r"^[A-Za-z0-9_-]{11}$")
YOUTUBE_ID_FM_RE = re.compile(r"^youtube_id:\s*['\"]?([A-Za-z0-9_-]{11})", re.MULTILINE)


@dataclass
class Video:
    id: str
    title: str
    channel: str

    @property
    def url(self) -> str:
        return f"https://www.youtube.com/watch?v={self.id}"


@dataclass
class Lesson:
    title: str
    summary: str
    tags: list[str]
    body: str


# ---------------------------------------------------------------- YouTube


def video_id(url_or_id: str) -> str:
    """Accept a bare id or any common YouTube URL and return the 11-char id."""
    s = url_or_id.strip()
    if VIDEO_ID_RE.match(s):
        return s
    u = urllib.parse.urlparse(s)
    host = (u.hostname or "").lower()
    if host == "youtu.be":
        cand = u.path.lstrip("/").split("/")[0]
    elif host.endswith("youtube.com"):
        q = urllib.parse.parse_qs(u.query)
        if "v" in q:
            cand = q["v"][0]
        else:
            parts = [p for p in u.path.split("/") if p]
            cand = parts[1] if len(parts) >= 2 and parts[0] in ("shorts", "embed", "live", "v") else ""
    else:
        cand = ""
    if not VIDEO_ID_RE.match(cand):
        raise ValueError(f"Not a YouTube video link: {url_or_id}")
    return cand


def video_info(vid: str) -> Video:
    """Title and channel from YouTube's oEmbed endpoint (no API key needed)."""
    url = "https://www.youtube.com/oembed?format=json&url=" + urllib.parse.quote(
        f"https://www.youtube.com/watch?v={vid}", safe=""
    )
    try:
        with urllib.request.urlopen(url, timeout=20) as r:
            data = json.load(r)
        return Video(vid, data.get("title", vid), data.get("author_name", ""))
    except Exception:  # noqa: BLE001 - metadata is nice to have, not required
        return Video(vid, vid, "")


def playlist_ids(playlist_url: str) -> list[str]:
    """Video ids in a public or unlisted playlist, in playlist order."""
    import yt_dlp

    opts = {"extract_flat": True, "quiet": True, "skip_download": True}
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(playlist_url, download=False)
    ids = [e.get("id") for e in info.get("entries") or [] if e]
    return [i for i in ids if i and VIDEO_ID_RE.match(i)]


def transcript(vid: str) -> str:
    """Transcript text, in English where YouTube has or can translate to it."""
    from youtube_transcript_api import YouTubeTranscriptApi

    api = YouTubeTranscriptApi()
    listing = api.list(vid)
    try:
        chosen = listing.find_transcript(["en", "en-US", "en-GB"])
    except Exception:  # noqa: BLE001
        chosen = next(iter(listing))
        if chosen.is_translatable and not chosen.language_code.startswith("en"):
            try:
                chosen = chosen.translate("en")
            except Exception:  # noqa: BLE001 - fall back to the original language
                pass
    fetched = chosen.fetch()
    text = " ".join(s.text.replace("\n", " ") for s in fetched.snippets)
    return re.sub(r"\s+", " ", text).strip()


# ---------------------------------------------------------------- Claude

SYSTEM = """You turn video transcripts into lessons for a busy reader who will \
read instead of watching. Write in clear, plain English, even if the transcript \
is in another language.

Write the lesson as flowing paragraphs, the way a good teacher would explain the \
material in writing. Keep every idea, example, number and recommendation that \
matters; drop filler, sponsor reads, greetings and calls to subscribe. Use a few \
`##` section headings to break up a long lesson. Use a bulleted list only where \
the video itself walks through a list of steps or items. Do not mention "the \
transcript"; you may refer to "the video" or the speaker by name. Do not invent \
facts the video does not contain. End with a short `## Key takeaways` section of \
3 to 5 bullets.

Reply in exactly this format and nothing else:

TITLE: <a clear lesson title, not clickbait>
SUMMARY: <one sentence saying what the reader will learn>
TAGS: <2 to 4 lowercase topic tags, comma separated>
---
<the lesson in Markdown, without a top-level # heading>"""


def parse_lesson(text: str) -> Lesson:
    head, sep, body = text.strip().partition("\n---\n")
    if not sep:
        raise ValueError("Lesson reply is missing the --- separator")
    fields: dict[str, str] = {}
    for line in head.splitlines():
        key, _, value = line.partition(":")
        if value:
            fields[key.strip().upper()] = value.strip()
    if not fields.get("TITLE") or not body.strip():
        raise ValueError("Lesson reply is missing a title or body")
    tags = [re.sub(r"[^a-z0-9-]+", "-", t.strip().lower()).strip("-") for t in fields.get("TAGS", "").split(",")]
    return Lesson(
        title=fields["TITLE"],
        summary=fields.get("SUMMARY", ""),
        tags=[t for t in tags if t][:4],
        body=body.strip(),
    )


def write_lesson(video: Video, text: str) -> Lesson:
    import anthropic

    client = anthropic.Anthropic()
    prompt = (
        f"Video title: {video.title}\nChannel: {video.channel or 'unknown'}\n\n"
        f"<transcript>\n{text}\n</transcript>"
    )
    with client.beta.messages.stream(
        model=MODEL,
        max_tokens=64000,
        system=SYSTEM,
        thinking={"type": "adaptive"},
        output_config={"effort": "high"},
        betas=["server-side-fallback-2026-07-01"],
        fallbacks="default",
        messages=[{"role": "user", "content": prompt}],
    ) as stream:
        msg = stream.get_final_message()
    if msg.stop_reason == "refusal":
        raise RuntimeError(f"Claude declined to write a lesson for {video.url}")
    if msg.stop_reason == "max_tokens":
        raise RuntimeError(f"Lesson for {video.url} was cut off")
    out = "".join(b.text for b in msg.content if b.type == "text")
    return parse_lesson(out)


# ---------------------------------------------------------------- Posts


def slugify(s: str, limit: int = 60) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")
    return slug[:limit].rstrip("-") or "lesson"


def yaml_str(s: str) -> str:
    return json.dumps(s, ensure_ascii=False)  # JSON strings are valid YAML


def done_ids(posts_dir: Path = POSTS_DIR) -> set[str]:
    ids: set[str] = set()
    if posts_dir.exists():
        for f in posts_dir.glob("*.md"):
            m = YOUTUBE_ID_FM_RE.search(f.read_text(encoding="utf8"))
            if m:
                ids.add(m.group(1))
    return ids


def render_post(video: Video, lesson: Lesson, date: dt.date) -> str:
    source = f"[{video.title}]({video.url})" + (f" by {video.channel}" if video.channel else "")
    return (
        "---\n"
        f"title: {yaml_str(lesson.title)}\n"
        f"date: {date.isoformat()}\n"
        f"summary: {yaml_str(lesson.summary)}\n"
        f"tags: [{', '.join(lesson.tags)}]\n"
        f"youtube_id: {video.id}\n"
        "---\n\n"
        f"*Lesson from the video {source}.*\n\n"
        f"{lesson.body}\n"
    )


def save_post(video: Video, lesson: Lesson, date: dt.date, posts_dir: Path = POSTS_DIR) -> Path:
    posts_dir.mkdir(parents=True, exist_ok=True)
    base = f"{date.isoformat()}-{slugify(lesson.title)}"
    path = posts_dir / f"{base}.md"
    n = 2
    while path.exists():
        path = posts_dir / f"{base}-{n}.md"
        n += 1
    path.write_text(render_post(video, lesson, date), encoding="utf8")
    return path


# ---------------------------------------------------------------- CLI


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--playlist", default=os.environ.get("LESSON_PLAYLIST_URL"), help="playlist URL to take videos from")
    p.add_argument("--video", action="append", default=[], help="video URL or id (repeatable)")
    p.add_argument("--count", type=int, default=1, help="how many new playlist videos to turn into lessons")
    p.add_argument("--date", type=dt.date.fromisoformat, default=dt.date.today(), help="post date (YYYY-MM-DD)")
    p.add_argument("--posts-dir", type=Path, default=POSTS_DIR)
    args = p.parse_args(argv)

    done = done_ids(args.posts_dir)
    if args.video:
        queue = [video_id(v) for v in args.video]
    elif args.playlist:
        queue = [v for v in playlist_ids(args.playlist) if v not in done]
    else:
        p.error("give --video or --playlist (or set LESSON_PLAYLIST_URL)")

    written, failed = 0, 0
    for vid in queue:
        if written >= (len(queue) if args.video else args.count):
            break
        if vid in done:
            print(f"skip {vid}: already a lesson")
            continue
        video = video_info(vid)
        try:
            text = transcript(vid)
        except Exception as e:  # noqa: BLE001 - videos without captions are skipped
            print(f"skip {vid} ({video.title}): no transcript ({type(e).__name__})", file=sys.stderr)
            failed += 1
            continue
        lesson = write_lesson(video, text)
        path = save_post(video, lesson, args.date, args.posts_dir)
        done.add(vid)
        written += 1
        print(f"wrote {path.relative_to(ROOT) if path.is_relative_to(ROOT) else path}")

    if not written:
        print("no new lessons written" + (f" ({failed} videos had no transcript)" if failed else ""))
    return 0 if written or not failed else 1


if __name__ == "__main__":
    sys.exit(main())
