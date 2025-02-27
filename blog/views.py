from django.shortcuts import render, get_object_or_404, redirect
from django.contrib.auth.decorators import login_required
from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.contrib import messages
from django.contrib.auth.forms import UserCreationForm
from blog.models import BlogPost, Comment
from blog.forms import CommentForm
from .forms import PostForm
from .models import BlogPost, Category

# def home(request):
#     posts = BlogPost.objects.filter(is_published=True).order_by('-created_at')
#     featured_post = posts.first() if posts else None
#     categories = Category.objects.all()
#     return render(request, 'blog/home.html', {
#         'posts': posts,
#         'featured_post': featured_post,
#         'categories': categories
#     })

def home(request):
    query = request.GET.get("q", "")
    posts = BlogPost.objects.filter(title__icontains=query).order_by("-created_at")

    context = {
        "posts": posts,
        "recent_posts": BlogPost.objects.order_by("-created_at")[:5],
        "categories": Category.objects.all(),
    }
    return render(request, "blog/home.html", context)


def category_posts(request, category_slug):
    category = get_object_or_404(Category, slug=category_slug)
    posts = BlogPost.objects.filter(category=category, is_published=True).order_by('-created_at')
    
    return render(request, 'blog/category_posts.html', {'category': category, 'posts': posts})


def post_detail(request, slug):
    post = get_object_or_404(BlogPost, slug=slug, is_published=True)
    
    # Fetch related posts by category
    related_posts = BlogPost.objects.filter(category=post.category, is_published=True).exclude(id=post.id)[:5]
    
    # Fetch comments for the post
    comments = Comment.objects.filter(post=post).order_by('-created_at')

    # Handle comment submission
    if request.method == "POST":
        comment_form = CommentForm(request.POST)
        if comment_form.is_valid():
            comment = comment_form.save(commit=False)
            comment.post = post
            comment.author = request.user
            comment.save()
    else:
        comment_form = CommentForm()

    return render(request, 'blog/post_detail.html', {
        'post': post,
        'related_posts': related_posts,
        'comments': comments,
        'comment_form': comment_form,
    })

def category_posts(request, category_name):
    # Ensure the category exists
    category = get_object_or_404(Category, slug=category_name)
    
    # Fetch all posts in this category
    posts = BlogPost.objects.filter(category=category, is_published=True)

    return render(request, 'blog/category_posts.html', {
        'category': category,
        'posts': posts,
    })

def search_results(request):
    query = request.GET.get('q')  # Get search query
    results = BlogPost.objects.filter(title__icontains=query) | BlogPost.objects.filter(content__icontains=query)  # Search in title & content
    return render(request, 'blog/search_results.html', {'results': results, 'query': query})


@login_required(login_url='/login/')
def add_post(request):
    if not request.user.is_superuser:  # Only superusers can add posts
        messages.error(request, "You are not authorized to add posts.")
        return redirect('home')

    if request.method == "POST":
        form = PostForm(request.POST, request.FILES)
        if form.is_valid():
            post = form.save(commit=False)
            post.author = request.user
            
            # Ensure the checkbox value is handled correctly
            post.is_published = request.POST.get("is_published") == "on"
            
            post.save()
            messages.success(request, "Post added successfully!")
            return redirect('home')  # Redirect after successful post
        else:
            print(form.errors)
            messages.error(request, "Error in form submission. Please check your input.")
    else:
        form = PostForm()

    return render(request, 'blog/add_post.html', {'form': form})

# def register(request):
#     if request.method == 'POST':
#         form = UserCreationForm(request.POST)
#         if form.is_valid():
#             form.save()
#             return redirect('login')
#     else:
#         form = UserCreationForm()
#     return render(request, 'blog/register.html', {'form': form})

# Login View
def login_view(request):
    if request.user.is_authenticated:
        return redirect('home')

    if request.method == "POST":
        username = request.POST['username']
        password = request.POST['password']
        user = authenticate(request, username=username, password=password)

        if user is not None:
            login(request, user)
            return redirect('home')
        else:
            messages.error(request, "Invalid username or password")

    return render(request, 'blog/login.html')

def about_view(request):
    return render(request, 'blog/aboutme.html')

# Register View
def register_view(request):
    if request.user.is_authenticated:
        return redirect('home')

    if request.method == "POST":
        username = request.POST['username']
        email = request.POST['email']
        password1 = request.POST['password1']
        password2 = request.POST['password2']

        if password1 != password2:
            messages.error(request, "Passwords do not match")
        elif User.objects.filter(username=username).exists():
            messages.error(request, "Username already exists")
        elif User.objects.filter(email=email).exists():
            messages.error(request, "Email already registered")
        else:
            user = User.objects.create_user(username=username, email=email, password=password1)
            user.save()
            messages.success(request, "Account created! You can now log in.")
            return redirect('login')

    return render(request, 'blog/register.html')

# Logout View
def logout_view(request):
    logout(request)
    return redirect('login')