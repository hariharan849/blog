"""Email new lessons to Daily Dose subscribers.

Sends each lesson's title, summary and opening paragraph to the backend
(POST /lessons/announce), which emails every confirmed subscriber a short
version linking to the full lesson on the site. The backend remembers which
lessons it has sent, so running this twice for the same lesson is harmless.

Usage:
    python lessons/announce.py frontend/content/lessons/2026-11-27-some-lesson.md [...]

Needs FEED_API_URL (the backend's ApiUrl) and FEED_ADMIN_TOKEN. Does nothing
when either is missing, so the daily workflow can run before the backend is
deployed.
"""

from __future__ import annotations

import json
import os
import re
import sys
import urllib.request
from pathlib import Path

SNIPPET_WORDS = 70


def parse(path: Path) -> dict[str, str]:
    raw = path.read_text(encoding="utf8")
    m = re.match(r"^---\n(.*?)\n---\n(.*)$", raw, re.DOTALL)
    if not m:
        raise ValueError(f"{path}: missing front matter")
    front, body = m.groups()
    meta: dict[str, str] = {}
    for line in front.splitlines():
        key, _, value = line.partition(":")
        value = value.strip()
        if value.startswith('"'):
            try:
                value = json.loads(value)
            except json.JSONDecodeError:
                value = value.strip('"')
        meta[key.strip()] = value
    return {
        "slug": path.stem,
        "title": meta.get("title", path.stem),
        "summary": meta.get("summary", ""),
        "snippet": snippet(body),
    }


def snippet(body: str) -> str:
    """The first real paragraph, shortened to about SNIPPET_WORDS words."""
    for para in re.split(r"\n\s*\n", body):
        para = para.strip()
        if not para or para.startswith(("#", "*Lesson from", "-", ">", "|", "```")):
            continue
        text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", para)  # links -> text
        text = re.sub(r"[*_`]", "", text)
        text = re.sub(r"\s+", " ", text).strip()
        words = text.split(" ")
        return text if len(words) <= SNIPPET_WORDS else " ".join(words[:SNIPPET_WORDS]).rstrip(",;:") + "…"
    return ""


def announce(lesson: dict[str, str], api_url: str, token: str) -> str:
    req = urllib.request.Request(
        f"{api_url.rstrip('/')}/lessons/announce",
        data=json.dumps(lesson).encode(),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as res:
        return json.load(res).get("status", "")


def main(argv: list[str]) -> int:
    api_url, token = os.environ.get("FEED_API_URL", ""), os.environ.get("FEED_ADMIN_TOKEN", "")
    if not api_url or not token:
        print("FEED_API_URL or FEED_ADMIN_TOKEN not set; not emailing subscribers.")
        return 0
    for arg in argv:
        lesson = parse(Path(arg))
        print(f"{lesson['slug']}: {announce(lesson, api_url, token)}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
