from django.urls import path
from rest_framework.routers import SimpleRouter

from . import api

router = SimpleRouter()
router.register("articles", api.ArticleViewSet, basename="bytes-article")
router.register("sources", api.SourceViewSet, basename="bytes-source")
router.register("interests", api.InterestViewSet, basename="bytes-interest")

urlpatterns = [
    path("digests/", api.DigestListView.as_view(), name="bytes-digests"),
    path("digests/<str:date>/", api.DigestDetailView.as_view(), name="bytes-digest-detail"),
    *router.urls,
]
