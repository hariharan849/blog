"""Source resolution and a small, dependency-light RSS 2.0 / Atom parser."""
from __future__ import annotations

import hashlib
import html
import re
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

from defusedxml import ElementTree as ET

USER_AGENT = "DailyDoseBot/1.0 (+personal feed reader)"
MAX_BYTES = 5 * 1024 * 1024
KINDS = ("medium", "substack", "rss")

ATOM = "{http://www.w3.org/2005/Atom}"
CONTENT = "{http://purl.org/rss/1.0/modules/content/}encoded"
DC_CREATOR = "{http://purl.org/dc/elements/1.1/}creator"
MEDIA_THUMB = "{http://search.yahoo.com/mrss/}thumbnail"
MEDIA_CONTENT = "{http://search.yahoo.com/mrss/}content"


class SourceError(ValueError):
    """Raised when a source value can't be turned into a valid feed."""


@dataclass
class FeedEntry:
    url: str
    title: str
    author: str
    published_at: datetime | None
    excerpt: str
    image: str | None


@dataclass
class Feed:
    title: str
    site_url: str
    entries: list[FeedEntry]


# ---------------------------------------------------------------- resolution
def _ensure_url(value: str) -> str:
    value = value.strip()
    if "://" in value and not re.match(r"^https?://", value, re.I):
        raise SourceError("Only http(s) URLs are supported.")
    if not re.match(r"^https?://", value, re.I):
        value = "https://" + value
    parsed = urlparse(value)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise SourceError("Enter a valid http(s) URL.")
    return value


def resolve_feed_url(kind: str, value: str) -> str:
    """Turn what the user typed (username, URL, ...) into a feed URL."""
    value = (value or "").strip()
    if not value:
        raise SourceError("A username or URL is required.")
    if kind not in KINDS:
        raise SourceError(f"Unknown source type '{kind}'.")

    if kind == "medium":
        # Accepts: @user, user, medium.com/@user, user.medium.com, medium.com/publication
        if re.fullmatch(r"@?[\w.\-]+", value):
            return f"https://medium.com/feed/@{value.lstrip('@')}"
        parsed = urlparse(_ensure_url(value))
        host = parsed.netloc.lower().removeprefix("www.")
        path = parsed.path.strip("/").split("/")
        if host == "medium.com" and path and path[0]:
            if path[0] == "feed":
                return urlunparse(("https", host, parsed.path, "", "", ""))
            return f"https://medium.com/feed/{path[0]}"
        if host.endswith(".medium.com"):
            return f"https://medium.com/feed/@{host.split('.')[0]}"
        raise SourceError("Use a Medium username like @name or a medium.com URL.")

    if kind == "substack":
        # Accepts: name, name.substack.com, https://name.substack.com/..., custom domains
        if re.fullmatch(r"[\w\-]+", value):
            return f"https://{value.lower()}.substack.com/feed"
        parsed = urlparse(_ensure_url(value))
        return f"https://{parsed.netloc.lower()}/feed"

    return _ensure_url(value)


def source_id(feed_url: str) -> str:
    return hashlib.sha1(feed_url.lower().encode()).hexdigest()[:12]


def item_id(url: str) -> str:
    return hashlib.sha256(url.encode()).hexdigest()[:24]


# ------------------------------------------------------------------ fetching
def fetch(url: str, timeout: float = 15.0) -> bytes:
    req = urllib.request.Request(
        url,
        headers={"User-Agent": USER_AGENT, "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml, */*"},
    )
    with urllib.request.urlopen(req, timeout=timeout) as res:  # noqa: S310 - scheme validated in resolve_feed_url
        data = res.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise SourceError("Feed is too large.")
    return data


# ------------------------------------------------------------------- parsing
_TAG_RE = re.compile(r"<[^>]+>")
_TRACKING_EXACT = {"source", "sk", "gi", "ref", "fbclid", "gclid", "r", "triedredirect"}


def clean_text(markup: str | None, limit: int = 280) -> str:
    text = html.unescape(_TAG_RE.sub(" ", markup or ""))
    text = " ".join(text.split())
    if len(text) <= limit:
        return text
    return text[:limit].rsplit(" ", 1)[0].rstrip(",.;:") + "…"


