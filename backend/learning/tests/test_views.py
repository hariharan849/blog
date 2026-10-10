from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings

from learning.models import Article, Interest, Source
from learning.pipeline.digest import build_digest

from .helpers import FIXTURES
from .test_pipeline import make_article

API = "/api/v1/bytes"


@override_settings(SECURE_SSL_REDIRECT=False)
class BytesApiTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.staff = User.objects.create_user("staff", password="pw", is_staff=True)
        cls.reader = User.objects.create_user("reader", password="pw")
        cls.source = Source.objects.create(name="Agentic", feed_url="https://agentic.substack.com/feed")

    def test_endpoints_are_staff_only(self):
        for url in (f"{API}/digests/", f"{API}/digests/latest/", f"{API}/articles/", f"{API}/sources/",
                    f"{API}/interests/"):
            with self.subTest(url=url):
                self.assertEqual(self.client.get(url).status_code, 403)
                self.client.force_login(self.reader)
                self.assertEqual(self.client.get(url).status_code, 403)
                self.client.logout()

    def test_digests(self):
        self.client.force_login(self.staff)
        self.assertEqual(self.client.get(f"{API}/digests/latest/").status_code, 404)
        article = make_article(self.source, "Reliable agents")
        article.tags.add("llm agents")
        digest = build_digest()
        latest = self.client.get(f"{API}/digests/latest/").json()
        self.assertEqual(latest["headline"], digest.headline)
        self.assertEqual(latest["articles"][0]["url"], article.url)
        self.assertEqual(latest["articles"][0]["tags"], [{"name": "llm agents", "slug": "llm-agents"}])
        self.assertEqual(latest["articles"][0]["source"], {"id": self.source.pk, "name": "Agentic"})
        self.assertEqual(self.client.get(f"{API}/digests/{digest.date.isoformat()}/").json()["date"],
                         digest.date.isoformat())
        self.assertEqual(self.client.get(f"{API}/digests/not-a-date/").status_code, 404)
        self.assertEqual(self.client.get(f"{API}/digests/2001-01-01/").status_code, 404)
        archive = self.client.get(f"{API}/digests/").json()
        self.assertEqual(archive["count"], 1)

    def test_articles_filter_and_toggle(self):
        self.client.force_login(self.staff)
        article = make_article(self.source, "Agents")
        other = make_article(self.source, "Cooking")
        response = self.client.patch(f"{API}/articles/{article.pk}/", {"is_starred": True, "title": "hacked"},
                                     content_type="application/json")
        self.assertEqual(response.status_code, 200)
        article.refresh_from_db()
        self.assertTrue(article.is_starred)
        self.assertEqual(article.title, "Agents")  # read-only fields are ignored
        titles = lambda params: [a["title"] for a in self.client.get(f"{API}/articles/", params).json()["results"]]
        self.assertEqual(titles({"starred": "1"}), ["Agents"])
        self.assertEqual(titles({"q": "cook"}), [other.title])
        self.assertEqual(self.client.delete(f"{API}/articles/{article.pk}/").status_code, 405)

    def test_sources_import_and_toggle(self):
        self.client.force_login(self.staff)
        response = self.client.post(f"{API}/sources/", {"urls": "https://medium.com/@writer\nhttps://medium.com/"},
                                    content_type="application/json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual([s["feed_url"] for s in response.json()["created"]], ["https://medium.com/feed/@writer"])
        self.assertEqual(len(response.json()["errors"]), 1)

        opml = SimpleUploadedFile("subs.opml", (FIXTURES / "sources.opml").read_bytes())
        response = self.client.post(f"{API}/sources/", {"opml": opml})
        self.assertEqual(response.json()["existing"], 1)
        self.assertTrue(Source.objects.filter(feed_url="https://pub.towardsai.net/feed").exists())
        self.assertEqual(self.client.post(f"{API}/sources/", {}, content_type="application/json").status_code, 400)

        response = self.client.patch(f"{API}/sources/{self.source.pk}/", {"is_active": False, "feed_url": "x"},
                                     content_type="application/json")
        self.assertEqual(response.status_code, 200)
        self.source.refresh_from_db()
        self.assertFalse(self.source.is_active)
        self.assertEqual(self.source.feed_url, "https://agentic.substack.com/feed")

    def test_interests(self):
        self.client.force_login(self.staff)
        response = self.client.post(f"{API}/interests/", {"name": "RAG", "weight": 4}, content_type="application/json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(self.client.post(f"{API}/interests/", {"name": "x", "weight": 9},
                                          content_type="application/json").status_code, 400)
        self.assertEqual(self.client.get(f"{API}/interests/").json(), [{"id": response.json()["id"], "name": "RAG", "weight": 4}])
        self.client.delete(f"{API}/interests/{response.json()['id']}/")
        self.assertFalse(Interest.objects.exists())
        self.assertFalse(Article.objects.exists())
