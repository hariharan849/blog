from datetime import timedelta
from email.utils import format_datetime
from pathlib import Path
from types import SimpleNamespace
from unittest import mock

import feedparser
from django.utils import timezone

FIXTURES = Path(__file__).parent / "fixtures"
_real_parse = feedparser.parse  # captured before tests patch it


def feed_fixture(name, now=None):
    now = now or timezone.now()
    text = (FIXTURES / name).read_text()
    return text.replace("{recent}", format_datetime(now - timedelta(hours=3))).replace(
        "{old}", format_datetime(now - timedelta(days=30))
    )


def fake_parse(feeds):
    """Patch target for feedparser.parse: maps feed URL -> fixture name (or an exception)."""
    def parse(url, **kwargs):
        target = feeds[url]
        if isinstance(target, Exception):
            raise target
        result = _real_parse(feed_fixture(target))
        result["status"] = 200
        result["etag"] = '"v1"'
        return result
    return mock.patch("learning.pipeline.feeds.feedparser.parse", side_effect=parse)


class FakeClient:
    """Stands in for anthropic.Anthropic: returns queued parsed outputs and records calls."""

    def __init__(self, outputs, stop_reason="end_turn", model="claude-opus-5-5"):
        self.outputs = list(outputs)
        self.calls = []
        self.stop_reason = stop_reason
        self.model = model
        self.beta = SimpleNamespace(messages=SimpleNamespace(parse=self._parse))

    def _parse(self, **kwargs):
        self.calls.append(kwargs)
        output = self.outputs.pop(0)
        if isinstance(output, Exception):
            raise output
        refused = self.stop_reason == "refusal"
        return SimpleNamespace(
            parsed_output=None if refused else output,
            stop_reason=self.stop_reason,
            stop_details=SimpleNamespace(category="cyber") if refused else None,
            model=self.model,
        )
