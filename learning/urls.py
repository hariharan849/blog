from django.urls import path

from . import views

app_name = "learning"

urlpatterns = [
    path("", views.digest_view, name="digest"),
    path("archive/", views.archive_view, name="archive"),
    path("articles/", views.articles_view, name="articles"),
    path("articles/<int:pk>/<str:field>/", views.toggle_view, name="toggle"),
    path("sources/", views.sources_view, name="sources"),
    path("<str:date>/", views.digest_view, name="digest_for_date"),
]
