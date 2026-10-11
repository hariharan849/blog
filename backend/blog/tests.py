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

    def test_summary_uses_first_paragraph(self):
        post = self.make_post("Summaries", "<h2>Intro</h2><p>This opening paragraph explains what the post is about.</p><p>More text follows here later on.</p>")
        self.assertEqual(post.summary, "This opening paragraph explains what the post is about.")

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
        self.assertFalse(results[0].snippet.startswith("Recurrent Networks"))  # no chunk context prefix
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


class BlogApiTests(SearchFixtures):
    def test_post_list_filters_by_blog_category_and_tag(self):
        rajan = self.make_post("Rajan Post", "<p>hi</p>", blog=BlogPost.Blog.RAJAN)
        slugs = lambda params: [p["slug"] for p in self.client.get(reverse("api_posts"), params).json()["results"]]
        self.assertNotIn(self.draft.slug, slugs({}))
        self.assertEqual(slugs({"blog": "rajan"}), [rajan.slug])
        self.assertEqual(slugs({"category": self.ml.slug}), [self.cnn.slug])
        self.assertEqual(slugs({"tag": "vision"}), [self.cnn.slug])
        first = self.client.get(reverse("api_posts")).json()["results"][0]
        self.assertEqual(set(first) >= {"category_slug", "summary", "image", "url"}, True)

    def test_post_detail_has_related_posts_and_structured_data(self):
        data = self.client.get(reverse("api_post_detail", args=[self.cnn.slug])).json()
        self.assertEqual(data["structured_data"]["@type"], "BlogPosting")
        self.assertEqual(data["tag_slugs"], [{"name": "vision", "slug": "vision"}])
        self.assertIn(self.rnn.slug, [p["slug"] for p in data["related"]])
        self.assertEqual(data["url"], f"http://testserver/post/{self.cnn.slug}/")
        self.assertEqual(data["reading_minutes"], 1)

    def test_reading_minutes_scales_with_length(self):
        long_post = self.make_post("Long read", "<p>" + "word " * 2300 + "</p>")
        data = self.client.get(reverse("api_post_detail", args=[long_post.slug])).json()
        self.assertEqual(data["reading_minutes"], 10)

    @override_settings(SITE_URL="https://blog.example.com")
    def test_site_url_is_used_for_canonical_links(self):
        data = self.client.get(reverse("api_post_detail", args=[self.cnn.slug])).json()
        self.assertEqual(data["url"], f"https://blog.example.com/post/{self.cnn.slug}/")

    def test_comments_require_login(self):
        url = reverse("api_post_comments", args=[self.cnn.slug])
        self.assertEqual(self.client.post(url, {"content": "Nice"}, content_type="application/json").status_code, 403)
        self.client.force_login(self.user)
        response = self.client.post(url, {"content": "Nice"}, content_type="application/json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(Comment.objects.get().name, "admin")  # defaults to the user's name
        self.assertEqual([c["content"] for c in self.client.get(url).json()], ["Nice"])
        self.assertEqual(self.client.post(url, {"content": " "}, content_type="application/json").status_code, 400)

    def test_only_superusers_create_posts_and_html_is_sanitised(self):
        url = reverse("api_posts")
        data = {"title": "Tagged", "blog": "hariharan", "content": '<p onclick="x()">body</p><script>alert(1)</script>',
                "tags": "ai, search", "new_category": "LLMs", "is_published": True}
        self.assertEqual(self.client.post(url, data, content_type="application/json").status_code, 403)
        reader = User.objects.create_user("reader", password="pw")
        self.client.force_login(reader)
        self.assertEqual(self.client.post(url, data, content_type="application/json").status_code, 403)
        self.client.force_login(self.user)
        response = self.client.post(url, data, content_type="application/json")
        self.assertEqual(response.status_code, 201, response.content)
        post = BlogPost.objects.get(title="Tagged")
        self.assertEqual(post.content, "<p>body</p>")
        self.assertEqual(sorted(post.tags.names()), ["ai", "search"])
        self.assertEqual(post.category.name, "LLMs")
        self.assertEqual(response.json()["slug"], post.slug)

    def test_categories_and_tags(self):
        self.assertEqual(self.client.get(reverse("api_categories")).json(),
                         [{"name": "Machine Learning", "slug": "machine-learning", "post_count": 1}])
        self.assertEqual(self.client.get(reverse("api_tag_detail", args=["vision"])).json()["name"], "vision")
        self.assertEqual(self.client.get(reverse("api_category_detail", args=["nope"])).status_code, 404)

    def test_discovery_endpoints(self):
        sitemap = self.client.get(reverse("sitemap"))
        self.assertContains(sitemap, self.cnn.get_absolute_url())
        self.assertContains(sitemap, "/about/rajan/")
        self.assertNotContains(sitemap, self.draft.slug)
        robots = self.client.get(reverse("robots_txt"))
        self.assertContains(robots, "Sitemap: http://testserver/sitemap.xml")
        self.assertContains(robots, "Disallow: /bytes")
        llms = self.client.get(reverse("llms_txt"))
        self.assertEqual(llms["Content-Type"], "text/markdown; charset=utf-8")
        self.assertContains(llms, f"[{self.cnn.title}](http://testserver{self.cnn.get_absolute_url()})")


@override_settings(SECURE_SSL_REDIRECT=False)
class AuthApiTests(TestCase):
    def setUp(self):
        self.client = self.client_class(enforce_csrf_checks=True)

    def csrf(self):
        self.client.get(reverse("api_csrf"))
        return {"HTTP_X_CSRFTOKEN": self.client.cookies["csrftoken"].value}

    def test_register_login_me_logout_with_csrf(self):
        payload = {"username": "ann", "email": "ann@example.com", "password1": "a-Long-pass-123", "password2": "a-Long-pass-123"}
        self.assertEqual(self.client.post(reverse("api_register"), payload, content_type="application/json").status_code, 403)
        response = self.client.post(reverse("api_register"), payload, content_type="application/json", **self.csrf())
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(response.json()["user"]["username"], "ann")
        self.assertTrue(self.client.get(reverse("api_me")).json()["authenticated"])

        self.client.post(reverse("api_logout"), content_type="application/json", **self.csrf())
        self.assertFalse(self.client.get(reverse("api_me")).json()["authenticated"])

        bad = self.client.post(reverse("api_login"), {"username": "ann", "password": "wrong"},
                               content_type="application/json", **self.csrf())
        self.assertEqual(bad.json()["error"], "Invalid username or password.")
        good = self.client.post(reverse("api_login"), {"username": "ann", "password": "a-Long-pass-123"},
                                content_type="application/json", **self.csrf())
        self.assertEqual(good.json()["user"], {"username": "ann", "email": "ann@example.com", "name": "ann",
                                               "is_staff": False, "is_superuser": False})

    def test_register_validation(self):
        User.objects.create_user("taken", email="t@example.com", password="pw")
        response = self.client.post(reverse("api_register"), {
            "username": "Taken", "email": "x@example.com", "password1": "123", "password2": "123",
        }, content_type="application/json", **self.csrf())
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"], "Username already exists.")
        weak = self.client.post(reverse("api_register"), {
            "username": "new", "email": "n@example.com", "password1": "123", "password2": "123",
        }, content_type="application/json", **self.csrf())
        self.assertEqual(weak.status_code, 400)
        self.assertIn("password1", weak.json()["fields"])
        mismatch = self.client.post(reverse("api_register"), {
            "username": "new", "email": "n@example.com", "password1": "a-Long-pass-123", "password2": "other-Pass-456",
        }, content_type="application/json", **self.csrf())
        self.assertEqual(mismatch.json()["error"], "Passwords do not match.")
