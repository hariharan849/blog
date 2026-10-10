from datetime import timedelta
from io import StringIO
from unittest import mock

import anthropic
import httpx2
from django.conf import settings
from django.core import mail
from django.core.management import call_command
from django.test import TestCase, override_settings
from django.utils import timezone

from learning.models import Article, DailyDigest, Interest, Source
from learning.pipeline.digest import DailyLesson, Takeaway, build_digest, email_digest
from learning.pipeline.enrich import ArticleInsights, KeyPoint, enrich_article, enrich_pending
from learning.pipeline.feeds import (
    canonical_url, fetch_all, import_sources, parse_source_list, resolve_feed_url,
)

from .helpers import FIXTURES, FakeClient, fake_parse

SUBSTACK = "https://agentic.substack.com/feed"
TOWARDS_AI = "https://pub.towardsai.net/feed"


class FeedResolutionTests(TestCase):
    def test_known_sites(self):
        cases = {
            "https://agentic.substack.com/": ("https://agentic.substack.com/feed", "substack"),
            "agentic.substack.com/p/some-post": ("https://agentic.substack.com/feed", "substack"),
            "https://medium.com/@karpathy": ("https://medium.com/feed/@karpathy", "medium"),
            "https://medium.com/@karpathy/some-post-123": ("https://medium.com/feed/@karpathy", "medium"),
            "https://medium.com/towards-data-science": ("https://medium.com/feed/towards-data-science", "medium"),
            "https://medium.com/tag/llm": ("https://medium.com/feed/tag/llm", "medium"),
            "https://writer.medium.com/": ("https://writer.medium.com/feed", "medium"),
            "https://pub.towardsai.net": (TOWARDS_AI, "towards_ai"),
            "https://example.com/blog/rss.xml": ("https://example.com/blog/rss.xml", "rss"),
        }
        for url, expected in cases.items():
            with self.subTest(url=url):
                self.assertEqual(resolve_feed_url(url), expected)

    def test_medium_home_page_is_rejected(self):
        with self.assertRaises(ValueError):
            resolve_feed_url("https://medium.com/")

    def test_other_sites_autodiscover_then_fall_back(self):
        page = '<html><head><link rel="alternate" type="application/rss+xml" href="/index.xml"></head></html>'
        with mock.patch("learning.pipeline.feeds._get", return_value=page):
            self.assertEqual(resolve_feed_url("https://blog.example.com/"), ("https://blog.example.com/index.xml", "rss"))
        with mock.patch("learning.pipeline.feeds._get", side_effect=OSError("offline")):
            self.assertEqual(resolve_feed_url("https://newsletter.example.com"), ("https://newsletter.example.com/feed", "rss"))

    def test_canonical_url_strips_tracking(self):
        self.assertEqual(
            canonical_url("https://Pub.TowardsAI.net/post-1?source=rss----abc---4&utm_medium=x&id=7#top"),
            "https://pub.towardsai.net/post-1?id=7",
        )

    def test_parse_source_lists(self):
        opml = parse_source_list((FIXTURES / "sources.opml").read_text(), "subs.opml")
        self.assertEqual([entry[1] for entry in opml], [SUBSTACK, TOWARDS_AI])
        text = parse_source_list("# my follows\nhttps://a.substack.com\n\nhttps://medium.com/@b, Bee\n")
        self.assertEqual(text, [("https://a.substack.com", None, ""), ("https://medium.com/@b", None, "Bee")])

    def test_import_is_idempotent(self):
        created, existing, errors = import_sources("https://agentic.substack.com\nhttps://medium.com/\n")
        self.assertEqual(len(created), 1)
        self.assertEqual(len(errors), 1)  # Medium home page
        created, existing, errors = import_sources((FIXTURES / "sources.opml").read_text(), "subs.opml")
        self.assertEqual((len(created), len(existing)), (1, 1))
        self.assertEqual(Source.objects.get(feed_url=TOWARDS_AI).kind, "towards_ai")


