import logging

from django.conf import settings

from .models import BlogPost
from .search.service import semantic_search

logger = logging.getLogger(__name__)


def absolute_url(request, path):
    """Public URL for ``path``: ``SITE_URL`` when configured, else derived from the request."""
    if settings.SITE_URL:
        return f"{settings.SITE_URL}{path}"
    return request.build_absolute_uri(path)


def article_json_ld(request, post):
    """schema.org BlogPosting data so search engines and AI crawlers can understand the post."""
    data = {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        "headline": post.title,
        "description": post.summary,
        "url": absolute_url(request, post.get_absolute_url()),
        "datePublished": (post.published_at or post.created_at).isoformat(),
        "dateModified": post.updated_at.isoformat(),
        "author": {"@type": "Person", "name": post.author.get_full_name() or post.author.username},
        "keywords": ", ".join(sorted(post.tags.names())),
    }
    if post.category:
        data["articleSection"] = post.category.name
    if post.image:
        data["image"] = absolute_url(request, post.image.url)
    return data


def related_posts_for(post, limit=5):
    """Posts most similar in meaning (via embeddings), falling back to the same category."""
    queryset = BlogPost.objects.published().exclude(pk=post.pk)
    if post.search_text:
        try:
            hits = semantic_search(f"{post.title}\n{post.summary}", queryset, limit)
            if hits:
                return [hit_post for hit_post, _score, _passages in hits]
        except Exception:
            logger.exception("Related-post lookup failed for %s", post.pk)
    if post.category_id:
        return list(queryset.filter(category=post.category_id)[:limit])
    return []
