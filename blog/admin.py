from django.contrib import admin
from .models import BlogPost, Category, Comment

@admin.register(BlogPost)
class BlogPostAdmin(admin.ModelAdmin):
    list_display = ('title', 'author', 'category', 'created_at', 'is_published')
    prepopulated_fields = {'slug': ('title',)}

admin.site.register(Category)
admin.site.register(Comment)