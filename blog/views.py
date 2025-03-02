from django.shortcuts import render, get_object_or_404, redirect
from django.contrib.auth.decorators import login_required
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.contrib import messages
from django.contrib.auth.forms import UserCreationForm
from blog.models import BlogPost, Comment
from blog.forms import CommentForm
from .forms import PostForm
from .models import BlogPost, Category, Post

def home(request):
    # Get the selected author from the query string.
    # Default to "Hariharan's Blog" if none is provided.
    selected_author = request.GET.get('author', "Hariharan's Blog")
    posts = Post.objects.all()
    if selected_author:
        posts = posts.filter(author=selected_author)
    context = {
        'posts': posts,
        'selected_author': selected_author,
        'recent_posts': Post.objects.order_by('-created_at')[:5],
        # add other context items as needed...
    }
    return render(request, 'blog/home.html', context)


def category_posts(request, category_slug):
    category = get_object_or_404(Category, slug=category_slug)
    posts = BlogPost.objects.filter(category=category, is_published=True).order_by('-created_at')
    
    return render(request, 'blog/category_posts.html', {'category': category, 'posts': posts})

def post_detail(request, slug):
    post = get_object_or_404(BlogPost, slug=slug, is_published=True)
    related_posts = BlogPost.objects.filter(category=post.category, is_published=True).exclude(id=post.id)[:5]
    comments = Comment.objects.filter(post=post).order_by('-created_at')

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

def search_results(request):
    query = request.GET.get('q')
    results = BlogPost.objects.filter(title__icontains=query) | BlogPost.objects.filter(content__icontains=query)
    return render(request, 'blog/search_results.html', {'results': results, 'query': query})

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
            post.is_published = request.POST.get("is_published") == "on"
            post.save()
            messages.success(request, "Post added successfully!")
            return redirect('home')
        else:
            messages.error(request, "Error in form submission. Please check your input.")
    else:
        form = PostForm()

    return render(request, 'blog/add_post.html', {'form': form})

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

def logout_view(request):
    logout(request)
    return redirect('login')
