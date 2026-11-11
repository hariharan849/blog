import json
from datetime import datetime, timezone

import boto3
import pytest

from dailydose import api, feeds, ingest
from dailydose.store import Store

NOW = datetime(2026, 11, 11, 2, 0, tzinfo=timezone.utc)


def call(method, path, body=None, token="s3cret-token", query=None):
    event = {
        "version": "2.0",
        "routeKey": "$default",
        "rawPath": path,
        "rawQueryString": "&".join(f"{k}={v}" for k, v in (query or {}).items()),
        "queryStringParameters": query,
        "headers": {"authorization": f"Bearer {token}"} if token else {},
        "requestContext": {"http": {"method": method, "path": path}, "stage": "$default"},
        "body": json.dumps(body) if body is not None else None,
        "isBase64Encoded": False,
    }
    res = api.app.resolve(event, None)
    return res["statusCode"], json.loads(res["body"])


@pytest.fixture
def fake_fetch(monkeypatch, fixture_bytes):
    def fetch(url, timeout=15):
        if "janedoe" in url:
            return fixture_bytes("medium.xml")
        if "lab.example.com" in url:
            return fixture_bytes("atom.xml")
        raise OSError("connection refused")

    monkeypatch.setattr(feeds, "fetch", fetch)


def test_admin_endpoints_require_token(aws):
    assert call("GET", "/sources", token=None)[0] == 401
    assert call("GET", "/sources", token="wrong")[0] == 401
    assert call("GET", "/sources")[0] == 200


def test_add_list_toggle_delete_source(aws, fake_fetch):
    status, data = call("POST", "/sources", {"kind": "medium", "value": "@janedoe"})
    assert status == 201
    assert data["source"]["title"] == "Stories by Jane Doe on Medium"
    assert data["preview"] == ["Agents that actually ship", "An old post"]
    sid = data["source"]["id"]

    assert call("POST", "/sources", {"kind": "medium", "value": "janedoe"})[0] == 409
    bad = call("POST", "/sources", {"kind": "rss", "value": "https://down.example.org/feed"})
    assert bad[0] == 400 and "Couldn't read a feed" in bad[1]["error"]

    status, data = call("PATCH", f"/sources/{sid}", {"enabled": False, "title": "Jane"})
    assert status == 200 and data["source"]["enabled"] is False and data["source"]["title"] == "Jane"
    assert call("PATCH", "/sources/missing", {"enabled": True})[0] == 404

    assert [s["id"] for s in call("GET", "/sources")[1]["sources"]] == [sid]
    assert call("DELETE", f"/sources/{sid}")[0] == 200
    assert call("DELETE", f"/sources/{sid}")[0] == 404


def test_ingest_dedupes_filters_and_emails(aws, fake_fetch, monkeypatch):
    call("POST", "/sources", {"kind": "medium", "value": "@janedoe"})
    call("POST", "/sources", {"kind": "rss", "value": "https://lab.example.com/feed"})
    call("POST", "/sources", {"kind": "substack", "value": "broken"})  # rejected: fetch fails
    # A source that breaks after being added must not stop the run.
    Store().add_source({"id": "dead", "kind": "rss", "feed_url": "https://dead.example.org/rss",
                        "title": "Dead", "enabled": True, "created_at": "2026-01-01T00:00:00+00:00"})
    sent = []
    monkeypatch.setattr(ingest.digest, "send", lambda day, items: sent.append((day, items)) or True)

    first = ingest.run(now=NOW)
    assert first == {"day": "2026-11-11", "sources": 3, "new_items": 2, "errors": 1, "emailed": True}
    titles = {i["title"] for i in sent[0][1]}
    assert titles == {"Agents that actually ship", "Long-context evals, revisited"}  # 2024 post skipped

    second = ingest.run(now=NOW)
    assert second["new_items"] == 0  # deduped
    assert second["emailed"] is True  # send() is called but the real one no-ops on empty lists

    dead = Store().get_source("dead")
    assert dead["last_error"].startswith("OSError")

    status, feed = call("GET", "/feed", token=None)
    assert status == 200 and feed["day"] == "2026-11-11" and len(feed["items"]) == 2
    assert feed["items"][0]["published_at"] >= feed["items"][1]["published_at"]
    status, days = call("GET", "/feed/days", token=None)
    assert days["days"] == [{"day": "2026-11-11", "count": 2}]
    assert call("GET", "/feed", token=None, query={"day": "bad"})[0] == 400


def test_disabled_source_is_skipped(aws, fake_fetch):
    sid = call("POST", "/sources", {"kind": "medium", "value": "@janedoe"})[1]["source"]["id"]
    call("PATCH", f"/sources/{sid}", {"enabled": False})
    assert ingest.run(now=NOW)["sources"] == 0


def test_real_digest_sends_through_ses(aws, fake_fetch):
    call("POST", "/sources", {"kind": "medium", "value": "@janedoe"})
    assert ingest.run(now=NOW)["emailed"] is True
    from moto.backends import get_backend

    sent = get_backend("ses")["123456789012"]["us-east-1"].sent_messages
    assert len(sent) == 1
    assert "Daily Dose · 2026-11-11 · 1 new post" in sent[0].subject
    assert "https://example.com/daily/2026-11-11" in sent[0].body


def test_empty_feed(aws):
    status, feed = call("GET", "/feed", token=None)
    assert status == 200 and feed["day"] is None and feed["items"] == []
