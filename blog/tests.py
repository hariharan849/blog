import json

from django.contrib.auth.models import User
from django.test import TestCase, override_settings

from .models import BlogPost, Category, Comment


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["testserver"])
class ApiTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("hariharan", password="x", first_name="Hariharan")
        self.other = User.objects.create_user("guest", password="x")
        self.cat = Category.objects.create(name="Deep Learning")
        self.post = BlogPost.objects.create(
            title="Hello World", content="<p>Intro to <b>nets</b></p><p>Part&nbsp;two &amp; more</p>",
            author=self.user, category=self.cat, is_published=True,
        )
        self.post.tags.add("pytorch")
        BlogPost.objects.create(
            title="Related One", content="x", author=self.other,
            category=self.cat, is_published=True,
        )
        BlogPost.objects.create(title="Draft", content="secret", author=self.user)

    def test_list_only_published(self):
        data = self.client.get("/api/posts/").json()
        self.assertEqual(data["count"], 2)
        titles = {p["title"] for p in data["results"]}
        self.assertNotIn("Draft", titles)

    def test_filters(self):
        self.assertEqual(self.client.get("/api/posts/?author=guest").json()["count"], 1)
        self.assertEqual(self.client.get("/api/posts/?tag=pytorch").json()["count"], 1)
        self.assertEqual(self.client.get("/api/posts/?category=deep-learning").json()["count"], 2)
        self.assertEqual(self.client.get("/api/posts/?q=nets").json()["count"], 1)

    def test_detail(self):
        data = self.client.get("/api/posts/hello-world/").json()
        self.assertEqual(data["author"]["name"], "Hariharan")
        self.assertEqual(data["excerpt"], "Intro to nets Part two & more")
        self.assertEqual([r["slug"] for r in data["related"]], ["related-one"])
        self.assertEqual(self.client.get("/api/posts/draft/").status_code, 404)

    def test_add_comment(self):
        url = "/api/posts/hello-world/comments/"
        bad = self.client.post(url, data=json.dumps({"name": "", "email": "nope"}),
                               content_type="application/json")
        self.assertEqual(bad.status_code, 400)
        self.assertEqual(set(bad.json()["errors"]), {"name", "email", "content"})

        ok = self.client.post(url, data=json.dumps(
            {"name": "Ann", "email": "ann@example.com", "content": "Nice"}),
            content_type="application/json")
        self.assertEqual(ok.status_code, 201)
        self.assertEqual(Comment.objects.count(), 1)
        self.assertNotIn("email", ok.json())

    def test_categories_and_authors(self):
        cats = self.client.get("/api/categories/").json()["results"]
        self.assertEqual(cats, [{"name": "Deep Learning", "slug": "deep-learning", "post_count": 2}])
        authors = self.client.get("/api/authors/").json()["results"]
        self.assertEqual([a["username"] for a in authors], ["guest", "hariharan"])
