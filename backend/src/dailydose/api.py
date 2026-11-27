"""HTTP API Lambda.

Public:  GET /feed[?day=YYYY-MM-DD]   GET /feed/days[?limit=&before=]
         POST /subscribe {email}   POST /subscribe/confirm {id, token}   POST /unsubscribe {id, token}
Admin (Authorization: Bearer <admin token>):
         GET /sources   POST /sources   PATCH /sources/{id}   DELETE /sources/{id}
         POST /ingest   (runs the daily job now, asynchronously)
         GET /subscribers   (counts only)
         POST /lessons/announce {slug, title, summary, snippet}   (emails a new lesson to subscribers)
"""
from __future__ import annotations

import hmac
import json
import re
from typing import Any

import boto3
from aws_lambda_powertools import Logger
from aws_lambda_powertools.event_handler import APIGatewayHttpResolver, Response
from aws_lambda_powertools.event_handler.exceptions import (
    BadRequestError,
    NotFoundError,
    UnauthorizedError,
)

from datetime import datetime, timedelta, timezone

from . import feeds, subscriptions
from .config import secret, settings
from .store import Store, now_iso

logger = Logger(service="dailydose-api")
app = APIGatewayHttpResolver()
DAY_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

_store: Store | None = None


def store() -> Store:
    global _store
    if _store is None:
        _store = Store()
    return _store


def _json(status: int, body: Any, cache: str = "no-store") -> Response:
    return Response(
        status_code=status,
        content_type="application/json",
        body=json.dumps(body),
        headers={"Cache-Control": cache},
    )


def _require_admin() -> None:
    expected = secret(settings().admin_token_param)
    header = app.current_event.headers.get("authorization", "")
    token = header[7:] if header.lower().startswith("bearer ") else ""
    if not expected or not token or not hmac.compare_digest(token, expected):
        raise UnauthorizedError("Unauthorized")


def _body() -> dict[str, Any]:
    try:
        body = app.current_event.json_body or {}
    except json.JSONDecodeError as exc:
        raise BadRequestError("Invalid JSON body") from exc
    if not isinstance(body, dict):
        raise BadRequestError("Expected a JSON object")
    return body


# --------------------------------------------------------------- public
@app.get("/feed")
def get_feed():
    day = app.current_event.get_query_string_value("day", "") or ""
    if day and not DAY_RE.match(day):
        raise BadRequestError("day must be YYYY-MM-DD")
    if not day:
        latest = store().list_days(limit=1)
        if not latest:
            return _json(200, {"day": None, "items": [], "prev_day": None, "next_day": None}, "public, max-age=60")
        day = latest[0]["day"]
    prev_day, next_day = store().neighbour_days(day)
    return _json(
        200,
        {"day": day, "items": store().items_for_day(day), "prev_day": prev_day, "next_day": next_day},
        "public, max-age=300",
    )


@app.get("/feed/days")
def get_days():
    try:
        limit = max(1, min(int(app.current_event.get_query_string_value("limit", "30")), 100))
    except ValueError:
        limit = 30
    before = app.current_event.get_query_string_value("before", "") or None
    if before and not DAY_RE.match(before):
        raise BadRequestError("before must be YYYY-MM-DD")
    return _json(200, {"days": store().list_days(limit=limit, before=before)}, "public, max-age=300")


# ---------------------------------------------------------------- admin
@app.get("/sources")
def list_sources():
    _require_admin()
    return _json(200, {"sources": store().list_sources()})


@app.post("/sources")
def add_source():
    _require_admin()
    body = _body()
    kind = str(body.get("kind", "")).strip().lower()
    value = str(body.get("value", "")).strip()
    feed_url = ""
    try:
        feed_url = feeds.resolve_feed_url(kind, value)
        feed = feeds.load(feed_url)
    except feeds.SourceError as exc:
        return _json(400, {"error": str(exc)})
    except Exception as exc:
        logger.info("feed validation failed", extra={"feed_url": feed_url, "error": str(exc)})
        return _json(400, {"error": f"Couldn't read a feed at {feed_url}. Check the username or URL."})

    source = {
        "id": feeds.source_id(feed_url),
        "kind": kind,
        "value": value,
        "feed_url": feed_url,
        "title": str(body.get("title") or "").strip()[:200] or feed.title or value,
        "site_url": feed.site_url,
        "enabled": True,
        "created_at": now_iso(),
        "last_error": "",
    }
    if not store().add_source(source):
        return _json(409, {"error": "You're already following this feed."})
    return _json(201, {"source": source, "preview": [e.title for e in feed.entries[:3]]})


