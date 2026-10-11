from django.db import models
from django.contrib.auth.models import User
import nh3
from django.utils import timezone
from ckeditor.fields import RichTextField
from django.utils.text import slugify
from taggit.managers import TaggableManager


def unique_slug(instance, value, max_length=50):
    """Slugify ``value`` and append a counter until it is unique for the instance's model."""
    base = slugify(value)[:max_length] or "item"
    slug = base
    counter = 1
    queryset = type(instance)._default_manager.exclude(pk=instance.pk)
    while queryset.filter(slug=slug).exists():
        suffix = f"-{counter}"
        slug = f"{base[:max_length - len(suffix)]}{suffix}"
        counter += 1
    return slug


class Category(models.Model):
    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(unique=True, blank=True, null=True)

    class Meta:
        verbose_name_plural = "categories"
        ordering = ["name"]

    def save(self, *args, **kwargs):
        if not self.slug:  # Only generate slug if it doesn’t exist
            self.slug = unique_slug(self, self.name)
        super().save(*args, **kwargs)

    def get_absolute_url(self):
        return f"/category/{self.slug}/"  # page served by the Next.js frontend

    def __str__(self):
        return self.name


class BlogPostQuerySet(models.QuerySet):
    def published(self):
        return self.filter(is_published=True)

    def for_blog(self, blog):
        return self.filter(blog=blog) if blog else self


class BlogPost(models.Model):
    class Blog(models.TextChoices):
        HARIHARAN = "hariharan", "Hariharan's Blog"
        RAJAN = "rajan", "Rajan's Blog"

    title = models.CharField(max_length=200)
    slug = models.SlugField(unique=True, blank=True)
    # Which personal blog the post belongs to (replaces the old free-text ``Post.author``).
    blog = models.CharField(max_length=20, choices=Blog.choices, default=Blog.HARIHARAN, db_index=True)
    excerpt = models.TextField(blank=True, help_text="Short summary used in listings, search results and AI answers.")
    content = RichTextField()  # Rich Text Editor
    image = models.ImageField(upload_to='blog_images/', blank=True, null=True)
    author = models.ForeignKey(User, on_delete=models.CASCADE)
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, blank=True)
    tags = TaggableManager(blank=True)  # Add Tags
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    published_at = models.DateTimeField(null=True, blank=True)
    is_published = models.BooleanField(default=False)

    # Search index bookkeeping, maintained by blog.search.indexing.
    search_text = models.TextField(blank=True, editable=False, help_text="Plain-text version of the post.")
    content_hash = models.CharField(max_length=64, blank=True, editable=False)
    indexed_at = models.DateTimeField(null=True, blank=True, editable=False)

    objects = BlogPostQuerySet.as_manager()

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["is_published", "-created_at"], name="blog_post_published_idx"),
        ]

    def save(self, *args, **kwargs):
        if not self.slug:  # Auto-generate slug from title
            self.slug = unique_slug(self, self.title)
        if self.is_published and not self.published_at:
            self.published_at = timezone.now()
        # Strip scripts, event handlers and other unsafe markup so the frontend can render it as HTML.
        self.content = nh3.clean(self.content or "")
        super().save(*args, **kwargs)

    def get_absolute_url(self):
        return f"/post/{self.slug}/"  # page served by the Next.js frontend

    @property
    def summary(self):
        if self.excerpt:
            return self.excerpt
        # Use the first real paragraph (skips headings and short code lines), not the whole text.
        paragraphs = [line for line in self.search_text.splitlines() if len(line.split()) >= 8]
        words = (paragraphs[0] if paragraphs else self.search_text).split()
        return " ".join(words[:50]) + ("…" if len(words) > 50 else "")

    def __str__(self):
        return self.title


class PostChunk(models.Model):
    """A passage of a post plus its embedding: the unit of semantic search and RAG retrieval."""

    post = models.ForeignKey(BlogPost, on_delete=models.CASCADE, related_name="chunks")
    position = models.PositiveIntegerField()
    heading = models.CharField(max_length=255, blank=True)
    text = models.TextField()
    # Stored as a JSON list so it works on any database; swap VECTOR_STORE for pgvector/Qdrant/etc.
    embedding = models.JSONField(null=True, blank=True)
    embedding_model = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["post", "position"]
        constraints = [
            models.UniqueConstraint(fields=["post", "position"], name="unique_chunk_position"),
        ]

    def __str__(self):
        return f"{self.post.title} [{self.position}]"


class Comment(models.Model):
    post = models.ForeignKey(BlogPost, on_delete=models.CASCADE, related_name="comments")
    name = models.CharField(max_length=100)
    email = models.EmailField()
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Comment by {self.name} on {self.post.title}"
