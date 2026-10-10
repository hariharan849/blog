"""Resolve the feeds of writers/publications you follow and pull new articles from them.

Only public RSS/Atom feeds are read (plus, optionally, the public article page when robots.txt
allows it). Member-only and paywalled content is never bypassed.
"""
import calendar
import csv
import io
import logging
import re
import urllib.request
import urllib.robotparser
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone as dt_timezone
from html.parser import HTMLParser
from urllib.parse import parse_qsl, urlencode, urljoin, urlsplit, urlunsplit

import feedparser
from django.conf import settings
from django.utils import timezone

from blog.search.text import html_to_text

from ..models import Article, Source

logger = logging.getLogger(__name__)

TRACKING_PARAMS = {"source", "sk", "ref", "ref_src", "r", "s", "triedRedirect", "publication_id", "post_id"}
FEED_PATH = re.compile(r"(/feed/?|/rss/?|/atom/?|\.xml|\.rss|\.atom)$", re.IGNORECASE)
SHORT_FEED_WORDS = 300


def _config():
    return settings.DAILY_BYTES


def canonical_url(url):
    """Drop tracking parameters and fragments so the same post is only stored once."""
    parts = urlsplit(url.strip())
    query = [
        (key, value) for key, value in parse_qsl(parts.query, keep_blank_values=True)
        if not key.lower().startswith("utm_") and key not in TRACKING_PARAMS
    ]
    return urlunsplit((parts.scheme.lower() or "https", parts.netloc.lower(), parts.path, urlencode(query), ""))


def kind_for_host(host):
    host = host.lower()
    if host.endswith("substack.com"):
        return Source.Kind.SUBSTACK
    if host in ("pub.towardsai.net", "towardsai.net"):
        return Source.Kind.TOWARDS_AI
    if host == "medium.com" or host.endswith(".medium.com"):
        return Source.Kind.MEDIUM
    return Source.Kind.RSS


def resolve_feed_url(url):
    """Map a profile/publication URL to ``(feed_url, kind)``.

    Handles Substack (``name.substack.com``), Medium users (``medium.com/@user``,
    ``user.medium.com``), publications (``medium.com/pub``), tags (``medium.com/tag/x``),
    Towards AI, and anything that already is a feed. Other sites are auto-discovered from their
    ``<link rel="alternate">`` tag, falling back to ``<site>/feed`` (Substack custom domains,
    WordPress, Ghost).
    """
    url = url.strip()
    if "://" not in url:
        url = f"https://{url}"
    parts = urlsplit(url)
    host = parts.netloc.lower()
    path = parts.path.rstrip("/")
    kind = kind_for_host(host)
    origin = f"https://{host}"

    if FEED_PATH.search(parts.path) or path.startswith("/feed"):
        return urlunsplit(("https", host, parts.path, parts.query, "")), kind
    if kind == Source.Kind.SUBSTACK or kind == Source.Kind.TOWARDS_AI:
        return f"{origin}/feed", kind
    if host == "medium.com":
        segments = [segment for segment in path.split("/") if segment]
        if not segments:
            raise ValueError("Use a Medium profile, publication or tag URL, not the Medium home page.")
        if segments[0] == "tag" and len(segments) > 1:
            return f"https://medium.com/feed/tag/{segments[1]}", kind
        return f"https://medium.com/feed/{segments[0]}", kind
    if kind == Source.Kind.MEDIUM:  # user.medium.com or a publication subdomain
        return f"{origin}/feed", kind

    discovered = discover_feed(url)
    return (discovered or f"{origin}{path}/feed"), kind


class _FeedLinkFinder(HTMLParser):
    FEED_TYPES = {"application/rss+xml", "application/atom+xml", "application/feed+json"}

    def __init__(self):
        super().__init__()
        self.href = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if (
            self.href is None and tag == "link"
            and "alternate" in (attrs.get("rel") or "").lower()
            and (attrs.get("type") or "").lower() in self.FEED_TYPES
        ):
            self.href = attrs.get("href")


def _get(url, timeout=15):
    request = urllib.request.Request(url, headers={"User-Agent": _config()["USER_AGENT"]})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read().decode(response.headers.get_content_charset() or "utf-8", errors="replace")


def discover_feed(url):
    try:
        finder = _FeedLinkFinder()
        finder.feed(_get(url))
    except Exception as exc:
        logger.warning("Feed discovery failed for %s: %s", url, exc)
        return None
    return urljoin(url, finder.href) if finder.href else None


def default_name(site_url):
    parts = urlsplit(site_url)
    return parts.netloc + parts.path.rstrip("/")


def add_source(url, feed_url=None, name=""):
    """Create (or return) the Source for ``url``. Returns ``(source, created)``."""
    if feed_url:
        kind = kind_for_host(urlsplit(feed_url).netloc)
    else:
        feed_url, kind = resolve_feed_url(url)
    site = url if "://" in url else f"https://{url}"
    return Source.objects.get_or_create(
        feed_url=feed_url,
        defaults={"name": (name or default_name(site))[:200], "kind": kind, "site_url": site},
    )