@app.patch("/sources/<sid>")
def update_source(sid: str):
    _require_admin()
    body = _body()
    fields: dict[str, Any] = {}
    if "enabled" in body:
        fields["enabled"] = bool(body["enabled"])
    if "title" in body:
        title = str(body["title"]).strip()[:200]
        if not title:
            raise BadRequestError("title cannot be empty")
        fields["title"] = title
    updated = store().update_source(sid, **fields)
    if updated is None:
        raise NotFoundError("Source not found")
    return _json(200, {"source": updated})


@app.delete("/sources/<sid>")
def delete_source(sid: str):
    _require_admin()
    if not store().delete_source(sid):
        raise NotFoundError("Source not found")
    return _json(200, {"deleted": sid})


@app.post("/ingest")
def trigger_ingest():
    _require_admin()
    fn = settings().ingest_function_name
    if not fn:
        return _json(500, {"error": "INGEST_FUNCTION_NAME is not configured"})
    boto3.client("lambda").invoke(FunctionName=fn, InvocationType="Event", Payload=b"{}")
    return _json(202, {"status": "started"})


# --------------------------------------------------------- subscriptions
RESEND_AFTER = timedelta(minutes=10)


def _str(body: dict[str, Any], key: str, limit: int) -> str:
    return str(body.get(key) or "").strip()[:limit]


@app.post("/subscribe")
def subscribe():
    if not subscriptions.enabled():
        return _json(503, {"error": "Email subscriptions aren't open yet."})
    body = _body()
    # Same reply whether the address is new, pending or already active, so the
    # form can't be used to find out who is subscribed.
    accepted = _json(202, {"status": "check_email"})
    if body.get("company"):  # honeypot field that people never see
        return accepted
    email = subscriptions.normalize_email(str(body.get("email", "")))
    if not email:
        return _json(400, {"error": "Please enter a valid email address."})

    sid = subscriptions.subscriber_id(email)
    existing = store().get_subscriber(sid)
    if existing and existing.get("status") == "active":
        return accepted
    if existing and existing.get("confirm_sent_at"):
        last = datetime.fromisoformat(existing["confirm_sent_at"])
        if datetime.now(timezone.utc) - last < RESEND_AFTER:
            return accepted
    sub = {
        "id": sid,
        "email": email,
        "status": "pending",
        "token": existing["token"] if existing else subscriptions.new_token(),
        "created_at": existing["created_at"] if existing else now_iso(),
        "confirm_sent_at": now_iso(),
    }
    store().put_subscriber(sub)
    subscriptions.send_confirmation(sub)
    return accepted


def _id_token() -> tuple[str, str]:
    body = _body()
    sid, token = _str(body, "id", 64), _str(body, "token", 64)
    if not sid or not token:
        raise BadRequestError("id and token are required")
    return sid, token


@app.post("/subscribe/confirm")
def confirm_subscription():
    sid, token = _id_token()
    if store().activate_subscriber(sid, token) is None:
        return _json(404, {"error": "This confirmation link is no longer valid. Please subscribe again."})
    return _json(200, {"status": "active"})


@app.post("/unsubscribe")
def unsubscribe():
    sid, token = _id_token()
    if store().delete_subscriber(sid, token) is None:
        return _json(404, {"error": "This unsubscribe link is no longer valid."})
    return _json(200, {"status": "unsubscribed"})


@app.get("/subscribers")
def subscriber_counts():
    _require_admin()
    subs = store().subscribers()
    active = sum(1 for s in subs if s.get("status") == "active")
    return _json(200, {"active": active, "pending": len(subs) - active})


@app.post("/lessons/announce")
def announce_lesson():
    _require_admin()
    body = _body()
    lesson = {
        "slug": _str(body, "slug", 120),
        "title": _str(body, "title", 300),
        "summary": _str(body, "summary", 500),
        "snippet": _str(body, "snippet", 1500),
    }
    if not subscriptions.SLUG_RE.match(lesson["slug"]) or not lesson["title"]:
        raise BadRequestError("slug and title are required")
    if not subscriptions.enabled():
        return _json(200, {"status": "email_disabled"})
    fn = settings().mailer_function_name
    if not fn:
        return _json(500, {"error": "MAILER_FUNCTION_NAME is not configured"})
    if not store().claim_lesson(lesson["slug"], lesson["title"]):
        return _json(200, {"status": "already_sent"})
    boto3.client("lambda").invoke(FunctionName=fn, InvocationType="Event", Payload=json.dumps(lesson).encode())
    return _json(202, {"status": "sending"})


@logger.inject_lambda_context
def handler(event, context):
    return app.resolve(event, context)
