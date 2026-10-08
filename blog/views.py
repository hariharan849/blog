import json
import logging

from django.conf import settings
from django.shortcuts import render, get_object_or_404, redirect
from django.contrib.auth.decorators import login_required
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.contrib import messages
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.urls import reverse
from django.utils.http import url_has_allowed_host_and_scheme
from django.utils.safestring import mark_safe
from taggit.models import Tag

from .forms import CommentForm, PostForm
from .models import BlogPost, Category
from .search import search
from .search.service import semantic_search

logger = logging.getLogger(__name__)

def _selected_blog(request):
    blog = request.GET.get("blog") or request.GET.get("author")
    return blog if blog in BlogPost.Blog.values else BlogPost.Blog.HARIHARAN


def home(request):
    selected_blog = _selected_blog(request)
    posts = (
        BlogPost.objects.published().for_blog(selected_blog)
        .select_related("author", "category").prefetch_related("tags")
    )
    context = {
        'posts': posts,
        'selected_blog': selected_blog,
        'blogs': BlogPost.Blog.choices,
        'recent_posts': BlogPost.objects.published().for_blog(selected_blog)[:5],
        'categories': Category.objects.filter(blogpost__is_published=True).distinct(),
    }
    return render(request, 'blog/home.html', context)


def category_posts(request, category_slug):
    category = get_object_or_404(Category, slug=category_slug)
    posts = BlogPost.objects.published().filter(category=category).select_related("author")

    return render(request, 'blog/category_posts.html', {'category': category, 'heading': category.name, 'posts': posts})


def tagged_posts(request, tag_slug):
    tag = get_object_or_404(Tag, slug=tag_slug)
    posts = BlogPost.objects.published().filter(tags__slug=tag_slug).select_related("author").distinct()
    return render(request, 'blog/category_posts.html', {'heading': f"#{tag.name}", 'posts': posts})


def post_detail(request, slug):
    post = get_object_or_404(BlogPost.objects.published().select_related("author", "category"), slug=slug)
    related_posts = related_posts_for(post)
    comments = post.comments.order_by('-created_at')

    if request.method == "POST":
        if not request.user.is_authenticated:
            return redirect(f"{reverse('login')}?next={post.get_absolute_url()}")
        comment_form = CommentForm(request.POST)
        if comment_form.is_valid():
            comment = comment_form.save(commit=False)
            comment.post = post
            comment.save()
            messages.success(request, "Thanks for your comment!")
            return redirect(post.get_absolute_url())
    else:
        initial = {}
        if request.user.is_authenticated:
            initial = {'name': request.user.get_full_name() or request.user.username, 'email': request.user.email}
        comment_form = CommentForm(initial=initial)

    return render(request, 'blog/post_detail.html', {
        'post': post,
        'structured_data': article_json_ld(request, post),
        'related_posts': related_posts,
        'comments': comments,
        'comment_form': comment_form,
    })


def article_json_ld(request, post):
    """schema.org Article markup so search engines and AI crawlers can understand the post."""
    data = {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        "headline": post.title,
        "description": post.summary,
        "url": request.build_absolute_uri(post.get_absolute_url()),
        "datePublished": (post.published_at or post.created_at).isoformat(),
        "dateModified": post.updated_at.isoformat(),
        "author": {"@type": "Person", "name": post.author.get_full_name() or post.author.username},
        "keywords": ", ".join(post.tags.names()),
    }
    if post.category:
        data["articleSection"] = post.category.name
    if post.image:
        data["image"] = request.build_absolute_uri(post.image.url)
    # Escape like Django's json_script so the JSON can't close the <script> tag.
    encoded = json.dumps(data).replace("<", "\\u003C").replace(">", "\\u003E").replace("&", "\\u0026")
    return mark_safe(encoded)


def related_posts_for(post, limit=5):
    """Posts most similar in meaning (via embeddings), falling back to the same category."""
    queryset = BlogPost.objects.published().exclude(pk=post.pk)
    if post.search_text:
        try:
            hits = semantic_search(f"{post.title}\n{post.summary}", queryset, limit)
            if hits:
                return [hit_post for hit_post, _score, _passages in hits]
        except Exception:
            logger.exception("Related-post lookup failed for %s", post.pk)
    if post.category_id:
        return list(queryset.filter(category=post.category_id)[:limit])
    return []


def search_results(request):
    query = request.GET.get('q', '').strip()
    mode = request.GET.get('mode') or settings.AI_SEARCH["DEFAULT_MODE"]
    results = search(query, mode=mode, limit=20) if query else []
    return render(request, 'blog/search_results.html', {'results': results, 'query': query, 'mode': mode})

@login_required(login_url='/login/')
def add_post(request):
    if not request.user.is_superuser:
        messages.error(request, "You are not authorized to add posts.")
        return redirect('home')

    if request.method == "POST":
        form = PostForm(request.POST, request.FILES)
        if form.is_valid():
            post = form.save(commit=False)
            post.author = request.user
            post.save()
            form.save_m2m()  # Tags are many-to-many and need the saved post.
            messages.success(request, "Post added successfully!")
            return redirect(post.get_absolute_url() if post.is_published else 'home')
        else:
            messages.error(request, "Error in form submission. Please check your input.")
    else:
        form = PostForm()

    return render(request, 'blog/add_post.html', {'form': form})

def login_view(request):
    if request.user.is_authenticated:
        return redirect('home')

    if request.method == "POST":
        username = request.POST.get('username', '')
        password = request.POST.get('password', '')
        user = authenticate(request, username=username, password=password)

        if user is not None:
            login(request, user)
            next_url = request.POST.get('next') or request.GET.get('next')
            if next_url and url_has_allowed_host_and_scheme(next_url, {request.get_host()}, request.is_secure()):
                return redirect(next_url)
            return redirect('home')
        else:
            messages.error(request, "Invalid username or password")

    return render(request, 'blog/login.html')

def about_hariharan(request):
    # Render the "About me" page for Hariharan.
    return render(request, 'blog/about_hariharan.html')

def about_rajan(request):
    # Render the "About me" page for Raja.
    return render(request, 'blog/about_rajan.html')

def register_view(request):
    if request.user.is_authenticated:
        return redirect('home')

    if request.method == "POST":
        username = request.POST.get('username', '').strip()
        email = request.POST.get('email', '').strip()
        password1 = request.POST.get('password1', '')
        password2 = request.POST.get('password2', '')

        if not username or not password1:
            messages.error(request, "Username and password are required")
        elif password1 != password2:
            messages.error(request, "Passwords do not match")
        elif User.objects.filter(username=username).exists():
            messages.error(request, "Username already exists")
        elif User.objects.filter(email=email).exists():
            messages.error(request, "Email already registered")
        else:
            try:
                validate_password(password1, User(username=username, email=email))
            except ValidationError as error:
                for message in error.messages:
                    messages.error(request, message)
                return render(request, 'blog/register.html')
            User.objects.create_user(username=username, email=email, password=password1)
            messages.success(request, "Account created! You can now log in.")
            return redirect('login')

    return render(request, 'blog/register.html')

def logout_view(request):
    logout(request)
    return redirect('home')
