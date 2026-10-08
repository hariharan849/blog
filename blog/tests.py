import json
from io import BytesIO, StringIO
from unittest import mock

from django.conf import settings
from django.contrib.auth.models import User
from django.core.management import call_command
from django.test import TestCase, override_settings
from django.urls import reverse

from .models import BlogPost, Category, Comment, PostChunk
from .search import SearchUnavailable, search
from .search.embeddings import EmbeddingError, HashingEmbedder, OpenAICompatibleEmbedder, VoyageEmbedder
from .search.text import chunk_html, html_to_text, snippet


class TextTests(TestCase):
    def test_html_to_text_strips_markup_and_scripts(self):
        html = "<h2>Intro</h2><p>Hello&nbsp;<b>world</b></p><script>alert(1)</script><p>Bye</p>"
        self.assertEqual(html_to_text(html), "Intro\nHello world\nBye")

    def test_chunks_respect_headings_and_overlap(self):
        words = " ".join(f"w{i}" for i in range(25))
        html = f"<p>lead</p><h2>Part A</h2><p>{words}</p><h2>Part B</h2><p>tail</p>"
        chunks = chunk_html(html, title="Post", chunk_words=10, overlap_words=2)
        self.assertEqual([c.heading for c in chunks], ["", "Part A", "Part A", "Part A", "Part B"])
        self.assertEqual([c.position for c in chunks], list(range(5)))
        self.assertTrue(chunks[1].text.startswith("Post > Part A\nw0 "))
        self.assertTrue(chunks[2].text.split("\n")[1].startswith("w8 w9 "))  # 2-word overlap
        self.assertTrue(chunks[3].text.endswith("w24"))

    def test_snippet_centres_on_match(self):
        text = "a " * 300 + "transformers are great " + "b " * 300
        self.assertIn("transformers", snippet(text, "Transformers", length=80))


class HashingEmbedderTests(TestCase):
    def test_vectors_are_normalised_and_similar_text_scores_higher(self):
        embedder = HashingEmbedder({"EMBEDDING_DIMENSIONS": 128})
        query, related, unrelated = embedder.embed(
            ["neural network training", "training a neural network", "baking sourdough bread"]
        )
        self.assertAlmostEqual(sum(v * v for v in query), 1.0, places=6)
        dot = lambda a, b: sum(x * y for x, y in zip(a, b))
        self.assertGreater(dot(query, related), dot(query, unrelated))


class HTTPEmbedderTests(TestCase):
    def test_voyage_request_and_response_order(self):
        body = b'{"data": [{"index": 1, "embedding": [0, 1]}, {"index": 0, "embedding": [1, 0]}]}'
        response = mock.MagicMock()
        response.__enter__.return_value = BytesIO(body)
        embedder = VoyageEmbedder({"EMBEDDING_API_KEY": "key", "EMBEDDING_DIMENSIONS": 2})
        with mock.patch("urllib.request.urlopen", return_value=response) as urlopen:
            vectors = embedder.embed(["a", "b"], "query")
        request = urlopen.call_args.args[0]
        self.assertEqual(request.full_url, "https://api.voyageai.com/v1/embeddings")
        self.assertEqual(request.get_header("Authorization"), "Bearer key")
        self.assertEqual(json.loads(request.data), {"input": ["a", "b"], "model": "voyage-3.5", "input_type": "query"})
        self.assertEqual(vectors, [[1, 0], [0, 1]])

    def test_missing_api_key(self):
        with self.assertRaises(EmbeddingError):
            OpenAICompatibleEmbedder({})


@override_settings(SECURE_SSL_REDIRECT=False)
class BlogTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_superuser("admin", "admin@example.com", "pw")
        cls.ml = Category.objects.create(name="Machine Learning")

    def make_post(self, title, content, published=True, **kwargs):
        with self.captureOnCommitCallbacks(execute=True):
            post = BlogPost.objects.create(
                title=title, content=content, author=self.user, is_published=published, **kwargs
            )
        post.refresh_from_db()
        return post