class FetchTests(TestCase):
    def setUp(self):
        self.substack = Source.objects.create(name="agentic.substack.com", site_url="https://agentic.substack.com",
                                              feed_url=SUBSTACK, kind="substack")
        self.towards = Source.objects.create(name="Towards AI", feed_url=TOWARDS_AI, kind="towards_ai")

    def test_fetch_stores_recent_deduplicated_articles(self):
        with fake_parse({SUBSTACK: "substack.xml", TOWARDS_AI: "medium.xml"}):
            new, failed = fetch_all([self.substack, self.towards])
        self.assertEqual((new, failed), (3, 0))  # old post skipped, cross-post deduplicated
        article = Article.objects.get(url="https://agentic.substack.com/p/reliable-agents")
        self.assertEqual(article.author, "Ada Writer")
        self.assertEqual(article.feed_categories, ["LLM agents"])
        self.assertIn("Evaluate every tool call", article.content_text)
        self.assertTrue(Article.objects.filter(url="https://pub.towardsai.net/fine-tuning-small-models-abc123").exists())
        self.substack.refresh_from_db()
        self.assertEqual(self.substack.name, "Agentic Engineering")  # auto-name replaced by feed title
        self.assertEqual(self.substack.etag, '"v1"')
        self.towards.refresh_from_db()
        self.assertEqual(self.towards.name, "Towards AI")  # user-chosen name kept

        with fake_parse({SUBSTACK: "substack.xml", TOWARDS_AI: "medium.xml"}):
            self.assertEqual(fetch_all(), (0, 0))

    def test_broken_feed_does_not_stop_others(self):
        with fake_parse({SUBSTACK: OSError("DNS failure"), TOWARDS_AI: "medium.xml"}):
            new, failed = fetch_all()
        self.assertEqual((new, failed), (3, 1))
        self.substack.refresh_from_db()
        self.assertIn("DNS failure", self.substack.last_error)

    def test_not_modified(self):
        with mock.patch("learning.pipeline.feeds.feedparser.parse", return_value={"status": 304, "entries": []}):
            self.assertEqual(fetch_all([self.substack]), (0, 0))


def make_article(source, title="Post", relevance=80, status=Article.Status.ENRICHED, hours_ago=2, **kwargs):
    return Article.objects.create(
        source=source, url=f"https://x.test/{title.replace(' ', '-')}-{Article.objects.count()}", title=title,
        status=status, relevance=relevance, published_at=timezone.now() - timedelta(hours=hours_ago),
        summary=f"Summary of {title}", key_points=[{"point": f"Point from {title}", "why_interesting": "why"}],
        word_count=460, **kwargs,
    )


INSIGHTS = ArticleInsights(
    summary="Agents need evals.", key_points=[KeyPoint(point="Log tool calls", why_interesting="Debuggable")],
    tags=["LLM Agents", "evals", " "], difficulty="intermediate", content_type="tutorial",
    relevance=140, relevance_reason="Core interest.", worth_deep_read=True,
)


def api_error(cls, status):
    request = httpx2.Request("POST", "https://api.anthropic.com/v1/messages")
    return cls("boom", response=httpx2.Response(status, request=request), body=None)


class EnrichTests(TestCase):
    def setUp(self):
        self.source = Source.objects.create(name="Agentic", feed_url=SUBSTACK)
        Interest.objects.create(name="LLM agents", weight=5)
        Interest.objects.create(name="RAG", weight=3)
        self.article = Article.objects.create(
            source=self.source, url="https://agentic.substack.com/p/a", title="Building reliable LLM agents",
            content_html="<p>LLM agents fail. RAG helps them.</p><h2>Evaluate</h2><p>Log every call. Score it.</p>",
            content_text="LLM agents fail. RAG helps them.\nEvaluate\nLog every call. Score it.", word_count=12,
            feed_categories=["AI"], published_at=timezone.now(),
        )

    def test_keyword_fallback(self):
        self.assertEqual(enrich_article(self.article), Article.Status.BASIC)
        self.article.refresh_from_db()
        self.assertEqual(sorted(self.article.tags.names()), ["ai", "llm agents", "rag"])
        self.assertEqual(self.article.relevance, 100)  # (5 * 3 'llm agents' hits + 3 * 1 'rag' hit) * 7, capped
        self.assertEqual(self.article.key_points[0]["point"], "Evaluate: Log every call.")
        self.assertTrue(self.article.summary.startswith("LLM agents fail."))

    def test_claude_structured_output(self):
        client = FakeClient([INSIGHTS])
        self.assertEqual(enrich_article(self.article, client), Article.Status.ENRICHED)
        self.article.refresh_from_db()
        self.assertEqual(self.article.relevance, 100)  # clamped
        self.assertEqual(sorted(self.article.tags.names()), ["evals", "llm agents"])
        self.assertEqual(self.article.difficulty, "intermediate")
        self.assertEqual(self.article.enriched_model, "claude-opus-5-5")

        call = client.calls[0]
        self.assertEqual(call["model"], "claude-opus-5-5")
        self.assertEqual(call["output_format"], ArticleInsights)
        self.assertEqual(call["fallbacks"], "default")
        self.assertEqual(call["system"][0]["cache_control"], {"type": "ephemeral"})
        self.assertIn("LLM agents (priority 5/5)", call["system"][0]["text"])
        self.assertIn("Log every call", call["messages"][0]["content"])

    @override_settings(DAILY_BYTES={**settings.DAILY_BYTES, "MODEL": "claude-haiku-5-5"})
    def test_no_fallbacks_for_models_without_support(self):
        client = FakeClient([INSIGHTS], model="claude-haiku-5-5")
        enrich_article(self.article, client)
        self.assertNotIn("fallbacks", client.calls[0])

    def test_refusal_and_api_errors_mark_failed(self):
        self.assertEqual(enrich_article(self.article, FakeClient([INSIGHTS], stop_reason="refusal")), "failed")
        self.assertIn("declined", Article.objects.get(pk=self.article.pk).error)
        self.assertEqual(enrich_article(self.article, FakeClient([api_error(anthropic.InternalServerError, 500)])), "failed")

    def test_authentication_error_stops_the_run(self):
        with self.assertRaises(anthropic.AuthenticationError):
            enrich_pending(client=FakeClient([api_error(anthropic.AuthenticationError, 401)]))


