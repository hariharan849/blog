"""Turn new videos, articles and repositories into lessons on the blog.

Every morning the daily workflow runs this with no arguments. It reads the
sources in lessons/sources.yml (YouTube, Substack, Medium, RSS, GitHub), finds
items that are new since the last run, extracts their text (see
connectors.py), has Claude write each one up, and saves the lessons as
Markdown in frontend/content/lessons. The site shows them in the Daily Dose tab.

Nothing is published twice: each lesson's front matter carries a `source_id`
(youtube:<id>, web:<url> or github:<owner/repo>), and lessons/state.json
remembers which items were already there when a source was first added and
which ones failed, so a run only picks up what is genuinely new.

Usage:
    python lessons/make_lesson.py                     # the daily run
    python lessons/make_lesson.py --dry-run           # list what's new, write nothing
    python lessons/make_lesson.py --url https://youtu.be/abc123 --url https://github.com/owner/repo

Needs ANTHROPIC_API_KEY (except with --dry-run).
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import sys
from dataclasses import dataclass
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import connectors  # noqa: E402
from connectors import ExtractError, Item  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
POSTS_DIR = ROOT / "frontend" / "content" / "lessons"
SOURCES_FILE = ROOT / "lessons" / "sources.yml"
STATE_FILE = ROOT / "lessons" / "state.json"
MODEL = os.environ.get("LESSON_MODEL", "claude-opus-5-5")
MAX_ATTEMPTS = 3  # transient failures (blocked, network) before an item is given up on

SOURCE_ID_FM_RE = re.compile(r"^source_id:\s*\"?([^\"\n]+)\"?\s*$", re.MULTILINE)
YOUTUBE_ID_FM_RE = re.compile(r"^youtube_id:\s*['\"]?([A-Za-z0-9_-]{11})", re.MULTILINE)


@dataclass
class Lesson:
    title: str
    summary: str
    tags: list[str]
    body: str


# ---------------------------------------------------------------- Claude

FORMAT = """
Reply in exactly this format and nothing else:

TITLE: <a clear lesson title, not clickbait>
SUMMARY: <one sentence saying what the reader will learn>
TAGS: <2 to 4 lowercase topic tags, comma separated>
---
<the lesson in Markdown, without a top-level # heading>"""

SYSTEM = (
    """You turn talks, tutorials and articles into lessons for a busy engineer \
who will read the lesson instead of watching or reading the original. Write in \
clear, plain English, even if the source is in another language.

Write the lesson as flowing paragraphs, the way a good teacher would explain the \
material in writing. Keep every idea, example, number and recommendation that \
matters; drop filler, sponsor reads, greetings, newsletter plugs and calls to \
subscribe. Use a few `##` section headings to break up a long lesson. Use a \
bulleted list only where the source itself walks through a list of steps or \
items. Do not mention "the transcript"; refer to "the video", "the article" or \
the author by name. Do not invent facts the source does not contain. End with a \
short `## Key takeaways` section of 3 to 5 bullets.
"""
    + FORMAT
)

SYSTEM_REPO = (
    """You explain the architecture of software repositories to an experienced \
engineer, from a snapshot of the repository (its file tree, README, manifests \
and main source files). Write only about the architecture: what the system is \
for in one or two sentences, then its main components and what each is \
responsible for, how they talk to each other and how data flows through a \
typical request or job, the key technologies and why they appear to be chosen, \
where state lives, how it is built, configured and deployed, and the design \
decisions or trade-offs worth learning from. Do not walk through files one by \
one, do not explain installation steps, and do not review code quality.

Write in flowing paragraphs with a few `##` headings. Include one small \
```text diagram of the main components and the arrows between them. Name real \
directories and modules so the reader can find them. Only describe what the \
snapshot shows; if something important is not visible (for example, how it is \
deployed), say so in one sentence instead of guessing. End with a short \
`## Key takeaways` section of 3 to 5 bullets about the architecture.
"""
    + FORMAT
)


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


def prompt_for(item: Item, text: str) -> tuple[str, str]:
    """(system prompt, user message) for an item."""
    if item.kind == "repo":
        return SYSTEM_REPO, f"<repository_snapshot>\n{text}\n</repository_snapshot>"
    label = {"video": "Video", "article": "Article"}[item.kind]
    tag = "transcript" if item.kind == "video" else "article"
    head = f"{label} title: {item.title}\nBy: {item.author or 'unknown'}\nURL: {item.url}"
    return SYSTEM, f"{head}\n\n<{tag}>\n{text}\n</{tag}>"


