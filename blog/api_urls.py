from django.urls import path

from . import api

urlpatterns = [
    path("posts/", api.post_list, name="api_post_list"),
    path("posts/<slug:slug>/", api.post_detail, name="api_post_detail"),
    path("posts/<slug:slug>/comments/", api.add_comment, name="api_add_comment"),
    path("categories/", api.category_list, name="api_category_list"),
    path("tags/", api.tag_list, name="api_tag_list"),
    path("authors/", api.author_list, name="api_author_list"),
    path("recent/", api.recent_posts, name="api_recent_posts"),
]