class ModelTests(BlogTestCase):
    def test_slugs_are_unique(self):
        first = self.make_post("Same Title", "<p>a</p>")
        second = self.make_post("Same Title", "<p>b</p>")
        self.assertEqual(first.slug, "same-title")
        self.assertEqual(second.slug, "same-title-1")

    def test_published_at_set_on_publish(self):
        draft = self.make_post("Draft", "<p>x</p>", published=False)
        self.assertIsNone(draft.published_at)
        draft.is_published = True
        draft.save()
        self.assertIsNotNone(draft.published_at)


class IndexingTests(BlogTestCase):
    def test_saving_a_post_indexes_it(self):
        post = self.make_post("Gradient Descent", "<h2>Basics</h2><p>Gradient descent minimises loss.</p>",
                              excerpt="How models learn.")
        self.assertEqual(post.search_text, "Basics\nGradient descent minimises loss.")
        self.assertTrue(post.content_hash)
        chunks = list(post.chunks.all())
        self.assertEqual(chunks[0].heading, "Summary")
        self.assertEqual(chunks[1].heading, "Basics")
        self.assertEqual(len(chunks[1].embedding), 256)

    def test_unchanged_post_is_not_reembedded(self):
        post = self.make_post("Stable", "<p>same</p>")
        with mock.patch.object(HashingEmbedder, "embed", side_effect=AssertionError("re-embedded")):
            with self.captureOnCommitCallbacks(execute=True):
                post.save()

    def test_embedding_failure_does_not_break_saving(self):
        with mock.patch.object(HashingEmbedder, "embed", side_effect=RuntimeError("provider down")):
            with self.assertLogs("blog.search.indexing", "ERROR"):
                post = self.make_post("Resilient", "<p>still saved</p>")
        self.assertTrue(BlogPost.objects.filter(pk=post.pk).exists())
        self.assertFalse(post.chunks.exists())

    @override_settings(AI_SEARCH={**settings.AI_SEARCH, "AUTO_INDEX": False})
    def test_reindex_command(self):
        post = self.make_post("Later", "<p>indexed by command</p>")
        self.assertFalse(post.chunks.exists())
        out = StringIO()
        call_command("reindex_posts", stdout=out)
        self.assertIn("1 indexed", out.getvalue())
        self.assertTrue(PostChunk.objects.filter(post=post).exists())


class SearchFixtures(BlogTestCase):
    def setUp(self):
        self.cnn = self.make_post(
            "Convolutional Networks", "<p>Convolutions detect edges and shapes in images.</p>", category=self.ml
        )
        self.rnn = self.make_post("Recurrent Networks", "<p>Sequence models for text and time series.</p>")
        self.cnn.tags.add("vision")
        self.draft = self.make_post("Secret Draft", "<p>convolutions draft</p>", published=False)


class SearchTests(SearchFixtures):
    def test_keyword_search_ranks_title_matches_and_hides_drafts(self):
        results = search("convolutions", mode="keyword")
        self.assertEqual([r.post for r in results], [self.cnn])
        self.assertEqual(results[0].matched_by, ["keyword"])

    def test_keyword_search_matches_tags(self):
        self.assertEqual([r.post for r in search("vision", mode="keyword")], [self.cnn])

    def test_semantic_search_returns_passages(self):
        results = search("sequence models for time series", mode="semantic")
        self.assertEqual(results[0].post, self.rnn)
        self.assertIn("Sequence models", results[0].passages[0].text)

    def test_hybrid_merges_both(self):
        results = search("convolutions images", mode="hybrid")
        self.assertEqual(results[0].post, self.cnn)
        self.assertEqual(set(results[0].matched_by), {"keyword", "semantic"})

    def test_hybrid_falls_back_to_keyword_when_embeddings_fail(self):
        with mock.patch.object(HashingEmbedder, "embed", side_effect=RuntimeError("down")):
            with self.assertLogs("blog.search.service", "ERROR"):
                results = search("convolutions", mode="hybrid")
        self.assertEqual([r.post for r in results], [self.cnn])

    def test_semantic_mode_reports_unavailable(self):
        with mock.patch.object(HashingEmbedder, "embed", side_effect=RuntimeError("down")):
            with self.assertRaises(SearchUnavailable):
                search("convolutions", mode="semantic")
            response = self.client.get(reverse("api_search"), {"q": "convolutions", "mode": "semantic"})
        self.assertEqual(response.status_code, 503)

    def test_empty_query(self):
        self.assertEqual(search("  "), [])


