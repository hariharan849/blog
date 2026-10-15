from unittest import mock

import anthropic
from django.conf import settings
from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import TestCase, override_settings

from learning.kb.ask import Answer, Citation, ask
from learning.kb.indexing import index_article

from .helpers import FakeClient
from .test_kb import KnowledgeBaseTestCase, newsletter
from .test_pipeline import api_error


class AskTests(KnowledgeBaseTestCase):
    def setUp(self):
        super().setUp()
        self.blog_post("Retrieval basics", "<p>Hybrid retrieval combines keyword and vector search for better recall.</p>")
        index_article(newsletter(self.source, "Agent memory", "<p>Agents store memories with vector retrieval tricks.</p>"))

    def test_passages_only_without_a_client(self):
        result = ask("What is hybrid retrieval?", scope="posts")
        self.assertEqual(result["mode"], "passages")
        self.assertIsNone(result["answer"])
        self.assertEqual(result["sources"][0]["n"], 1)
        self.assertEqual(result["sources"][0]["kind"], "post")

    def test_answer_with_validated_citations(self):
        client = FakeClient([Answer(
            answer="Hybrid retrieval mixes keyword and vector search [1]. It is magic [7].",
            citations=[Citation(n=1, quote="combines keyword and vector search"), Citation(n=7, quote="made up"),
                       Citation(n=1, quote="duplicate")],
        )])
        result = ask("What is hybrid retrieval?", scope="all", client=client)
        self.assertEqual(result["mode"], "answer")
        self.assertEqual(result["answer"], "Hybrid retrieval mixes keyword and vector search [1]. It is magic .")
        self.assertEqual([c["n"] for c in result["citations"]], [1])  # invented and duplicate citations dropped
        self.assertEqual(result["citations"][0]["source_id"], result["sources"][0]["id"])

        call = client.calls[0]
        self.assertEqual(call["model"], settings.KB_ASK["MODEL"])
        self.assertEqual(call["output_format"], Answer)
        self.assertIn('<source n="1"', call["messages"][0]["content"])
        self.assertIn("Question: What is hybrid retrieval?", call["messages"][0]["content"])

    def test_model_failure_falls_back_to_passages(self):
        client = FakeClient([api_error(anthropic.InternalServerError, 500)])
        with self.assertLogs("learning.kb.ask", "WARNING"):
            result = ask("hybrid retrieval", client=client)
        self.assertEqual(result["mode"], "passages")
        self.assertIn("could not be generated", result["error"])

    def test_no_results_skips_the_model(self):
        client = FakeClient([])
        with mock.patch("learning.kb.ask.kb_search", return_value=[]):
            self.assertEqual(ask("quantum gardening", client=client)["sources"], [])
        self.assertEqual(client.calls, [])


@override_settings(SECURE_SSL_REDIRECT=False)
class KBApiTests(KnowledgeBaseTestCase):
    def setUp(self):
        super().setUp()
        cache.clear()  # throttle history
        self.blog_post("Retrieval basics", "<p>Hybrid retrieval combines keyword and vector search.</p>")
        index_article(newsletter(self.source, "Agent memory", "<p>Agents store memories with vector retrieval.</p>"))
        self.staff = User.objects.create_user("staff", password="pw", is_staff=True)

    def test_newsletters_are_staff_only(self):
        url = "/api/v1/kb/search/"
        anonymous = self.client.get(url, {"q": "retrieval", "scope": "all"}).json()
        self.assertEqual(anonymous["scope"], "posts")
        self.assertEqual({r["kind"] for r in anonymous["results"]}, {"post"})
        self.client.force_login(self.staff)
        staff = self.client.get(url, {"q": "retrieval", "scope": "all"}).json()
        self.assertEqual({r["kind"] for r in staff["results"]}, {"post", "newsletter"})
        self.assertEqual(self.client.get(url).status_code, 400)

    def test_ask_endpoint(self):
        with mock.patch("learning.kb.api.get_client", return_value=None):
            response = self.client.post("/api/v1/kb/ask/", {"question": "What is hybrid retrieval?", "scope": "all"},
                                        content_type="application/json")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual((data["mode"], data["scope"]), ("passages", "posts"))
        self.assertTrue(data["sources"])
        self.assertEqual(self.client.post("/api/v1/kb/ask/", {}, content_type="application/json").status_code, 400)

    def test_ask_is_throttled(self):
        from learning.kb import api

        with mock.patch.object(api.AskAnonThrottle, "THROTTLE_RATES", {"kb_ask_anon": "2/hour"}), \
                mock.patch("learning.kb.api.get_client", return_value=None):
            codes = [self.client.post("/api/v1/kb/ask/", {"question": "retrieval"}, content_type="application/json").status_code
                     for _ in range(3)]
        self.assertEqual(codes, [200, 200, 429])