def write_lesson(item: Item, text: str) -> Lesson:
    import anthropic

    system, user = prompt_for(item, text)
    client = anthropic.Anthropic()
    with client.beta.messages.stream(
        model=MODEL,
        max_tokens=64000,
        system=system,
        thinking={"type": "adaptive"},
        output_config={"effort": "high"},
        betas=["server-side-fallback-2026-07-01"],
        fallbacks="default",
        messages=[{"role": "user", "content": user}],
    ) as stream:
        msg = stream.get_final_message()
    if msg.stop_reason == "refusal":
        raise RuntimeError(f"Claude declined to write a lesson for {item.url}")
    if msg.stop_reason == "max_tokens":
        raise RuntimeError(f"Lesson for {item.url} was cut off")
    return parse_lesson("".join(b.text for b in msg.content if b.type == "text"))


# ---------------------------------------------------------------- Posts


def slugify(s: str, limit: int = 60) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")
    return slug[:limit].rstrip("-") or "lesson"


def yaml_str(s: str) -> str:
    return json.dumps(s, ensure_ascii=False)  # JSON strings are valid YAML


def done_ids(posts_dir: Path = POSTS_DIR) -> set[str]:
    """source_ids of every published lesson (older lessons only have youtube_id)."""
    ids: set[str] = set()
    if posts_dir.exists():
        for f in posts_dir.glob("*.md"):
            text = f.read_text(encoding="utf8")
            if m := SOURCE_ID_FM_RE.search(text):
                ids.add(m.group(1).strip())
            if m := YOUTUBE_ID_FM_RE.search(text):
                ids.add(f"youtube:{m.group(1)}")
    return ids


def credit_line(item: Item) -> str:
    link = f"[{item.title}]({item.url})"
    by = f" by {item.author}" if item.author else ""
    if item.kind == "video":
        return f"*Lesson from the video {link}{by}.*"
    if item.kind == "repo":
        return f"*Architecture notes on the GitHub repository {link}.*"
    return f"*Lesson from the article {link}{by}.*"


def render_post(item: Item, lesson: Lesson, date: dt.date) -> str:
    lines = [
        "---",
        f"title: {yaml_str(lesson.title)}",
        f"date: {date.isoformat()}",
        f"summary: {yaml_str(lesson.summary)}",
        f"tags: [{', '.join(lesson.tags)}]",
        f"source_id: {yaml_str(item.key)}",
        f"source_url: {yaml_str(item.url)}",
        f"source_type: {item.kind}",
    ]
    if item.video_id:
        lines.append(f"youtube_id: {item.video_id}")
    lines += ["---", "", credit_line(item), "", lesson.body, ""]
    return "\n".join(lines)


def save_post(item: Item, lesson: Lesson, date: dt.date, posts_dir: Path = POSTS_DIR) -> Path:
    posts_dir.mkdir(parents=True, exist_ok=True)
    base = f"{date.isoformat()}-{slugify(lesson.title)}"
    path = posts_dir / f"{base}.md"
    n = 2
    while path.exists():
        path = posts_dir / f"{base}-{n}.md"
        n += 1
    path.write_text(render_post(item, lesson, date), encoding="utf8")
    return path


# ---------------------------------------------------------------- Sources & state


def load_sources(path: Path = SOURCES_FILE) -> tuple[list[dict], dict]:
    """(sources, settings) from sources.yml."""
    import yaml

    data = yaml.safe_load(path.read_text(encoding="utf8")) if path.exists() else {}
    data = data or {}
    sources = []
    for s in data.get("sources") or []:
        if not isinstance(s, dict) or not s.get("type") or not s.get("url"):
            raise ValueError(f"Each source needs a type and a url: {s!r}")
        sources.append({**s, "type": str(s["type"]).lower(), "url": str(s["url"]).strip()})
    return sources, data.get("settings") or {}


def load_state(path: Path = STATE_FILE) -> dict:
    state = json.loads(path.read_text(encoding="utf8")) if path.exists() else {}
    state.setdefault("sources", {})
    state.setdefault("items", {})
    return state


def save_state(state: dict, path: Path = STATE_FILE) -> None:
    path.write_text(json.dumps(state, indent=2, sort_keys=True) + "\n", encoding="utf8")


def now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")


def backfills(source: dict) -> bool:
    """Whether items already in a source when it's added become lessons.

    Defaults: a single video or repo, and a YouTube playlist (your queue), yes;
    channels, feeds and GitHub users, no (only what's published after you add them).
    """
    if "backfill" in source:
        return bool(source["backfill"])
    url = source["url"]
    if source["type"] == "youtube":
        return "/@" not in url and "/channel/" not in url and "/c/" not in url and "/user/" not in url
    if source["type"] == "github":
        return connectors._repo_slug(url)[1] is not None
    return False