def canonical_url(url: str) -> str:
    """Drop tracking query params so the same article dedupes across runs."""
    parsed = urlparse(url.strip())
    query = [
        (k, v)
        for k, v in parse_qsl(parsed.query)
        if not k.lower().startswith("utm_") and k.lower() not in _TRACKING_EXACT
    ]
    return urlunparse(parsed._replace(query=urlencode(query), fragment=""))


def _parse_date(value: str | None) -> datetime | None:
    if not value:
        return None
    value = value.strip()
    try:
        dt = parsedate_to_datetime(value)  # RFC 822 (RSS)
    except (TypeError, ValueError):
        try:
            dt = datetime.fromisoformat(value.replace("Z", "+00:00"))  # RFC 3339 (Atom)
        except ValueError:
            return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _text(el, path: str) -> str:
    found = el.find(path)
    return (found.text or "").strip() if found is not None and found.text else ""


def _first_img(markup: str) -> str | None:
    m = re.search(r'<img[^>]+src="([^"]+)"', markup or "")
    return html.unescape(m.group(1)) if m else None


def parse(data: bytes) -> Feed:
    try:
        root = ET.fromstring(data)
    except ET.ParseError as exc:
        raise SourceError("That URL did not return a valid RSS or Atom feed.") from exc

    if root.tag == f"{ATOM}feed":
        return _parse_atom(root)
    channel = root.find("channel")
    if root.tag == "rss" and channel is not None:
        return _parse_rss(channel)
    raise SourceError("That URL did not return a valid RSS or Atom feed.")


def _parse_rss(channel) -> Feed:
    feed_author = _text(channel, "title")
    entries = []
    for item in channel.findall("item"):
        link = _text(item, "link") or _text(item, "guid")
        if not link.startswith("http"):
            continue
        body = _text(item, CONTENT) or _text(item, "description")
        image = None
        for tag in (MEDIA_THUMB, MEDIA_CONTENT):
            el = item.find(tag)
            if el is not None and el.get("url"):
                image = el.get("url")
                break
        enclosure = item.find("enclosure")
        if not image and enclosure is not None and (enclosure.get("type") or "").startswith("image"):
            image = enclosure.get("url")
        entries.append(
            FeedEntry(
                url=canonical_url(link),
                title=clean_text(_text(item, "title"), 300) or "(untitled)",
                author=_text(item, DC_CREATOR) or _text(item, "author") or feed_author,
                published_at=_parse_date(_text(item, "pubDate") or _text(item, "{http://purl.org/dc/elements/1.1/}date")),
                excerpt=clean_text(_text(item, "description") or body),
                image=image or _first_img(body),
            )
        )
    return Feed(title=clean_text(feed_author, 200), site_url=_text(channel, "link"), entries=entries)


def _atom_link(el) -> str:
    links = el.findall(f"{ATOM}link")
    for link in links:
        if link.get("rel", "alternate") == "alternate" and link.get("href"):
            return link.get("href")
    return links[0].get("href", "") if links else ""


def _parse_atom(root) -> Feed:
    feed_author = _text(root, f"{ATOM}author/{ATOM}name") or _text(root, f"{ATOM}title")
    entries = []
    for entry in root.findall(f"{ATOM}entry"):
        link = _atom_link(entry)
        if not link.startswith("http"):
            continue
        body = _text(entry, f"{ATOM}content") or _text(entry, f"{ATOM}summary")
        entries.append(
            FeedEntry(
                url=canonical_url(link),
                title=clean_text(_text(entry, f"{ATOM}title"), 300) or "(untitled)",
                author=_text(entry, f"{ATOM}author/{ATOM}name") or feed_author,
                published_at=_parse_date(_text(entry, f"{ATOM}published") or _text(entry, f"{ATOM}updated")),
                excerpt=clean_text(_text(entry, f"{ATOM}summary") or body),
                image=_first_img(body),
            )
        )
    return Feed(title=clean_text(_text(root, f"{ATOM}title"), 200), site_url=_atom_link(root), entries=entries)


def load(feed_url: str) -> Feed:
    return parse(fetch(feed_url))
