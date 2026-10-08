from django.contrib import admin, messages

from .models import BlogPost, Category, Comment
from .search.indexing import safe_index_post


@admin.register(BlogPost)
class BlogPostAdmin(admin.ModelAdmin):
    list_display = ('title', 'blog', 'author', 'category', 'created_at', 'is_published', 'indexed_at')
    list_filter = ('blog', 'is_published', 'category')
    search_fields = ('title', 'excerpt', 'search_text')
    prepopulated_fields = {'slug': ('title',)}
    readonly_fields = ('published_at', 'indexed_at')
    actions = ['reindex']

    @admin.action(description="Re-index selected posts for search")
    def reindex(self, request, queryset):
        count = sum(safe_index_post(post, force=True) for post in queryset)
        self.message_user(request, f"Re-indexed {count} post(s).", messages.SUCCESS)


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug')
    prepopulated_fields = {'slug': ('name',)}


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ('name', 'post', 'created_at')
    search_fields = ('name', 'email', 'content')
