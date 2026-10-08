from django.contrib.sitemaps.views import sitemap
from django.urls import path

from . import api, discovery
from .views import (
    home, post_detail, category_posts, tagged_posts, add_post, register_view, login_view, logout_view,
    search_results, about_hariharan, about_rajan
)

urlpatterns = [
    path('', home, name='home'),
    path('login/', login_view, name='login'),
    path('about/hariharan/', about_hariharan, name='about_hariharan'),
    path('about/rajan/', about_rajan, name='about_rajan'),
    path('register/', register_view, name='register'),
    path('logout/', logout_view, name='logout'),
    path('post/<slug:slug>/', post_detail, name='post_detail'),
    path('category/<slug:category_slug>/', category_posts, name='category_posts'),
    path('tag/<slug:tag_slug>/', tagged_posts, name='tagged_posts'),
    path('add/', add_post, name='add_post'),
    path('search/', search_results, name='search_results'),

    # Machine-readable endpoints for search engines, AI agents and RAG pipelines.
    path('api/v1/search/', api.search_api, name='api_search'),
    path('api/v1/posts/', api.post_list_api, name='api_posts'),
    path('api/v1/posts/<slug:slug>/', api.post_detail_api, name='api_post_detail'),
    path('sitemap.xml', sitemap, {'sitemaps': discovery.sitemaps}, name='sitemap'),
    path('robots.txt', discovery.robots_txt, name='robots_txt'),
    path('llms.txt', discovery.llms_txt, name='llms_txt'),
]
