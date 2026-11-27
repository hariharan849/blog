"""Source connectors: find new items in a source and pull out their plain text.

Each source in lessons/sources.yml has a `type`:

    youtube   a video, playlist or channel URL. Text = the video's transcript.
    substack  a Substack name or URL.            Text = the post body.
    medium    a Medium @username or URL.         Text = the post body.
    rss       any RSS / Atom feed URL.           Text = the post body.
    github    a GitHub user/org (each new public repo) or one repo URL.
              Text = a snapshot of the repo (file tree, README, manifests and
              the main source files), which Claude turns into an
              architecture-only post.

Extraction for videos and articles is plain text only (transcripts via youtube-transcript-api, with
yt-dlp as a fallback; articles from the feed body or the page via trafilatura).
Claude is only used afterwards, to write the lesson.

YouTube blocks transcript requests from many cloud servers ("confirm you're
not a bot"). To get past that, set one of:
    YOUTUBE_PROXY_URL        http(s) proxy for YouTube requests (residential works best)
    WEBSHARE_PROXY_USERNAME  + WEBSHARE_PROXY_PASSWORD for a Webshare rotating residential proxy
    YOUTUBE_COOKIES_FILE     a cookies.txt exported from a signed-in browser (used by the yt-dlp fallback)
"""

from __future__ import annotations

import html
import json
import os
import re
import sys
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend" / "src"))

from dailydose import feeds  # noqa: E402  (shared RSS/Atom parser and source resolution)

VIDEO_ID_RE = re.compile(r"^[A-Za-z0-9_-]{11}$")
MIN_ARTICLE_WORDS = 150  # below this, the feed only has a teaser; fetch the page instead


class ExtractError(Exception):
    """The item has no usable text. `permanent` means retrying won't help."""

    def __init__(self, message: str, permanent: bool = False):
        super().__init__(message)
        self.permanent = permanent


@dataclass
class Item:
    key: str  # stable id used to skip duplicates: youtube:<id> or web:<canonical url>
    kind: str  # "video" or "article"
    url: str
    title: str
    author: str = ""
    published: str = ""  # ISO timestamp when known
    video_id: str = ""
    repo: str = ""  # owner/name for GitHub repositories
    content: str = field(default="", repr=False)  # article body markup from the feed, if any


def source_key(source: dict) -> str:
    return f"{source['type']}:{source['url']}"


def discover(source: dict) -> list[Item]:
    """Items currently in the source, oldest first."""
    kind = source["type"]
    if kind == "youtube":
        return youtube_items(source["url"])
    if kind in feeds.KINDS:
        return feed_items(kind, source["url"])
    if kind == "github":
        return github_items(source["url"])
    raise ValueError(f"Unknown source type {kind!r} (use youtube, substack, medium or rss)")


def extract(item: Item) -> str:
    if item.kind == "video":
        return youtube_transcript(item.video_id)
    if item.kind == "repo":
        return repo_snapshot(item.repo)
    return article_text(item)


# ------------------------------------------------------------------ YouTube


def video_id(url_or_id: str) -> str | None:
    """The 11-character id from a bare id or any common video URL, else None."""
    s = url_or_id.strip()
    if VIDEO_ID_RE.match(s):
        return s
    u = urllib.parse.urlparse(s)
    host = (u.hostname or "").lower()
    cand = ""
    if host == "youtu.be":
        cand = u.path.lstrip("/").split("/")[0]
    elif host.endswith("youtube.com"):
        q = urllib.parse.parse_qs(u.query)
        if "v" in q:
            cand = q["v"][0]
        else:
            parts = [p for p in u.path.split("/") if p]
            if len(parts) >= 2 and parts[0] in ("shorts", "embed", "live", "v"):
                cand = parts[1]
    return cand if VIDEO_ID_RE.match(cand) else None


def _video_item(vid: str, title: str = "", author: str = "", published: str = "") -> Item:
    url = f"https://www.youtube.com/watch?v={vid}"
    if not title:
        title, author = _oembed(vid)
    return Item(f"youtube:{vid}", "video", url, title or vid, author, published, video_id=vid)


def _oembed(vid: str) -> tuple[str, str]:
    url = "https://www.youtube.com/oembed?format=json&url=" + urllib.parse.quote(
        f"https://www.youtube.com/watch?v={vid}", safe=""
    )
    try:
        with urllib.request.urlopen(url, timeout=20) as r:
            data = json.load(r)
        return data.get("title", ""), data.get("author_name", "")
    except Exception:  # noqa: BLE001 - title is nice to have
        return "", ""


