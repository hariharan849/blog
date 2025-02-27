from django.urls import path
from .views import (
    home, post_detail, category_posts, add_post, register_view, login_view, logout_view, search_results,
    about_view
)

urlpatterns = [
    path('', home, name='home'),
    path('login/', login_view, name='login'),
    path('about/', about_view, name='about'),
    path('register/', register_view, name='register'),
    path('logout/', logout_view, name='logout'),
    path('post/<slug:slug>/', post_detail, name='post_detail'),
    path('category/<str:category_name>/', category_posts, name='category_posts'),
    path('add/', add_post, name='add_post'),
    path('search/', search_results, name='search_results'),
    path('category/<slug:category_slug>/', category_posts, name='category_posts'),
]