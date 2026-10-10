from django.contrib.sitemaps.views import sitemap
from django.urls import path

from . import api, discovery

api_urlpatterns = [
    path('search/', api.SearchView.as_view(), name='api_search'),
    path('posts/', api.PostListView.as_view(), name='api_posts'),
    path('posts/<slug:slug>/', api.PostDetailView.as_view(), name='api_post_detail'),
    path('posts/<slug:slug>/comments/', api.CommentListView.as_view(), name='api_post_comments'),
    path('categories/', api.CategoryListView.as_view(), name='api_categories'),
    path('categories/<slug:slug>/', api.CategoryDetailView.as_view(), name='api_category_detail'),
    path('tags/<slug:slug>/', api.TagDetailView.as_view(), name='api_tag_detail'),
    path('auth/csrf/', api.CsrfView.as_view(), name='api_csrf'),
    path('auth/me/', api.MeView.as_view(), name='api_me'),
    path('auth/login/', api.LoginView.as_view(), name='api_login'),
    path('auth/logout/', api.LogoutView.as_view(), name='api_logout'),
    path('auth/register/', api.RegisterView.as_view(), name='api_register'),
]

# Machine-readable discovery files; the frontend proxies these paths to Django.
discovery_urlpatterns = [
    path('sitemap.xml', sitemap, {'sitemaps': discovery.sitemaps}, name='sitemap'),
    path('robots.txt', discovery.robots_txt, name='robots_txt'),
    path('llms.txt', discovery.llms_txt, name='llms_txt'),
]
