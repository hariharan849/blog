from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.urls import reverse

from learning.models import Article, Interest, Source
from learning.pipeline.digest import build_digest

from .helpers import FIXTURES
from .test_pipeline import make_article


@override_settings(SECURE_SSL_REDIRECT=False)
class ViewTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.staff = User.objects.create_user("staff", password="pw", is_staff=True)
        cls.reader = User.objects.create_user("reader", password="pw")
        cls.source = Source.objects.create(name="Agentic", feed_url="https://agentic.substack.com/feed")

    def test_pages_are_staff_only(self):
        for name in ("learning:digest", "learning:archive", "learning:articles", "learning:sources"):
            url = reverse(name)
            with self.subTest(url=url):
                self.assertRedirects(self.client.get(url), f"{reverse('login')}?next={url}", fetch_redirect_response=False)
                self.client.force_login(self.reader)
                self.assertEqual(self.client.get(url).status_code, 302)
                self.client.force_login(self.staff)
                self.assertEqual(self.client.get(url).status_code, 200)
                self.client.logout()

    def test_digest_page(self):
        self.client.force_login(self.staff)
        self.assertContains(self.client.get(reverse("learning:digest")), "No digest yet")
        article = make_article(self.source, "Reliable agents")
        article.tags.add("llm agents")
        digest = build_digest()
        response = self.client.get(reverse("learning:digest"))
        self.assertContains(response, digest.headline)
        self.assertContains(response, article.url)
        self.assertContains(response, "Point from Reliable agents")
        self.assertContains(response, "#llm agents")
        dated = reverse("learning:digest_for_date", args=[digest.date.isoformat()])
        self.assertEqual(self.client.get(dated).status_code, 200)
        self.assertEqual(self.client.get(reverse("learning:digest_for_date", args=["not-a-date"])).status_code, 404)
        self.assertEqual(self.client.get(reverse("learning:digest_for_date", args=["2001-01-01"])).status_code, 404)

    def test_toggles_and_filters(self):
        self.client.force_login(self.staff)
        article = make_article(self.source, "Agents")
        other = make_article(self.source, "Cooking")
        url = reverse("learning:toggle", args=[article.pk, "star"])
        self.assertEqual(self.client.get(url).status_code, 405)
        response = self.client.post(url, {"next": reverse("learning:articles")})
        self.assertRedirects(response, reverse("learning:articles"))
        self.assertTrue(Article.objects.get(pk=article.pk).is_starred)
        self.client.post(reverse("learning:toggle", args=[article.pk, "read"]), {"next": "https://evil.test/"})
        self.assertTrue(Article.objects.get(pk=article.pk).is_read)
        self.assertEqual(self.client.post(reverse("learning:toggle", args=[article.pk, "delete"])).status_code, 404)

        starred = self.client.get(reverse("learning:articles"), {"starred": "1"})
        self.assertContains(starred, article.title)
        self.assertNotContains(starred, other.title)
        self.assertNotContains(self.client.get(reverse("learning:articles"), {"q": "agents"}), other.title)

    def test_sources_page_imports_and_manages_interests(self):
        self.client.force_login(self.staff)
        url = reverse("learning:sources")
        self.client.post(url, {"action": "import", "urls": "https://medium.com/@writer\nhttps://medium.com/"})
        self.assertTrue(Source.objects.filter(feed_url="https://medium.com/feed/@writer").exists())
        opml = SimpleUploadedFile("subs.opml", (FIXTURES / "sources.opml").read_bytes())
        response = self.client.post(url, {"action": "import", "opml": opml}, follow=True)
        self.assertContains(response, "Added 1 source(s); 1 already present.")
        self.assertTrue(Source.objects.filter(feed_url="https://pub.towardsai.net/feed").exists())
        self.assertContains(self.client.post(url, {"action": "import"}), "Paste at least one URL")

        self.client.post(url, {"action": "interest", "name": "RAG", "weight": 4})
        interest = Interest.objects.get(name="RAG")
        self.client.post(url, {"action": "toggle_source", "pk": self.source.pk})
        self.assertFalse(Source.objects.get(pk=self.source.pk).is_active)
        self.client.post(url, {"action": "delete_interest", "pk": interest.pk})
        self.assertFalse(Interest.objects.exists())

    def test_nav_link_and_robots(self):
        self.client.force_login(self.staff)
        self.assertContains(self.client.get(reverse("home")), reverse("learning:digest"))
        self.client.force_login(self.reader)
        self.assertNotContains(self.client.get(reverse("home")), reverse("learning:digest"))
        self.assertContains(self.client.get(reverse("robots_txt")), "Disallow: /bytes/")
