"""Builds and sends the morning email digest through Amazon SES."""
from __future__ import annotations

import html
from collections import defaultdict
from typing import Any

import boto3

from .config import settings


def build(day: str, items: list[dict[str, Any]], site_url: str = "") -> tuple[str, str, str]:
    """Returns (subject, text_body, html_body)."""
    n = len(items)
    subject = f"Daily Dose · {day} · {n} new {'post' if n == 1 else 'posts'}"
    by_source: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for item in items:
        by_source[item.get("source_title") or item.get("author") or "Other"].append(item)

    text_lines = [subject, ""]
    parts = [
        '<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:640px;margin:0 auto;color:#1f2933">',
        f'<h1 style="font-size:22px;margin:0 0 4px">Daily Dose</h1>'
        f'<p style="color:#627080;margin:0 0 24px">{html.escape(day)} · {n} new {"post" if n == 1 else "posts"}</p>',
    ]
    for source, entries in sorted(by_source.items()):
        text_lines.append(f"## {source}")
        parts.append(
            f'<h2 style="font-size:15px;text-transform:uppercase;letter-spacing:.06em;color:#0b7285;'
            f'border-bottom:1px solid #e1e6eb;padding-bottom:6px;margin:24px 0 12px">{html.escape(source)}</h2>'
        )
        for e in entries:
            text_lines += [f"- {e['title']}", f"  {e['url']}"]
            if e.get("excerpt"):
                text_lines.append(f"  {e['excerpt']}")
            parts.append(
                '<div style="margin:0 0 16px">'
                f'<a href="{html.escape(e["url"], quote=True)}" style="font-size:16px;font-weight:600;color:#203a43;text-decoration:none">{html.escape(e["title"])}</a>'
                f'<div style="color:#627080;font-size:13px">{html.escape(e.get("author") or "")}</div>'
                + (f'<p style="margin:4px 0 0;font-size:14px;line-height:1.5">{html.escape(e["excerpt"])}</p>' if e.get("excerpt") else "")
                + "</div>"
            )
        text_lines.append("")
    if site_url:
        link = f"{site_url}/daily/{day}"
        text_lines.append(f"Read on the site: {link}")
        parts.append(f'<p style="margin-top:32px"><a href="{html.escape(link, quote=True)}" style="color:#0b7285">Read on the site →</a></p>')
    parts.append("</div>")
    return subject, "\n".join(text_lines), "".join(parts)


def send(day: str, items: list[dict[str, Any]], ses=None) -> bool:
    cfg = settings()
    if not items or not cfg.digest_to or not cfg.digest_from:
        return False
    subject, text, body = build(day, items, cfg.site_url)
    (ses or boto3.client("ses")).send_email(
        Source=cfg.digest_from,
        Destination={"ToAddresses": cfg.digest_to},
        Message={
            "Subject": {"Data": subject, "Charset": "UTF-8"},
            "Body": {"Text": {"Data": text, "Charset": "UTF-8"}, "Html": {"Data": body, "Charset": "UTF-8"}},
        },
    )
    return True