class DigestTests(TestCase):
    def setUp(self):
        self.a = Source.objects.create(name="A", feed_url="https://a.test/feed")
        self.b = Source.objects.create(name="B", feed_url="https://b.test/feed")

    @override_settings(DAILY_BYTES={**settings.DAILY_BYTES, "DIGEST_SIZE": 3})
    def test_selection_threshold_cap_and_size(self):
        top = [make_article(self.a, f"A{i}", relevance=90 - i) for i in range(3)]
        b1 = make_article(self.b, "B1", relevance=60)
        make_article(self.b, "Low", relevance=10)
        make_article(self.b, "Old", relevance=99, hours_ago=24 * 10)
        make_article(self.b, "Unenriched", relevance=99, status=Article.Status.NEW)
        digest = build_digest()
        self.assertEqual([item.article for item in digest.items.all()], [top[0], top[1], b1])  # 2 per source max
        self.assertEqual(digest.generated_by, "keyword")
        self.assertEqual(digest.takeaways[0]["source_urls"], [top[0].url])

    def test_rerun_is_idempotent_and_earlier_days_are_not_repeated(self):
        first = make_article(self.a, "First", hours_ago=30)
        yesterday = build_digest(date=timezone.localdate() - timedelta(days=1))
        self.assertEqual([item.article for item in yesterday.items.all()], [first])
        second = make_article(self.b, "Second")
        build_digest()
        digest = build_digest()
        self.assertEqual(DailyDigest.objects.count(), 2)
        self.assertEqual([item.article for item in digest.items.all()], [second])

    def test_claude_lesson_keeps_only_known_urls(self):
        article = make_article(self.a, "Agents")
        lesson = DailyLesson(
            headline="Agents need evals", intro="Common thread.", try_today="Add one eval.",
            takeaways=[Takeaway(title="Evals", explanation="Measure.", source_urls=[article.url, "https://evil.test"])],
        )
        client = FakeClient([lesson])
        digest = build_digest(client=client)
        self.assertEqual(digest.headline, "Agents need evals")
        self.assertEqual(digest.takeaways[0]["source_urls"], [article.url])
        self.assertEqual(digest.generated_by, "claude-opus-5-5")
        self.assertIn(article.url, client.calls[0]["messages"][0]["content"])

    def test_lesson_failure_falls_back(self):
        make_article(self.a, "Agents")
        digest = build_digest(client=FakeClient([api_error(anthropic.InternalServerError, 500)]))
        self.assertEqual(digest.generated_by, "keyword")

    @override_settings(DAILY_BYTES={**settings.DAILY_BYTES, "EMAIL_TO": ["me@x.test"]},
                       EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
    def test_email_once(self):
        make_article(self.a, "Agents")
        digest = build_digest()
        self.assertTrue(email_digest(digest, base_url="https://blog.test/bytes/"))
        self.assertFalse(email_digest(digest))
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("Agents", mail.outbox[0].body)
        self.assertIn("https://blog.test/bytes/", mail.outbox[0].body)


class CommandTests(TestCase):
    def test_run_daily_bytes_end_to_end_without_api_key(self):
        Interest.objects.create(name="LLM agents", weight=5)
        out = StringIO()
        call_command("import_sources", str(FIXTURES / "sources.opml"), stdout=out)
        self.assertIn("2 added", out.getvalue())
        with fake_parse({SUBSTACK: "substack.xml", TOWARDS_AI: "medium.xml"}), \
                mock.patch.dict("os.environ", {"ANTHROPIC_API_KEY": "", "ANTHROPIC_AUTH_TOKEN": ""}):
            call_command("run_daily_bytes", "--no-email", stdout=out)
        output = out.getvalue()
        self.assertIn("Fetched 3 new article(s)", output)
        self.assertIn("Enriched: 3 basic", output)
        digest = DailyDigest.objects.get()
        self.assertEqual([item.article.title for item in digest.items.all()], ["Building reliable LLM agents"])
