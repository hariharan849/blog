"""JSON API (v1) used by the Next.js frontend, search engines, AI agents and RAG pipelines.

Public:   GET  search/  posts/  posts/<slug>/  posts/<slug>/comments/  categories/  tags/<slug>/
Users:    POST posts/<slug>/comments/
Admins:   POST posts/
Auth:     GET  auth/csrf/  auth/me/      POST auth/login/  auth/logout/  auth/register/
"""
from django.conf import settings
from django.contrib.auth import authenticate, login, logout
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from rest_framework import generics, permissions, status
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView
from taggit.models import Tag

from .models import BlogPost, Category
from .search import SearchUnavailable, search
from .search.service import MODES
from .serializers import (
    CategorySerializer, CommentSerializer, PostDetailSerializer, PostSerializer, PostWriteSerializer,
    RegisterSerializer, UserSerializer,
)
from .services import article_json_ld, related_posts_for


class IsSuperuserOrReadOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.method in permissions.SAFE_METHODS or bool(request.user and request.user.is_superuser)


def published_posts(request):
    posts = BlogPost.objects.published().select_related("author", "category").prefetch_related("tags")
    if blog := request.query_params.get("blog"):
        posts = posts.filter(blog=blog)
    if category := request.query_params.get("category"):
        posts = posts.filter(category__slug=category)
    if tag := request.query_params.get("tag"):
        posts = posts.filter(tags__slug=tag).distinct()
    return posts


class PostListView(generics.ListCreateAPIView):
    permission_classes = [IsSuperuserOrReadOnly]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_queryset(self):
        return published_posts(self.request)

    def get_serializer_class(self):
        return PostWriteSerializer if self.request.method == "POST" else PostSerializer

    def create(self, request, *args, **kwargs):
        serializer = PostWriteSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        post = serializer.save()
        return Response(PostDetailSerializer(post, context={"request": request}).data, status=status.HTTP_201_CREATED)


class PostDetailView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, slug):
        post = get_object_or_404(
            BlogPost.objects.published().select_related("author", "category").prefetch_related("tags"), slug=slug
        )
        data = PostDetailSerializer(post, context={"request": request}).data
        data["related"] = [{"title": p.title, "slug": p.slug} for p in related_posts_for(post)]
        data["structured_data"] = article_json_ld(request, post)
        data["comment_count"] = post.comments.count()
        return Response(data)


class CommentListView(generics.ListCreateAPIView):
    serializer_class = CommentSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    pagination_class = None

    def get_post(self):
        return get_object_or_404(BlogPost.objects.published(), slug=self.kwargs["slug"])

    def get_queryset(self):
        return self.get_post().comments.order_by("-created_at")

    def perform_create(self, serializer):
        user = self.request.user
        serializer.save(
            post=self.get_post(),
            name=serializer.validated_data.get("name") or user.get_full_name() or user.username,
            email=serializer.validated_data.get("email") or user.email or "",
        )


class CategoryListView(generics.ListAPIView):
    serializer_class = CategorySerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = None

    def get_queryset(self):
        return (
            Category.objects.annotate(post_count=Count("blogpost", filter=Q(blogpost__is_published=True)))
            .filter(post_count__gt=0)
            .order_by("name")
        )


class CategoryDetailView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, slug):
        category = get_object_or_404(Category, slug=slug)
        return Response({"name": category.name, "slug": category.slug})


class TagDetailView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, slug):
        tag = get_object_or_404(Tag, slug=slug)
        return Response({"name": tag.name, "slug": tag.slug})


class SearchView(APIView):
    """GET /api/v1/search/?q=...&mode=hybrid|semantic|keyword&limit=10&blog=&category=&tag="""

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        query = request.query_params.get("q", "").strip()
        if not query:
            raise ValidationError({"q": ["Query parameter 'q' is required."]})
        mode = request.query_params.get("mode") or settings.AI_SEARCH["DEFAULT_MODE"]
        if mode not in MODES:
            raise ValidationError({"mode": [f"'mode' must be one of: {', '.join(MODES)}."]})
        try:
            limit = int(request.query_params.get("limit", 10))
        except ValueError:
            raise ValidationError({"limit": ["'limit' must be an integer."]})
        try:
            results = search(query, mode=mode, limit=limit, queryset=published_posts(request))
        except SearchUnavailable:
            return Response(
                {"error": "Semantic search is temporarily unavailable; try mode=keyword."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        context = {"request": request}
        return Response({
            "query": query,
            "mode": mode,
            "count": len(results),
            "results": [
                {
                    **PostSerializer(result.post, context=context).data,
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


# --- Authentication (session cookie + CSRF, same origin as the frontend) ---

def user_payload(request):
    if not request.user.is_authenticated:
        return {"authenticated": False, "user": None}
    return {"authenticated": True, "user": UserSerializer(request.user).data}


@method_decorator(ensure_csrf_cookie, name="dispatch")
class CsrfView(APIView):
    """Sets the ``csrftoken`` cookie the frontend echoes back in the X-CSRFToken header."""

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response({"ok": True})


class MeView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response(user_payload(request))


@method_decorator(csrf_protect, name="dispatch")  # DRF skips CSRF for anonymous users; login must not.
class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        user = authenticate(
            request, username=request.data.get("username", ""), password=request.data.get("password", "")
        )
        if user is None:
            return Response({"error": "Invalid username or password."}, status=status.HTTP_400_BAD_REQUEST)
        login(request, user)
        return Response(user_payload(request))


class LogoutView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        logout(request)
        return Response(user_payload(request))


@method_decorator(csrf_protect, name="dispatch")
class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        login(request, user, backend="django.contrib.auth.backends.ModelBackend")
        return Response(user_payload(request), status=status.HTTP_201_CREATED)