def parse_source_list(content, filename=""):
    """Parse an OPML export, a CSV (first column) or plain text (one URL per line).

    Returns ``[(site_url, feed_url_or_None, name)]``.
    """
    stripped = content.lstrip()
    if filename.lower().endswith((".opml", ".xml")) or stripped.startswith(("<?xml", "<opml")):
        entries = []
        for outline in ET.fromstring(stripped.encode()).iter("outline"):
            feed_url = outline.get("xmlUrl")
            site_url = outline.get("htmlUrl") or feed_url
            if feed_url or site_url:
                entries.append((site_url, feed_url, outline.get("title") or outline.get("text") or ""))
        return entries
    entries = []
    for row in csv.reader(io.StringIO(content)):
        if row and row[0].strip() and not row[0].strip().startswith("#") and "." in row[0]:
            entries.append((row[0].strip(), None, row[1].strip() if len(row) > 1 else ""))
    return entries


def import_sources(content, filename=""):
    """Add every source in an OPML/CSV/text list. Returns ``(created, existing, errors)``."""
    created, existing, errors = [], [], []
    for site_url, feed_url, name in parse_source_list(content, filename):
        try:
            source, is_new = add_source(site_url, feed_url=feed_url, name=name)
        except Exception as exc:
            errors.append(f"{site_url}: {exc}")
            continue
        (created if is_new else existing).append(source)
    return created, existing, errors


def _entry_datetime(entry):
    for key in ("published_parsed", "updated_parsed"):
        value = entry.get(key)
        if value:
            return datetime.fromtimestamp(calendar.timegm(value), tz=dt_timezone.utc)
    return None


def _entry_html(entry):
    contents = entry.get("content") or []
    best = max((item.get("value", "") for item in contents), key=len, default="")
    return best or entry.get("summary", "")


def robots_allows(url):
    parts = urlsplit(url)
    parser = urllib.robotparser.RobotFileParser(f"{parts.scheme}://{parts.netloc}/robots.txt")
    try:
        parser.read()
    except Exception:
        return False
    return parser.can_fetch(_config()["USER_AGENT"], url)


def fetch_full_text(url):
    """Fetch a public article page if robots.txt allows; returns HTML or ``""``."""
    if not robots_allows(url):
        return ""
    try:
        return _get(url)
    except Exception as exc:
        logger.info("Full-text fetch failed for %s: %s", url, exc)
        return ""


def fetch_source(source, now=None):
    """Pull new entries from one feed. Returns the number of new articles stored."""
    now = now or timezone.now()
    cutoff = now - timedelta(days=_config()["MAX_ARTICLE_AGE_DAYS"])
    parsed = feedparser.parse(
        source.feed_url, etag=source.etag or None, modified=source.modified or None,
        agent=_config()["USER_AGENT"],
    )
    source.last_fetched_at = now
    status = parsed.get("status")
    if status == 304:
        source.last_error = ""
        source.save(update_fields=["last_fetched_at", "last_error"])
        return 0
    if (status and status >= 400) or (parsed.get("bozo") and not parsed.entries):
        reason = parsed.get("bozo_exception") or f"HTTP {status}"
        source.last_error = f"Could not read feed: {reason}"
        source.save(update_fields=["last_fetched_at", "last_error"])
        return 0

    created = 0
    for entry in parsed.entries:
        link = entry.get("link")
        if not link:
            continue
        published = _entry_datetime(entry)
        if published and published < cutoff:
            continue
        url = canonical_url(link)
        if Article.objects.filter(url=url).exists():
            continue
        html = _entry_html(entry)
        text = html_to_text(html)
        if len(text.split()) < SHORT_FEED_WORDS and _config()["FETCH_FULL_TEXT"]:
            page = fetch_full_text(link)
            if page and len(html_to_text(page).split()) > len(text.split()):
                html, text = page, html_to_text(page)
        Article.objects.create(
            source=source, url=url, guid=entry.get("id", "")[:1000], title=(entry.get("title") or url)[:500],
            author=(entry.get("author") or "")[:200], published_at=published or now,
            content_html=html, content_text=text, word_count=len(text.split()),
            feed_categories=[tag.get("term") for tag in entry.get("tags", []) if tag.get("term")][:20],
        )
        created += 1

    feed_title = parsed.feed.get("title")
    if feed_title and source.name in ("", default_name(source.site_url or source.feed_url)):
        source.name = feed_title[:200]
    source.etag = parsed.get("etag") or ""
    source.modified = parsed.get("modified") or ""
    source.last_error = ""
    source.save()
    return created


def fetch_all(sources=None):
    """Fetch every active source; one broken feed never stops the rest. Returns ``(new, failed)``."""
    sources = sources if sources is not None else Source.objects.filter(is_active=True)
    new = failed = 0
    for source in sources:
        try:
            new += fetch_source(source)
        except Exception as exc:
            logger.exception("Fetching %s failed", source.feed_url)
            source.last_error = str(exc)[:2000]
            source.last_fetched_at = timezone.now()
            source.save(update_fields=["last_error", "last_fetched_at"])
        if source.last_error:
            failed += 1
    return new, failed