def youtube_items(url: str) -> list[Item]:
    """A single video, or every video in a playlist or channel (oldest first)."""
    # A video link means just that video, even when it was opened from a
    # playlist ("watch?v=X&list=Y"). Use a /playlist?list=Y link for the playlist.
    vid = video_id(url)
    if vid:
        return [_video_item(vid)]
    try:
        return _ytdlp_list(url)
    except Exception as exc:  # noqa: BLE001 - fall back to YouTube's public RSS (latest 15)
        print(f"yt-dlp couldn't list {url} ({type(exc).__name__}); trying the RSS feed", file=sys.stderr)
        return _youtube_rss(url)


def _ytdlp_opts() -> dict:
    opts: dict = {"quiet": True, "no_warnings": True, "skip_download": True}
    if os.environ.get("YOUTUBE_PROXY_URL"):
        opts["proxy"] = os.environ["YOUTUBE_PROXY_URL"]
    if os.environ.get("YOUTUBE_COOKIES_FILE"):
        opts["cookiefile"] = os.environ["YOUTUBE_COOKIES_FILE"]
    return opts


def _ytdlp_list(url: str) -> list[Item]:
    import yt_dlp

    with yt_dlp.YoutubeDL({**_ytdlp_opts(), "extract_flat": True}) as ydl:
        info = ydl.extract_info(url, download=False)
    entries = list(info.get("entries") or [])
    # A channel URL returns tabs (Videos, Shorts, ...); flatten one level.
    if entries and all(e.get("_type") == "playlist" for e in entries if e):
        entries = [v for tab in entries if tab for v in (tab.get("entries") or [])]
    items = [
        _video_item(e["id"], e.get("title") or e["id"], e.get("channel") or e.get("uploader") or info.get("uploader") or "")
        for e in entries
        if e and VIDEO_ID_RE.match(str(e.get("id", "")))
    ]
    # Channels list newest first; playlists are in the owner's order, which we keep.
    return items[::-1] if "/@" in url or "/channel/" in url else items


def _youtube_rss(url: str) -> list[Item]:
    q = urllib.parse.parse_qs(urllib.parse.urlparse(url).query)
    if "list" in q:
        feed_url = f"https://www.youtube.com/feeds/videos.xml?playlist_id={q['list'][0]}"
    elif m := re.search(r"/channel/(UC[\w-]{22})", url):
        feed_url = f"https://www.youtube.com/feeds/videos.xml?channel_id={m.group(1)}"
    else:
        raise ValueError(f"Can't list videos for {url}")
    feed = feeds.load(feed_url)
    items = []
    for e in feed.entries:
        vid = video_id(e.url)
        if vid:
            published = e.published_at.isoformat() if e.published_at else ""
            items.append(_video_item(vid, e.title, e.author, published))
    return items[::-1]


def _transcript_api():
    from youtube_transcript_api import YouTubeTranscriptApi
    from youtube_transcript_api.proxies import GenericProxyConfig, WebshareProxyConfig

    if os.environ.get("WEBSHARE_PROXY_USERNAME"):
        proxy = WebshareProxyConfig(os.environ["WEBSHARE_PROXY_USERNAME"], os.environ.get("WEBSHARE_PROXY_PASSWORD", ""))
    elif os.environ.get("YOUTUBE_PROXY_URL"):
        proxy = GenericProxyConfig(os.environ["YOUTUBE_PROXY_URL"], os.environ["YOUTUBE_PROXY_URL"])
    else:
        proxy = None
    return YouTubeTranscriptApi(proxy_config=proxy)


def _clean(text: str) -> str:
    text = re.sub(r"\[(?:music|applause|laughter|♪+)\]", " ", text, flags=re.I)
    return re.sub(r"\s+", " ", text).strip()


def youtube_transcript(vid: str) -> str:
    """Transcript text, in English where YouTube has or can translate to it."""
    from youtube_transcript_api import _errors as yte

    permanent = (yte.TranscriptsDisabled, yte.NoTranscriptFound, yte.VideoUnavailable)
    try:
        listing = _transcript_api().list(vid)
        try:
            chosen = listing.find_transcript(["en", "en-US", "en-GB"])
        except yte.NoTranscriptFound:
            chosen = next(iter(listing))
            if chosen.is_translatable and not chosen.language_code.startswith("en"):
                chosen = chosen.translate("en")
        return _clean(" ".join(s.text for s in chosen.fetch().snippets))
    except permanent as exc:
        raise ExtractError(f"no captions ({type(exc).__name__})", permanent=True) from exc
    except Exception as exc:  # noqa: BLE001 - blocked or network: try yt-dlp before giving up
        first = exc
    try:
        return _ytdlp_transcript(vid)
    except Exception as exc:  # noqa: BLE001
        raise ExtractError(
            f"YouTube refused the transcript ({type(first).__name__}; yt-dlp: {type(exc).__name__}). "
            "Set YOUTUBE_PROXY_URL, WEBSHARE_PROXY_* or YOUTUBE_COOKIES_FILE."
        ) from exc


