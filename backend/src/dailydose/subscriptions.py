"""Email subscriptions to the daily lesson.

Flow: a visitor enters their email on the site -> POST /subscribe stores them
as pending and emails a confirmation link -> the site's confirm page calls
POST /subscribe/confirm -> they're active. Each new lesson is announced by the
daily lesson workflow (POST /lessons/announce), which invokes this module's
`handler` to email a short version of the lesson, linking to the full post,
to every active subscriber. Every email carries a one-click unsubscribe link.

Sending needs DIGEST_FROM (an SES-verified sender) and SITE_URL; until both
are set, subscriptions are closed and nothing is sent.
"""
from __future__ import annotations

import hashlib
import html
import re
import secrets
from typing import Any
from urllib.parse import urlencode

import boto3
from aws_lambda_powertools import Logger

from .config import settings
from .store import Store

logger = Logger(service="dailydose-mailer")

EMAIL_RE = re.compile(r"^[^@\s<>\"',;]{1,64}@[A-Za-z0-9.-]{1,253}\.[A-Za-z]{2,}$")
SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def normalize_email(value: str) -> str | None:
    email = (value or "").strip()
    if len(email) > 254 or not EMAIL_RE.match(email) or ".." in email:
        return None
    local, domain = email.rsplit("@", 1)
    return f"{local}@{domain.lower()}"


def subscriber_id(email: str) -> str:
    return hashlib.sha256(email.lower().encode()).hexdigest()[:32]


def new_token() -> str:
    return secrets.token_urlsafe(24)


def enabled() -> bool:
    cfg = settings()
    return bool(cfg.digest_from and cfg.site_url)


def _link(path: str, sub: dict[str, Any]) -> str:
    return f"{settings().site_url}{path}?{urlencode({'id': sub['id'], 'token': sub['token']})}"


def confirm_url(sub: dict[str, Any]) -> str:
    return _link("/daily/subscribe/confirm", sub)


def unsubscribe_url(sub: dict[str, Any]) -> str:
    return _link("/daily/unsubscribe", sub)


# ----------------------------------------------------------------- emails
_WRAP = '<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;color:#1f2933;line-height:1.55">'
_BUTTON = (
    'display:inline-block;background:#0b7285;color:#fff;text-decoration:none;'
    "padding:10px 18px;border-radius:6px;font-weight:600"
)


def build_confirmation(sub: dict[str, Any]) -> tuple[str, str, str]:
    url = confirm_url(sub)
    subject = "Confirm your Daily Dose subscription"
    text = (
        "Thanks for signing up for the Daily Dose: one short engineering lesson in your inbox each morning.\n\n"
        f"Confirm your subscription:\n{url}\n\n"
        "If you didn't sign up, ignore this email and you won't hear from us again."
    )
    body = (
        _WRAP
        + '<h1 style="font-size:20px;margin:0 0 12px">Confirm your subscription</h1>'
        "<p>Thanks for signing up for the Daily Dose: one short engineering lesson in your inbox each morning.</p>"
        f'<p style="margin:24px 0"><a href="{html.escape(url, quote=True)}" style="{_BUTTON}">Yes, subscribe me</a></p>'
        '<p style="color:#627080;font-size:13px">If you didn\'t sign up, ignore this email and you won\'t hear from us again.</p>'
        "</div>"
    )
    return subject, text, body


def build_lesson_email(lesson: dict[str, Any], sub: dict[str, Any]) -> tuple[str, str, str]:
    cfg = settings()
    url = f"{cfg.site_url}/daily/lessons/{lesson['slug']}"
    unsub = unsubscribe_url(sub)
    title, summary, snippet = lesson["title"], lesson.get("summary", ""), lesson.get("snippet", "")
    subject = f"Daily Dose · {title}"
    text = "\n\n".join(
        p for p in [title, summary, snippet, f"Read the full lesson: {url}", f"Unsubscribe: {unsub}"] if p
    )
    body = (
        _WRAP
        + '<p style="color:#0b7285;font-size:13px;text-transform:uppercase;letter-spacing:.06em;margin:0 0 8px">Daily Dose · today\'s lesson</p>'
        f'<h1 style="font-size:22px;margin:0 0 8px"><a href="{html.escape(url, quote=True)}" style="color:#203a43;text-decoration:none">{html.escape(title)}</a></h1>'
        + (f'<p style="color:#627080;margin:0 0 16px">{html.escape(summary)}</p>' if summary else "")
        + (f"<p>{html.escape(snippet)}</p>" if snippet else "")
        + f'<p style="margin:24px 0"><a href="{html.escape(url, quote=True)}" style="{_BUTTON}">Read the full lesson →</a></p>'
        '<hr style="border:none;border-top:1px solid #e1e6eb;margin:32px 0 12px">'
        '<p style="color:#627080;font-size:12px">You get this because you subscribed to the Daily Dose. '
        f'<a href="{html.escape(unsub, quote=True)}" style="color:#627080">Unsubscribe</a></p>'
        "</div>"
    )
    return subject, text, body


def _send(ses, to: str, message: tuple[str, str, str]) -> None:
    subject, text, body = message
    ses.send_email(
        Source=settings().digest_from,
        Destination={"ToAddresses": [to]},
        Message={
            "Subject": {"Data": subject, "Charset": "UTF-8"},
            "Body": {"Text": {"Data": text, "Charset": "UTF-8"}, "Html": {"Data": body, "Charset": "UTF-8"}},
        },
    )


def send_confirmation(sub: dict[str, Any], ses=None) -> None:
    _send(ses or boto3.client("ses"), sub["email"], build_confirmation(sub))


def send_lesson(lesson: dict[str, Any], store: Store | None = None, ses=None) -> int:
    """Emails the lesson to every active subscriber. Returns how many were sent."""
    if not enabled():
        return 0
    store = store or Store()
    ses = ses or boto3.client("ses")
    sent = 0
    for sub in store.subscribers():
        if sub.get("status") != "active":
            continue
        try:
            _send(ses, sub["email"], build_lesson_email(lesson, sub))
            sent += 1
        except Exception:  # one bad address shouldn't stop the rest
            logger.exception("lesson email failed", extra={"subscriber": sub["id"]})
    store.record_lesson_sent(lesson["slug"], sent)
    logger.info("lesson emailed", extra={"slug": lesson["slug"], "recipients": sent})
    return sent


@logger.inject_lambda_context
def handler(event, context):
    """Mailer Lambda, invoked asynchronously by POST /lessons/announce."""
    return {"sent": send_lesson(event)}
