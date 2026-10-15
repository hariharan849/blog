from unittest import mock

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone

from blog.models import BlogPost
from blog.search.embeddings import HashingEmbedder
from learning.kb.indexing import index_article
from learning.kb.search import kb_search
from learning.models import Article, ArticlePassage, Source
from learning.pipeline.feeds import entry_hash, fetch_all

from .helpers import fake_parse

SUBSTACK = "https://agentic.substack.com/feed"


def newsletter(source, title, html, url=None):
    return Article.objects.create(
        source=source, url=url or f"https://n.test/{title.replace(' ', '-')}", title=title, content_html=html,
        content_text=html, published_at=timezone.now(), content_hash=entry_hash(title, html),
    )


class KnowledgeBaseTestCase(TestCase):
    def setUp(self):
        self.source = Source.objects.create(name="Agentic", feed_url=SUBSTACK)
        self.author = User.objects.create_user("writer")

    def blog_post(self, title, html):
        with self.captureOnCommitCallbacks(execute=True):
            return BlogPost.objects.create(title=title, content=html, author=self.author, is_published=True)


class IndexingTests(KnowledgeBaseTestCase):
    def test_indexes_once_per_content_and_model(self):
        article = newsletter(self.source, "Evals for agents", "<h2>Why</h2><p>Agents need evaluation harnesses.</p>")
        self.assertTrue(index_article(article))
        passage = article.passages.get()
        self.assertEqual(passage.heading, "Why")
        self.assertIsNone(passage.valid_to)
        self.assertEqual(len(passage.embedding), 256)
        with mock.patch.object(HashingEmbedder, "embed", side_effect=AssertionError("re-embedded")):
            self.assertFalse(index_article(article))  # unchanged: no embedding call

    def test_edited_article_supersedes_old_passages(self):
        article = newsletter(self.source, "Evals", "<p>Old claim about evaluation harnesses for agents.</p>")
        index_article(article)
        old = article.passages.get()
        article.content_html = "<p>New corrected claim about retrieval evaluation for agents.</p>"
        article.content_hash = entry_hash(article.title, article.content_html)
        article.save()
        self.assertTrue(index_article(article))

        old.refresh_from_db()
        self.assertIsNotNone(old.valid_to)  # kept, not deleted, so old citations still resolve
        current = article.passages.get(valid_to__isnull=True)
        self.assertIn("corrected", current.text)
        self.assertEqual([hit.text for hit in kb_search("claim", scope="newsletters")], [current.text.split("\n", 1)[1]])

    def test_feed_edit_is_picked_up_and_cross_posts_are_ignored(self):
        with fake_parse({SUBSTACK: "substack.xml"}):
            fetch_all([self.source])
        article = Article.objects.get(url="https://agentic.substack.com/p/reliable-agents")
        index_article(article)
        with fake_parse({SUBSTACK: "substack.xml"}):
            self.assertEqual(fetch_all([self.source]), (0, 0))  # unchanged feed: nothing to do

        edited = article.content_html.replace("fail in surprising ways", "fail in predictable ways")
        with mock.patch("learning.pipeline.feeds._entry_html", return_value=edited):
            with fake_parse({SUBSTACK: "substack.xml"}):
                self.assertEqual(fetch_all([self.source]), (1, 0))
        article.refresh_from_db()
        self.assertIn("predictable", article.content_html)
        self.assertEqual(article.status, Article.Status.NEW)
        self.assertTrue(index_article(article))
        self.assertEqual(article.passages.filter(valid_to__isnull=True).count(), article.passages.count() // 2)


class SearchTests(KnowledgeBaseTestCase):
    def setUp(self):
        super().setUp()
        self.post = self.blog_post("Retrieval basics", "<p>Hybrid retrieval combines keyword and vector search.</p>")
        self.article = newsletter(self.source, "Agent memory", "<p>Agents store memories with vector retrieval tricks.</p>")
        index_article(self.article)

    def test_scopes(self):
        kinds = lambda scope: {hit.kind for hit in kb_search("retrieval", scope=scope)}
        self.assertEqual(kinds("posts"), {"post"})
        self.assertEqual(kinds("newsletters"), {"newsletter"})
        self.assertEqual(kinds("all"), {"post", "newsletter"})

    def test_hit_fields(self):
        [hit] = kb_search("memories", scope="newsletters", mode="keyword")
        self.assertEqual(hit.url, self.article.url)
        self.assertEqual(hit.source, "Agentic")
        self.assertTrue(hit.id.startswith("newsletter:"))
        self.assertFalse(hit.text.startswith("Agent memory"))  # context line stripped
        self.assertEqual(hit.matched_by, ["keyword"])

        [post_hit] = kb_search("hybrid retrieval", scope="posts", mode="keyword")
        self.assertEqual(post_hit.url, f"/post/{self.post.slug}/")

    def test_hybrid_merges_and_survives_embedding_outage(self):
        hit = kb_search("vector retrieval", scope="all")[0]
        self.assertEqual(set(hit.matched_by), {"keyword", "semantic"})
        with mock.patch.object(HashingEmbedder, "embed", side_effect=RuntimeError("down")):
            with self.assertLogs("learning.kb.search", "ERROR"):
                self.assertTrue(kb_search("vector retrieval", scope="all"))

    def test_unpublished_and_superseded_content_is_excluded(self):
        BlogPost.objects.filter(pk=self.post.pk).update(is_published=False)
        ArticlePassage.objects.update(valid_to=timezone.now())
        self.assertEqual(kb_search("retrieval", scope="all"), [])