def _ytdlp_transcript(vid: str) -> str:
    import yt_dlp

    with yt_dlp.YoutubeDL(_ytdlp_opts()) as ydl:
        info = ydl.extract_info(f"https://www.youtube.com/watch?v={vid}", download=False)
        tracks = {**(info.get("automatic_captions") or {}), **(info.get("subtitles") or {})}
        lang = next((k for k in ("en", "en-US", "en-GB", "en-orig") if k in tracks), None)
        if not lang:
            raise ExtractError("no English captions", permanent=True)
        fmt = next((f for f in tracks[lang] if f.get("ext") == "json3"), None)
        if not fmt:
            raise ExtractError("no json3 captions")
        data = json.loads(ydl.urlopen(fmt["url"]).read())
    words = [seg.get("utf8", "") for ev in data.get("events", []) for seg in ev.get("segs") or []]
    return _clean(" ".join(words))


# ------------------------------------------------------------------ Articles


def feed_items(kind: str, value: str) -> list[Item]:
    feed = feeds.load(feeds.resolve_feed_url(kind, value))
    items = [
        Item(
            key=f"web:{e.url}",
            kind="article",
            url=e.url,
            title=e.title,
            author=e.author,
            published=e.published_at.isoformat() if e.published_at else "",
            content=e.content,
        )
        for e in feed.entries
    ]
    return sorted(items, key=lambda i: i.published)  # oldest first


def html_to_text(markup: str) -> str:
    """Readable text from article markup, keeping paragraph breaks."""
    try:
        import trafilatura

        text = trafilatura.extract(f"<html><body><article>{markup}</article></body></html>", include_comments=False)
        if text and len(text.split()) >= 30:
            return text.strip()
    except ImportError:
        pass
    markup = re.sub(r"(?is)<(script|style|figure|figcaption)[^>]*>.*?</\1>", " ", markup)
    markup = re.sub(r"(?i)</(p|h[1-6]|li|blockquote|pre)>|<br\s*/?>", "\n\n", markup)
    text = html.unescape(re.sub(r"<[^>]+>", " ", markup))
    return "\n\n".join(" ".join(p.split()) for p in text.split("\n\n") if p.strip())


def article_text(item: Item) -> str:
    text = html_to_text(item.content) if item.content else ""
    if len(text.split()) >= MIN_ARTICLE_WORDS:
        return text
    try:
        import trafilatura

        page = trafilatura.fetch_url(item.url)
        full = trafilatura.extract(page or "", include_comments=False) or ""
    except Exception as exc:  # noqa: BLE001
        raise ExtractError(f"couldn't fetch the article ({type(exc).__name__})") from exc
    if len(full.split()) > len(text.split()):
        text = full.strip()
    if len(text.split()) < MIN_ARTICLE_WORDS:
        raise ExtractError("only a short teaser is available (paywalled?)", permanent=True)
    return text


# ------------------------------------------------------------------- GitHub

GITHUB_API = "https://api.github.com"
SNAPSHOT_CHARS = 180_000  # roughly 45k tokens of code and docs per repo
SKIP_DIRS = {
    ".git", "node_modules", "vendor", "dist", "build", "out", "target", ".next", "__pycache__",
    ".venv", "venv", "env", "coverage", ".idea", ".vscode", "site-packages", "third_party",
}
SKIP_FILES = re.compile(
    r"(\.lock|lock\.json|\.min\.js|\.map|\.svg|\.png|\.jpe?g|\.gif|\.ico|\.webp|\.pdf|\.zip|\.gz"
    r"|\.woff2?|\.ttf|\.mp4|\.mp3|\.wav|\.bin|\.pt|\.onnx|\.h5|\.pkl|\.parquet|\.db|\.sqlite3?|\.ipynb)$",
    re.I,
)
MANIFESTS = re.compile(
    r"(^|/)(readme(\.\w+)?|package\.json|pyproject\.toml|setup\.py|setup\.cfg|requirements[\w.-]*\.txt|go\.mod|cargo\.toml"
    r"|pom\.xml|build\.gradle(\.kts)?|gemfile|composer\.json|dockerfile|docker-compose[\w.-]*\.ya?ml|compose\.ya?ml"
    r"|makefile|template\.ya?ml|serverless\.ya?ml|.*\.tf|architecture\.md|design\.md|claude\.md|agents\.md)$",
    re.I,
)
ENTRY_POINTS = re.compile(r"(^|/)(main|app|index|server|cli|api|__main__|routes?|handler|manage)\.\w+$", re.I)
CODE = re.compile(r"\.(py|ts|tsx|js|jsx|mjs|go|rs|java|kt|scala|rb|php|cs|cpp|cc|c|h|hpp|swift|sql|proto|graphql|ya?ml|toml)$", re.I)


