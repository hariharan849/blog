"""Read-only JSON API (v1) for search engines, AI agents and RAG pipelines.

    GET /api/v1/search/?q=...&mode=hybrid|semantic|keyword&limit=10&blog=&category=&tag=
    GET /api/v1/posts/?blog=&category=&tag=&page=
    GET /api/v1/posts/<slug>/
"""
from django.conf import settings
from django.core.paginator import EmptyPage, Paginator
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_GET

from .models import BlogPost
from .search import search
from .search.service import MODES, SearchUnavailable

PAGE_SIZE = 20


def _filtered_posts(request):
    posts = BlogPost.objects.published().select_related("author", "category").prefetch_related("tags")
    if blog := request.GET.get("blog"):
        posts = posts.filter(blog=blog)
    if category := request.GET.get("category"):
        posts = posts.filter(category__slug=category)
    if tag := request.GET.get("tag"):
        posts = posts.filter(tags__slug=tag).distinct()
    return posts


def serialize_post(request, post, full=False):
    data = {
        "title": post.title,
        "slug": post.slug,
        "url": request.build_absolute_uri(post.get_absolute_url()),
        "blog": post.blog,
        "author": post.author.get_full_name() or post.author.username,
        "category": post.category.name if post.category else None,
        "tags": sorted(post.tags.names()),
        "summary": post.summary,
        "image": request.build_absolute_uri(post.image.url) if post.image else None,
        "published_at": (post.published_at or post.created_at).isoformat(),
        "updated_at": post.updated_at.isoformat(),
    }
    if full:
        data["content_html"] = post.content
        data["content_text"] = post.search_text
    return data


def _error(message, status=400):
    return JsonResponse({"error": message}, status=status)


@require_GET
def search_api(request):
    query = request.GET.get("q", "").strip()
    if not query:
        return _error("Query parameter 'q' is required.")
    mode = request.GET.get("mode") or settings.AI_SEARCH["DEFAULT_MODE"]
    if mode not in MODES:
        return _error(f"'mode' must be one of: {', '.join(MODES)}.")
    try:
        limit = int(request.GET.get("limit", 10))
    except ValueError:
        return _error("'limit' must be an integer.")
    try:
        results = search(query, mode=mode, limit=limit, queryset=_filtered_posts(request))
    except SearchUnavailable:
        return _error("Semantic search is temporarily unavailable; try mode=keyword.", status=503)
    return JsonResponse({
        "query": query,
        "mode": mode,
        "count": len(results),
        "results": [
            {
                **serialize_post(request, result.post),
                "score": result.score,
                "matched_by": result.matched_by,
                "snippet": result.snippet,
                "passages": [
                    {"heading": passage.heading, "text": passage.text, "score": passage.score}
                    for passage in result.passages
                ],
            }
            for result in results
        ],
    })


@require_GET
def post_list_api(request):
    paginator = Paginator(_filtered_posts(request), PAGE_SIZE)
    try:
        page = paginator.page(request.GET.get("page", 1))
    except (EmptyPage, ValueError):
        return _error("Page not found.", status=404)
    return JsonResponse({
        "count": paginator.count,
        "page": page.number,
        "num_pages": paginator.num_pages,
        "results": [serialize_post(request, post) for post in page.object_list],
    })


@require_GET
def post_detail_api(request, slug):
    post = get_object_or_404(BlogPost.objects.published().select_related("author", "category"), slug=slug)
    return JsonResponse(serialize_post(request, post, full=True))
