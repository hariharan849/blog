"""Endpoints that help search engines and AI crawlers/agents discover and understand the blog."""
from django.contrib.sitemaps import Sitemap
from django.http import HttpResponse
from django.urls import reverse
from django.views.decorators.cache import cache_page
from django.views.decorators.http import require_GET

from .models import BlogPost, Category


class PostSitemap(Sitemap):
    changefreq = "weekly"
    priority = 0.8

    def items(self):
        return BlogPost.objects.published()

    def lastmod(self, post):
        return post.updated_at


class CategorySitemap(Sitemap):
    changefreq = "weekly"
    priority = 0.5

    def items(self):
        return Category.objects.filter(blogpost__is_published=True).distinct()


class StaticSitemap(Sitemap):
    priority = 0.6

    def items(self):
        return ["home", "about_hariharan", "about_rajan"]

    def location(self, name):
        return reverse(name)


sitemaps = {"posts": PostSitemap, "categories": CategorySitemap, "pages": StaticSitemap}


@require_GET
def robots_txt(request):
    lines = [
        "User-agent: *",
        "Disallow: /admin/",
        "Disallow: /add/",
        "Disallow: /accounts/",
        "Allow: /",
        "",
        f"Sitemap: {request.build_absolute_uri(reverse('sitemap'))}",
    ]
    return HttpResponse("\n".join(lines) + "\n", content_type="text/plain")


@require_GET
@cache_page(60 * 15)
def llms_txt(request):
    """https://llmstxt.org – a markdown map of the site for LLMs and AI agents."""
    absolute = request.build_absolute_uri
    lines = [
        "# PyChanter Blog",
        "",
        "> Personal blogs of Hariharan Manoharan and Rajan Singh about Python, machine learning "
        "and deep learning.",
        "",
        "## API",
        "",
        f"- [Search]({absolute(reverse('api_search'))}?q=your+question&mode=hybrid): keyword, "
        "semantic or hybrid search; results include the most relevant passages for grounding answers",
        f"- [Posts]({absolute(reverse('api_posts'))}): paginated list of published posts as JSON",
        "- Full post text: /api/v1/posts/<slug>/",
        "",
    ]
    for blog, label in BlogPost.Blog.choices:
        posts = BlogPost.objects.published().for_blog(blog)
        if not posts.exists():
            continue
        lines += [f"## {label}", ""]
        for post in posts:
            summary = post.summary.replace("\n", " ")
            lines.append(f"- [{post.title}]({absolute(post.get_absolute_url())}): {summary}")
        lines.append("")
    return HttpResponse("\n".join(lines), content_type="text/markdown; charset=utf-8")
