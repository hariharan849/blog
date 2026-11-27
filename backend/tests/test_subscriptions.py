import json

import boto3
import pytest

from dailydose import api, config, subscriptions
from dailydose.store import Store

from test_ingest_and_api import call


def sent_emails():
    from moto.core import DEFAULT_ACCOUNT_ID
    from moto.ses.models import ses_backends

    return ses_backends[DEFAULT_ACCOUNT_ID]["us-east-1"].sent_messages


def links(message, path):
    body = message.body
    start = body.index(f"https://example.com{path}?")
    end = min(i for i in (body.find(c, start) for c in "\"\n ") if i != -1)
    query = body[start:end].split("?", 1)[1].replace("&amp;", "&")
    return dict(p.split("=", 1) for p in query.split("&"))


@pytest.fixture
def verified(aws):
    boto3.client("ses").verify_email_identity(EmailAddress="reader@example.org")


def test_normalize_email():
    assert subscriptions.normalize_email(" Reader@Example.ORG ") == "Reader@example.org"
    for bad in ["", "no-at-sign", "a@b", "a b@example.com", "a@@example.com", "x..y@example.com"]:
        assert subscriptions.normalize_email(bad) is None


def test_subscribe_confirm_unsubscribe(verified):
    status, data = call("POST", "/subscribe", {"email": "reader@example.org"}, token=None)
    assert (status, data["status"]) == (202, "check_email")
    [confirm] = sent_emails()
    assert confirm.destinations["ToAddresses"] == ["reader@example.org"]
    params = links(confirm, "/daily/subscribe/confirm")

    assert call("POST", "/subscribe/confirm", {"id": params["id"], "token": "wrong"}, token=None)[0] == 404
    assert call("POST", "/subscribe/confirm", params, token=None) == (200, {"status": "active"})
    assert call("GET", "/subscribers")[1] == {"active": 1, "pending": 0}

    # Subscribing again while active sends nothing and looks the same from outside.
    assert call("POST", "/subscribe", {"email": "reader@example.org"}, token=None)[0] == 202
    assert len(sent_emails()) == 1

    assert call("POST", "/unsubscribe", {"id": params["id"], "token": "wrong"}, token=None)[0] == 404
    assert call("POST", "/unsubscribe", params, token=None) == (200, {"status": "unsubscribed"})
    assert call("POST", "/unsubscribe", params, token=None)[0] == 200  # already gone is fine
    assert call("GET", "/subscribers")[1] == {"active": 0, "pending": 0}


def test_subscribe_rejects_bad_email_and_ignores_honeypot(verified):
    assert call("POST", "/subscribe", {"email": "nope"}, token=None)[0] == 400
    assert call("POST", "/subscribe", {"email": "reader@example.org", "company": "spam"}, token=None)[0] == 202
    assert sent_emails() == []


def test_confirmation_not_resent_within_ten_minutes(verified):
    call("POST", "/subscribe", {"email": "reader@example.org"}, token=None)
    call("POST", "/subscribe", {"email": "reader@example.org"}, token=None)
    assert len(sent_emails()) == 1


def test_subscriptions_closed_without_sender(verified, monkeypatch):
    monkeypatch.setenv("DIGEST_FROM", "")
    config.settings.cache_clear()
    status, data = call("POST", "/subscribe", {"email": "reader@example.org"}, token=None)
    assert status == 503 and "aren't open" in data["error"]
    lesson = {"slug": "a-lesson", "title": "A lesson"}
    assert call("POST", "/lessons/announce", lesson) == (200, {"status": "email_disabled"})


def test_announce_requires_admin_and_sends_once(verified, monkeypatch):
    invoked = []

    class FakeLambda:
        def invoke(self, **kw):
            invoked.append(json.loads(kw["Payload"]))

    real_client = boto3.client
    monkeypatch.setattr(api.boto3, "client", lambda name, *a, **k: FakeLambda() if name == "lambda" else real_client(name, *a, **k))
    monkeypatch.setenv("MAILER_FUNCTION_NAME", "mailer")
    config.settings.cache_clear()

    lesson = {"slug": "vector-search", "title": "Vector search", "summary": "Fast neighbours.", "snippet": "Embeddings..."}
    assert call("POST", "/lessons/announce", lesson, token="wrong")[0] == 401
    assert call("POST", "/lessons/announce", {"slug": "Bad Slug!", "title": "x"})[0] == 400
    assert call("POST", "/lessons/announce", lesson) == (202, {"status": "sending"})
    assert call("POST", "/lessons/announce", lesson) == (200, {"status": "already_sent"})
    assert invoked == [lesson]


def test_send_lesson_to_active_subscribers_only(verified):
    boto3.client("ses").verify_email_identity(EmailAddress="pending@example.org")
    store = Store()
    for email, status in [("reader@example.org", "active"), ("pending@example.org", "pending")]:
        store.put_subscriber(
            {"id": subscriptions.subscriber_id(email), "email": email, "status": status, "token": "t-" + status}
        )
    store.claim_lesson("vector-search", "Vector search")
    lesson = {"slug": "vector-search", "title": "Vector search", "summary": "Fast neighbours.", "snippet": "Embeddings & <you>."}
    assert subscriptions.send_lesson(lesson, store=store) == 1

    [msg] = sent_emails()
    assert msg.destinations["ToAddresses"] == ["reader@example.org"]
    assert msg.subject == "Daily Dose · Vector search"
    assert "https://example.com/daily/lessons/vector-search" in msg.body
    assert "Embeddings &amp; &lt;you&gt;." in msg.body
    assert links(msg, "/daily/unsubscribe")["token"] == "t-active"
    record = store.table.get_item(Key={"PK": "LESSON", "SK": "LESSON#vector-search"})["Item"]
    assert int(record["recipients"]) == 1