def _gh(path: str, raw: bool = False):
    headers = {"Accept": "application/vnd.github+json", "User-Agent": "daily-lessons"}
    if os.environ.get("GITHUB_TOKEN"):
        headers["Authorization"] = f"Bearer {os.environ['GITHUB_TOKEN']}"
    req = urllib.request.Request(path if path.startswith("http") else GITHUB_API + path, headers=headers)
    with urllib.request.urlopen(req, timeout=60) as res:  # noqa: S310 - fixed https host
        data = res.read()
    return data if raw else json.loads(data)


def _repo_slug(url: str) -> tuple[str, str | None]:
    """("owner", "repo") from a GitHub URL or "owner/repo"; repo is None for a user/org."""
    s = url.strip().removesuffix(".git").rstrip("/")
    s = re.sub(r"^(https?://)?(www\.)?github\.com/", "", s, flags=re.I)
    parts = [p for p in s.split("/") if p]
    if not parts or not re.fullmatch(r"[\w.-]+", parts[0]):
        raise ValueError(f"Not a GitHub user, org or repository: {url}")
    return parts[0], (parts[1] if len(parts) > 1 else None)


def _repo_item(r: dict) -> Item:
    return Item(
        key=f"github:{r['full_name'].lower()}",
        kind="repo",
        url=r["html_url"],
        title=r["full_name"],
        author=r.get("owner", {}).get("login", ""),
        published=r.get("created_at", ""),
        repo=r["full_name"],
    )


def github_items(url: str) -> list[Item]:
    """One repo, or a user's/org's public, non-fork, non-archived repos (oldest first)."""
    owner, repo = _repo_slug(url)
    if repo:
        return [_repo_item(_gh(f"/repos/{owner}/{repo}"))]
    repos = _gh(f"/users/{owner}/repos?type=owner&sort=created&direction=desc&per_page=50")
    keep = [r for r in repos if not r.get("fork") and not r.get("archived") and not r.get("private")]
    return [_repo_item(r) for r in sorted(keep, key=lambda r: r.get("created_at", ""))]


def _priority(path: str) -> tuple[int, int, str]:
    depth = path.count("/")
    if MANIFESTS.search(path):
        rank = 0
    elif ENTRY_POINTS.search(path):
        rank = 1
    elif re.search(r"(^|/)(test|tests|spec|__tests__|examples?|docs?|fixtures?|migrations?)/|\.(test|spec)\.", path, re.I):
        rank = 4
    elif CODE.search(path):
        rank = 2 if depth <= 2 else 3
    else:
        rank = 5
    return rank, depth, path


def build_snapshot(files: dict[str, str], repo: str, description: str = "", budget: int = SNAPSHOT_CHARS) -> str:
    """Tree plus the most telling files, within a character budget."""
    paths = sorted(files)
    tree = "\n".join(paths[:1500]) + (f"\n... and {len(paths) - 1500} more files" if len(paths) > 1500 else "")
    parts = [f"Repository: {repo}", f"Description: {description or '(none)'}", "", "<file_tree>", tree, "</file_tree>"]
    used = sum(len(p) for p in parts)
    skipped = 0
    for path in sorted(paths, key=_priority):
        if _priority(path)[0] == 5:
            continue
        body = files[path]
        if len(body) > 40_000:
            body = body[:40_000] + "\n... (truncated)"
        block = f'\n<file path="{path}">\n{body}\n</file>'
        if used + len(block) > budget:
            skipped += 1
            continue
        parts.append(block)
        used += len(block)
    if skipped:
        parts.append(f"\n({skipped} more files left out to keep the snapshot short)")
    return "\n".join(parts)


def repo_snapshot(full_name: str) -> str:
    """Downloads the default branch as a tarball and builds a snapshot for Claude."""
    import io
    import tarfile

    info = _gh(f"/repos/{full_name}")
    try:
        data = _gh(f"/repos/{full_name}/tarball", raw=True)
    except Exception as exc:  # noqa: BLE001
        raise ExtractError(f"couldn't download {full_name} ({type(exc).__name__})") from exc
    files: dict[str, str] = {}
    with tarfile.open(fileobj=io.BytesIO(data), mode="r:gz") as tar:
        for m in tar:
            if not m.isfile() or m.size > 300_000:
                continue
            path = m.name.split("/", 1)[1] if "/" in m.name else m.name
            if any(part in SKIP_DIRS for part in path.split("/")[:-1]) or SKIP_FILES.search(path):
                continue
            raw = tar.extractfile(m).read()
            if b"\0" in raw[:4096]:
                continue  # binary
            files[path] = raw.decode("utf8", errors="replace")
    if not files:
        raise ExtractError("the repository has no readable files", permanent=True)
    return build_snapshot(files, full_name, info.get("description") or "")
