"""Read-mostly JSON API consumed by the Next.js frontend (see /frontend).

Endpoints
---------
GET  /api/posts/                 ?q=&category=&tag=&author=&page=&page_size=
GET  /api/posts/<slug>/          post detail + related posts + comments
POST /api/posts/<slug>/comments/ {"name", "email", "content"}
GET  /api/categories/
GET  /api/tags/
GET  /api/authors/
GET  /api/recent/                ?limit=
"""
import html as html_lib
import json
import re

from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.core.paginator import EmptyPage, Paginator
from django.core.validators import validate_email
from django.db.models import Count, Q
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_http_methods
from taggit.models import Tag

from .models import BlogPost, Category, Comment

MAX_PAGE_SIZE = 50


def _published():
    return (
        BlogPost.objects.filter(is_published=True)
        .select_related("author", "category")
        .prefetch_related("tags")
        .order_by("-created_at")
    )


def _author_name(user):
    full = user.get_full_name().strip()
    return full or user.username


def _excerpt(markup, words=40):
    # Replace tags with spaces first so block elements don't run together.
    text = " ".join(html_lib.unescape(re.sub(r"<[^>]+>", " ", markup or "")).split())
    parts = text.split(" ")
    return text if len(parts) <= words else " ".join(parts[:words]) + "…"


def _image_url(request, post):
    if not post.image:
        return None
    try:
        return request.build_absolute_uri(post.image.url)
    except ValueError:
        return None


def _category(category):
    if category is None:
        return None
    return {"name": category.name, "slug": category.slug}


def _post_summary(request, post):
    return {
        "title": post.title,
        "slug": post.slug,
        "excerpt": _excerpt(post.content),
        "image": _image_url(request, post),
        "author": {"username": post.author.username, "name": _author_name(post.author)},
        "category": _category(post.category),
        "tags": [{"name": t.name, "slug": t.slug} for t in post.tags.all()],
        "created_at": post.created_at.isoformat(),
        "updated_at": post.updated_at.isoformat(),
    }


def _comment(comment):
    return {
        "id": comment.id,
        "name": comment.name,
        "content": comment.content,
        "created_at": comment.created_at.isoformat(),
    }


def _int(value, default, minimum=1, maximum=None):
    try:
        number = int(value)
    except (TypeError, ValueError):
        return default
    number = max(minimum, number)
    return min(number, maximum) if maximum else number


@require_GET
def post_list(request):
    posts = _published()
    q = request.GET.get("q", "").strip()
    category = request.GET.get("category", "").strip()
    tag = request.GET.get("tag", "").strip()
    author = request.GET.get("author", "").strip()

    if q:
        posts = posts.filter(Q(title__icontains=q) | Q(content__icontains=q))
    if category:
        posts = posts.filter(category__slug=category)
    if tag:
        posts = posts.filter(tags__slug=tag)
    if author:
        posts = posts.filter(author__username__iexact=author)

    page_size = _int(request.GET.get("page_size"), 10, maximum=MAX_PAGE_SIZE)
    paginator = Paginator(posts.distinct(), page_size)
    page_number = _int(request.GET.get("page"), 1)
    try:
        page = paginator.page(page_number)
    except EmptyPage:
        page = paginator.page(paginator.num_pages)

    return JsonResponse(
        {
            "results": [_post_summary(request, p) for p in page.object_list],
            "page": page.number,
            "num_pages": paginator.num_pages,
            "count": paginator.count,
        }
    )


@require_GET
def post_detail(request, slug):
    post = get_object_or_404(_published(), slug=slug)
    related = _published().exclude(pk=post.pk)
    related = related.filter(category=post.category) if post.category else related.none()
    data = _post_summary(request, post)
    data["content"] = post.content
    data["related"] = [_post_summary(request, p) for p in related[:5]]
    data["comments"] = [_comment(c) for c in post.comments.order_by("-created_at")]
    return JsonResponse(data)


@csrf_exempt  # Called server-to-server by the Next.js frontend; no session or cookies involved.
@require_http_methods(["POST"])
def add_comment(request, slug):
    post = get_object_or_404(BlogPost, slug=slug, is_published=True)
    try:
        payload = json.loads(request.body or b"{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON body."}, status=400)

    name = str(payload.get("name", "")).strip()[:100]
    email = str(payload.get("email", "")).strip()
    content = str(payload.get("content", "")).strip()[:5000]

    errors = {}
    if not name:
        errors["name"] = "Name is required."
    try:
        validate_email(email)
    except ValidationError:
        errors["email"] = "A valid email is required."
    if not content:
        errors["content"] = "Comment cannot be empty."
    if errors:
        return JsonResponse({"errors": errors}, status=400)

    comment = Comment.objects.create(post=post, name=name, email=email, content=content)
    return JsonResponse(_comment(comment), status=201)


@require_GET
def category_list(request):
    categories = (
        Category.objects.annotate(
            post_count=Count("blogpost", filter=Q(blogpost__is_published=True))
        )
        .exclude(slug__isnull=True)
        .order_by("name")
    )
    return JsonResponse(
        {
            "results": [
                {"name": c.name, "slug": c.slug, "post_count": c.post_count}
                for c in categories
            ]
        }
    )


@require_GET
def tag_list(request):
    tags = Tag.objects.filter(
        taggit_taggeditem_items__object_id__in=_published().values("pk")
    ).distinct().order_by("name")
    return JsonResponse({"results": [{"name": t.name, "slug": t.slug} for t in tags]})


@require_GET
def author_list(request):
    authors = (
        User.objects.annotate(
            post_count=Count("blogpost", filter=Q(blogpost__is_published=True))
        )
        .filter(post_count__gt=0)
        .order_by("username")
    )
    return JsonResponse(
        {
            "results": [
                {"username": u.username, "name": _author_name(u), "post_count": u.post_count}
                for u in authors
            ]
        }
    )


@require_GET
def recent_posts(request):
    limit = _int(request.GET.get("limit"), 5, maximum=20)
    return JsonResponse(
        {"results": [_post_summary(request, p) for p in _published()[:limit]]}
    )