def new_items(sources: list[dict], state: dict, done: set[str]) -> list[tuple[dict, Item]]:
    """Items that need a lesson, oldest first per source. Records baselines in state."""
    queue: list[tuple[dict, Item]] = []
    seen_keys: set[str] = set()
    for source in sources:
        skey = connectors.source_key(source)
        try:
            items = connectors.discover(source)
        except Exception as exc:  # noqa: BLE001 - one broken source shouldn't stop the run
            print(f"! {skey}: couldn't list items ({type(exc).__name__}: {exc})", file=sys.stderr)
            continue
        if skey not in state["sources"]:
            state["sources"][skey] = {"added_at": now_iso()}
            if not backfills(source):
                for it in items:
                    state["items"].setdefault(it.key, {"status": "baseline", "at": now_iso()})
                print(f"  {skey}: new source, {len(items)} existing items marked as seen")
                continue
        for it in items:
            record = state["items"].get(it.key, {})
            if it.key in done or it.key in seen_keys or record.get("status") in ("baseline", "published", "skipped"):
                continue
            seen_keys.add(it.key)
            queue.append((source, it))
    return queue


def mark(state: dict, item: Item, status: str, **extra) -> None:
    record = state["items"].setdefault(item.key, {})
    record.update({"status": status, "at": now_iso(), "title": item.title, **extra})


# ---------------------------------------------------------------- CLI


def run(
    sources: list[dict],
    state: dict,
    *,
    limit: int,
    date: dt.date,
    posts_dir: Path = POSTS_DIR,
    dry_run: bool = False,
    writer=write_lesson,
    extractor=connectors.extract,
) -> list[Path]:
    queue = new_items(sources, state, done_ids(posts_dir))
    print(f"{len(queue)} new item(s) waiting" + (f"; writing up to {limit}" if not dry_run else ""))
    written: list[Path] = []
    for _source, item in queue:
        if dry_run:
            print(f"  new: {item.key}  {item.title}")
            continue
        if len(written) >= limit:
            break
        try:
            text = extractor(item)
        except ExtractError as exc:
            attempts = state["items"].get(item.key, {}).get("attempts", 0) + 1
            give_up = exc.permanent or attempts >= MAX_ATTEMPTS
            mark(state, item, "skipped" if give_up else "failed", reason=str(exc), attempts=attempts)
            print(f"! {item.key}: {exc}" + (" (giving up)" if give_up else " (will retry next run)"), file=sys.stderr)
            continue
        lesson = writer(item, text)
        path = save_post(item, lesson, date, posts_dir)
        mark(state, item, "published", file=path.name)
        written.append(path)
        print(f"wrote {path.relative_to(ROOT) if path.is_relative_to(ROOT) else path}")
    return written


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--sources", type=Path, default=SOURCES_FILE, help="sources file (default lessons/sources.yml)")
    p.add_argument("--url", action="append", default=[], help="a video, article feed or repo URL to do now (repeatable)")
    p.add_argument("--limit", type=int, help="most lessons to write this run (default: settings.max_per_run or 3)")
    p.add_argument("--date", type=dt.date.fromisoformat, default=dt.date.today(), help="post date (YYYY-MM-DD)")
    p.add_argument("--posts-dir", type=Path, default=POSTS_DIR)
    p.add_argument("--state", type=Path, default=STATE_FILE)
    p.add_argument("--dry-run", action="store_true", help="list new items without extracting or writing")
    args = p.parse_args(argv)

    if args.url:
        sources = [{"type": guess_type(u), "url": u, "backfill": True} for u in args.url]
        settings: dict = {}
    else:
        sources, settings = load_sources(args.sources)
        if not sources:
            print(f"No sources in {args.sources}.")
            return 0
    state = load_state(args.state)
    limit = args.limit or int(settings.get("max_per_run", 3))
    written = run(sources, state, limit=limit, date=args.date, posts_dir=args.posts_dir, dry_run=args.dry_run)
    if not args.dry_run:
        save_state(state, args.state)
    if not written and not args.dry_run:
        print("No new lessons this run.")
    return 0


def guess_type(url: str) -> str:
    host = re.sub(r"^https?://(www\.|m\.)?", "", url.lower()).split("/")[0]
    if host in ("youtube.com", "youtu.be") or connectors.VIDEO_ID_RE.match(url):
        return "youtube"
    if host == "github.com":
        return "github"
    if "medium.com" in host or url.startswith("@"):
        return "medium"
    if host.endswith("substack.com"):
        return "substack"
    return "rss"


if __name__ == "__main__":
    sys.exit(main())
