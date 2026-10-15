import json
from io import StringIO
from unittest import mock

import anthropic
from django.contrib.auth.models import User
from django.core.management import call_command
from django.test import TestCase, override_settings

from blog.search.embeddings import HashingEmbedder
from learning import tasks
from learning.models import Article, ArticlePassage, PipelineFailure, Source

from .helpers import FakeClient, fake_parse
from .test_kb import newsletter
from .test_pipeline import INSIGHTS, TOWARDS_AI, SUBSTACK, api_error


def counting_embed():
    """Wrap HashingEmbedder.embed to count calls while keeping real vectors."""
    original = HashingEmbedder.embed
    calls = []

    def embed(self, texts, input_type="document"):
        calls.append(input_type)
        return original(self, texts, input_type)

    return mock.patch.object(HashingEmbedder, "embed", embed), calls


class ProcessArticleTests(TestCase):
    """Celery runs eagerly in tests (no REDIS_URL), exercising the same task code as the worker."""

    def setUp(self):
        self.source = Source.objects.create(name="Agentic", feed_url=SUBSTACK)
        self.article = newsletter(self.source, "Reliable agents", "<h2>Evals</h2><p>Agents need evaluation harnesses.</p>")

    def test_rerunning_never_repeats_paid_calls(self):
        client = FakeClient([INSIGHTS])  # a second Claude call would fail: the queue is empty
        patch, embed_calls = counting_embed()
        with patch, mock.patch.object(tasks, "get_client", return_value=client):
            first = tasks.process_article.delay(self.article.pk).get()
            second = tasks.process_article.delay(self.article.pk).get()
        self.assertEqual(first, {"indexed": True, "status": "enriched"})
        self.assertEqual(second, {"indexed": False, "status": None})
        self.assertEqual(len(client.calls), 1)
        self.assertEqual(embed_calls, ["document"])
        self.article.refresh_from_db()
        self.assertEqual(self.article.enriched_hash, self.article.content_hash)
        self.assertTrue(self.article.passages.exists())

    def test_transient_errors_retry_then_become_a_failure_record(self):
        client = FakeClient([api_error(anthropic.RateLimitError, 429)] * 3)
        with mock.patch.object(tasks, "get_client", return_value=client), \
                mock.patch.object(tasks.process_article, "max_retries", 2):
            result = tasks.process_article.delay(self.article.pk)
        self.assertEqual(result.state, "FAILURE")
        self.assertEqual(len(client.calls), 3)  # first try + 2 retries
        failure = PipelineFailure.objects.get()
        self.assertEqual((failure.task_name, failure.article, failure.error_type), ("learning.process_article", self.article, "TransientLLMError"))
        self.assertEqual(failure.payload["args"], [self.article.pk])
        self.article.refresh_from_db()
        self.assertEqual(self.article.status, Article.Status.NEW)  # untouched, so a later run picks it up
        self.assertTrue(self.article.passages.exists())  # indexing had already succeeded and is kept

    def test_permanent_model_errors_mark_the_article_and_are_recorded(self):
        client = FakeClient([api_error(anthropic.BadRequestError, 400)])
        with mock.patch.object(tasks, "get_client", return_value=client):
            self.assertEqual(tasks.process_article.delay(self.article.pk).get()["status"], "failed")
        failure = PipelineFailure.objects.get()
        self.assertEqual(failure.task_name, "learning.enrich")
        self.assertIn("API error 400", failure.error)

    def test_missing_article_is_a_no_op(self):
        self.assertIsNone(tasks.process_article.delay(999999).get())


class PollFeedsTests(TestCase):
    def test_poll_fetches_indexes_and_enriches(self):
        Source.objects.create(name="Agentic", feed_url=SUBSTACK)
        Source.objects.create(name="Towards AI", feed_url=TOWARDS_AI)
        Source.objects.create(name="Paused", feed_url="https://paused.test/feed", is_active=False)
        with fake_parse({SUBSTACK: "substack.xml", TOWARDS_AI: "medium.xml"}), \
                mock.patch.object(tasks, "get_client", return_value=None):
            self.assertEqual(tasks.poll_feeds.delay().get(), 2)
        self.assertEqual(Article.objects.count(), 3)
        self.assertFalse(Article.objects.filter(status=Article.Status.NEW).exists())
        self.assertEqual(ArticlePassage.objects.values("article").distinct().count(), 3)

        with fake_parse({SUBSTACK: "substack.xml", TOWARDS_AI: "medium.xml"}), \
                mock.patch.object(tasks, "process_article") as process:
            tasks.poll_feeds.delay().get()
        process.delay.assert_not_called()  # nothing new: nothing queued


@override_settings(SECURE_SSL_REDIRECT=False)
class FailureDatasetTests(TestCase):
    def setUp(self):
        source = Source.objects.create(name="Agentic", feed_url=SUBSTACK)
        self.article = newsletter(source, "Broken", "<p>text</p>")
        PipelineFailure.objects.create(task_name="learning.enrich", article=self.article, error="boom", error_type="LLMError")
        PipelineFailure.objects.create(task_name="learning.fetch_source", source=source, error="dns", resolved=True)

    def test_export_jsonl(self):
        out, err = StringIO(), StringIO()
        call_command("export_failures", "--unresolved", "--with-content", stdout=out, stderr=err)
        [line] = out.getvalue().splitlines()
        record = json.loads(line)
        self.assertEqual((record["task"], record["error"]), ("learning.enrich", "boom"))
        self.assertEqual(record["article"]["content_text"], "<p>text</p>")
        self.assertIn("Exported 1", err.getvalue())

    def test_failures_api_is_staff_only_and_resolvable(self):
        url = "/api/v1/bytes/failures/"
        self.assertEqual(self.client.get(url).status_code, 403)
        self.client.force_login(User.objects.create_user("staff", password="pw", is_staff=True))
        data = self.client.get(url, {"resolved": "0"}).json()
        self.assertEqual(data["count"], 1)
        failure = data["results"][0]
        self.assertEqual(failure["article"]["title"], "Broken")
        response = self.client.patch(f"{url}{failure['id']}/", {"resolved": True, "error": "x"}, content_type="application/json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(PipelineFailure.objects.filter(resolved=False).count(), 0)
        self.assertEqual(PipelineFailure.objects.get(pk=failure["id"]).error, "boom")


class RunDailyBytesTests(TestCase):
    def test_command_indexes_articles(self):
        Source.objects.create(name="Agentic", feed_url=SUBSTACK)
        out = StringIO()
        with fake_parse({SUBSTACK: "substack.xml"}), mock.patch.dict("os.environ", {"ANTHROPIC_API_KEY": "", "ANTHROPIC_AUTH_TOKEN": ""}):
            call_command("run_daily_bytes", "--no-email", stdout=out)
        self.assertIn("Indexed 1 article(s) for search.", out.getvalue())
        self.assertTrue(ArticlePassage.objects.exists())