class ApiTests(SearchFixtures):
    def test_search_api(self):
        response = self.client.get(reverse("api_search"), {"q": "convolutions", "mode": "hybrid"})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["results"][0]["slug"], self.cnn.slug)
        self.assertEqual(data["results"][0]["tags"], ["vision"])
        self.assertTrue(data["results"][0]["url"].endswith(self.cnn.get_absolute_url()))
        self.assertIn("passages", data["results"][0])

    def test_search_api_filters_and_validation(self):
        response = self.client.get(reverse("api_search"), {"q": "networks", "mode": "keyword", "tag": "vision"})
        self.assertEqual([r["slug"] for r in response.json()["results"]], [self.cnn.slug])
        self.assertEqual(self.client.get(reverse("api_search")).status_code, 400)
        self.assertEqual(self.client.get(reverse("api_search"), {"q": "x", "mode": "nope"}).status_code, 400)

    def test_post_endpoints(self):
        listing = self.client.get(reverse("api_posts")).json()
        self.assertEqual(listing["count"], 2)
        detail = self.client.get(reverse("api_post_detail", args=[self.cnn.slug])).json()
        self.assertIn("Convolutions detect edges", detail["content_text"])
        self.assertEqual(self.client.get(reverse("api_post_detail", args=[self.draft.slug])).status_code, 404)


class PageTests(SearchFixtures):
    def test_home_filters_by_blog(self):
        rajan = self.make_post("Rajan Post", "<p>hi</p>", blog=BlogPost.Blog.RAJAN)
        response = self.client.get(reverse("home"))
        self.assertContains(response, self.cnn.title)
        self.assertNotContains(response, rajan.title)
        self.assertNotContains(response, self.draft.title)
        self.assertContains(self.client.get(reverse("home"), {"blog": "rajan"}), rajan.title)

    def test_post_detail_with_tags_and_structured_data(self):
        response = self.client.get(self.cnn.get_absolute_url())
        self.assertContains(response, reverse("tagged_posts", args=["vision"]))
        self.assertContains(response, '"@type": "BlogPosting"')
        self.assertContains(response, self.rnn.title)  # related post

    def test_comment_requires_login_and_redirects(self):
        url = self.cnn.get_absolute_url()
        data = {"name": "Ann", "email": "ann@example.com", "content": "Nice"}
        self.assertEqual(self.client.post(url, data).status_code, 302)
        self.assertFalse(Comment.objects.exists())
        self.client.force_login(self.user)
        self.assertRedirects(self.client.post(url, data), url)
        self.assertEqual(Comment.objects.get().name, "Ann")

    def test_search_page(self):
        response = self.client.get(reverse("search_results"), {"q": "convolutions"})
        self.assertContains(response, self.cnn.get_absolute_url())
        self.assertNotContains(response, self.draft.title)
        self.assertEqual(self.client.get(reverse("search_results")).status_code, 200)

    def test_tag_and_category_pages(self):
        self.assertContains(self.client.get(reverse("tagged_posts", args=["vision"])), self.cnn.title)
        self.assertContains(self.client.get(self.ml.get_absolute_url()), self.cnn.title)

    def test_add_post_saves_tags(self):
        self.client.force_login(self.user)
        response = self.client.post(reverse("add_post"), {
            "title": "Tagged", "blog": "hariharan", "content": "<p>body</p>", "tags": "ai, search",
            "is_published": "on",
        })
        post = BlogPost.objects.get(title="Tagged")
        self.assertRedirects(response, post.get_absolute_url())
        self.assertEqual(sorted(post.tags.names()), ["ai", "search"])

    def test_discovery_endpoints(self):
        sitemap = self.client.get(reverse("sitemap"))
        self.assertContains(sitemap, self.cnn.get_absolute_url())
        self.assertNotContains(sitemap, self.draft.slug)
        self.assertContains(self.client.get(reverse("robots_txt")), "Sitemap: http://testserver/sitemap.xml")
        llms = self.client.get(reverse("llms_txt"))
        self.assertEqual(llms["Content-Type"], "text/markdown; charset=utf-8")
        self.assertContains(llms, f"[{self.cnn.title}](http://testserver{self.cnn.get_absolute_url()})")
