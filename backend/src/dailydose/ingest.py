"""Scheduled Lambda: fetch every enabled source, store new posts, email the digest."""
from __future__ import annotations

import json
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from typing import Any

from aws_lambda_powertools import Logger

from . import digest, feeds
from .config import secret, settings
from .store import Store, now_iso

logger = Logger(service="dailydose-ingest")


def _collect(source: dict[str, Any]) -> tuple[dict[str, Any], feeds.Feed | None, str | None]:
    try:
        return source, feeds.load(source["feed_url"]), None
    except Exception as exc:  # one bad feed must not break the run
        return source, None, f"{type(exc).__name__}: {exc}"[:300]


def run(store: Store | None = None, now: datetime | None = None) -> dict[str, Any]:
    cfg = settings()
    store = store or Store()
    now = now or datetime.now(timezone.utc)
    day = now.astimezone(cfg.timezone).date().isoformat()
    cutoff = now - timedelta(hours=cfg.lookback_hours)

    sources = [s for s in store.list_sources() if s.get("enabled", True)]
    new_items: list[dict[str, Any]] = []
    errors = 0

    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(_collect, sources))

    for source, feed, error in results:
        if error:
            errors += 1
            logger.warning("feed failed", extra={"source": source["id"], "error": error})
            store.update_source(source["id"], last_checked_at=now_iso(), last_error=error)
            continue

        added = 0
        for entry in feed.entries:
            published = entry.published_at or now
            if published < cutoff:
                continue
            item = {
                "id": feeds.item_id(entry.url),
                "url": entry.url,
                "title": entry.title,
                "author": entry.author or source.get("title", ""),
                "excerpt": entry.excerpt,
                "image": entry.image,
                "published_at": published.astimezone(timezone.utc).isoformat(timespec="seconds"),
                "source_id": source["id"],
                "source_title": source.get("title") or feed.title,
                "kind": source["kind"],
                "day": day,
                "fetched_at": now_iso(),
            }
            item = {k: v for k, v in item.items() if v not in (None, "")}
            if store.put_item_if_new(item):
                added += 1
                new_items.append(item)
        store.update_source(
            source["id"], last_checked_at=now_iso(), last_error="", last_new_count=added
        )

    if new_items:
        store.bump_day(day, len(new_items))

    emailed = False
    try:
        emailed = digest.send(day, sorted(new_items, key=lambda i: i["published_at"], reverse=True))
    except Exception:
        logger.exception("digest email failed")

    if new_items:
        _revalidate(day)

    summary = {"day": day, "sources": len(sources), "new_items": len(new_items), "errors": errors, "emailed": emailed}
    logger.info("ingest finished", extra=summary)
    return summary


def _revalidate(day: str) -> None:
    cfg = settings()
    if not cfg.revalidate_url:
        return
    try:
        req = urllib.request.Request(
            cfg.revalidate_url,
            data=json.dumps({"day": day}).encode(),
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {secret(cfg.revalidate_secret_param)}"},
            method="POST",
        )
        urllib.request.urlopen(req, timeout=10).close()  # noqa: S310 - fixed https URL from config
    except Exception:
        logger.exception("frontend revalidation failed")


@logger.inject_lambda_context
def handler(event, context):
    return run()
