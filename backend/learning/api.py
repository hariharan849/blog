"""Staff-only JSON API for Daily Bytes, mounted at /api/v1/bytes/."""
from datetime import date as date_type

from django.db.models import Q
from django.http import Http404
from django.shortcuts import get_object_or_404
from rest_framework import generics, mixins, permissions, status, viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Article, DailyDigest, Interest, PipelineFailure, Source
from .pipeline.feeds import import_sources
from .serializers import (
    ArticleSerializer, DigestSerializer, DigestSummarySerializer, InterestSerializer, PipelineFailureSerializer,
    SourceSerializer,
)


class StaffOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_active and request.user.is_staff)


class StaffMixin:
    permission_classes = [StaffOnly]


class DigestListView(StaffMixin, generics.ListAPIView):
    queryset = DailyDigest.objects.all()
    serializer_class = DigestSummarySerializer


class DigestDetailView(StaffMixin, APIView):
    def get(self, request, date):
        if date == "latest":
            digest = DailyDigest.objects.first()
            if digest is None:
                raise Http404("No digest yet.")
        else:
            try:
                day = date_type.fromisoformat(date)
            except ValueError:
                raise Http404("Invalid date.")
            digest = get_object_or_404(DailyDigest, date=day)
        return Response(DigestSerializer(digest).data)


class ArticleViewSet(StaffMixin, mixins.ListModelMixin, mixins.UpdateModelMixin, viewsets.GenericViewSet):
    """List with ?q=&tag=&source=&starred=1&unread=1; PATCH is_read / is_starred."""

    serializer_class = ArticleSerializer
    http_method_names = ["get", "patch"]

    def get_queryset(self):
        articles = Article.objects.select_related("source").prefetch_related("tags").order_by("-published_at")
        params = self.request.query_params
        if q := params.get("q"):
            articles = articles.filter(Q(title__icontains=q) | Q(summary__icontains=q))
        if tag := params.get("tag"):
            articles = articles.filter(tags__slug=tag).distinct()
        if source := params.get("source"):
            articles = articles.filter(source_id=source)
        if params.get("starred"):
            articles = articles.filter(is_starred=True)
        if params.get("unread"):
            articles = articles.filter(is_read=False)
        return articles


class SourceViewSet(StaffMixin, mixins.ListModelMixin, mixins.UpdateModelMixin, viewsets.GenericViewSet):
    """GET list; POST a URL list (``urls``) and/or an OPML file (``opml``); PATCH is_active."""

    queryset = Source.objects.all()
    serializer_class = SourceSerializer
    pagination_class = None
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    http_method_names = ["get", "post", "patch"]

    def create(self, request):
        batches = []
        if urls := (request.data.get("urls") or "").strip():
            batches.append((urls, ""))
        if upload := request.FILES.get("opml"):
            batches.append((upload.read().decode("utf-8", errors="replace"), upload.name))
        if not batches:
            raise ValidationError({"urls": ["Paste at least one URL or upload an OPML file."]})
        created, existing, errors = [], [], []
        for content, filename in batches:
            try:
                new, old, failed = import_sources(content, filename)
            except Exception as exc:  # e.g. malformed OPML
                new, old, failed = [], [], [f"{filename or 'URL list'}: {exc}"]
            created += new
            existing += old
            errors += failed
        return Response(
            {"created": SourceSerializer(created, many=True).data, "existing": len(existing), "errors": errors},
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class InterestViewSet(StaffMixin, mixins.ListModelMixin, mixins.CreateModelMixin, mixins.DestroyModelMixin,
                      viewsets.GenericViewSet):
    queryset = Interest.objects.all()
    serializer_class = InterestSerializer
    pagination_class = None


class PipelineFailureViewSet(StaffMixin, mixins.ListModelMixin, mixins.UpdateModelMixin, viewsets.GenericViewSet):
    """Pipeline steps that failed after retries. ?resolved=0 for open ones; PATCH resolved."""

    serializer_class = PipelineFailureSerializer
    http_method_names = ["get", "patch"]

    def get_queryset(self):
        failures = PipelineFailure.objects.select_related("article", "source")
        resolved = self.request.query_params.get("resolved")
        if resolved in ("0", "1"):
            failures = failures.filter(resolved=resolved == "1")
        return failures
