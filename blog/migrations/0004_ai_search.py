# Generated for AI-ready search.

import django.db.models.deletion
from django.db import migrations, models
from django.utils.text import slugify


def backfill_published_at(apps, schema_editor):
    BlogPost = apps.get_model("blog", "BlogPost")
    for post in BlogPost.objects.filter(is_published=True, published_at__isnull=True):
        post.published_at = post.created_at
        post.save(update_fields=["published_at"])


def backfill_category_slugs(apps, schema_editor):
    Category = apps.get_model("blog", "Category")
    for category in Category.objects.filter(models.Q(slug__isnull=True) | models.Q(slug="")):
        base = slugify(category.name)[:45] or "category"
        slug, counter = base, 1
        while Category.objects.filter(slug=slug).exclude(pk=category.pk).exists():
            slug, counter = f"{base}-{counter}", counter + 1
        category.slug = slug
        category.save(update_fields=["slug"])


class Migration(migrations.Migration):

    dependencies = [
        ("blog", "0003_alter_blogpost_tags"),
    ]

    operations = [
        migrations.CreateModel(
            name="PostChunk",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("position", models.PositiveIntegerField()),
                ("heading", models.CharField(blank=True, max_length=255)),
                ("text", models.TextField()),
                ("embedding", models.JSONField(blank=True, null=True)),
                ("embedding_model", models.CharField(blank=True, max_length=100)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "post",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE, related_name="chunks", to="blog.blogpost"
                    ),
                ),
            ],
            options={"ordering": ["post", "position"]},
        ),
        migrations.AddConstraint(
            model_name="postchunk",
            constraint=models.UniqueConstraint(fields=("post", "position"), name="unique_chunk_position"),
        ),
        migrations.AlterModelOptions(name="blogpost", options={"ordering": ["-created_at"]}),
        migrations.AlterModelOptions(
            name="category", options={"ordering": ["name"], "verbose_name_plural": "categories"}
        ),
        migrations.AddField(
            model_name="blogpost",
            name="blog",
            field=models.CharField(
                choices=[("hariharan", "Hariharan's Blog"), ("rajan", "Rajan's Blog")],
                db_index=True, default="hariharan", max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="blogpost",
            name="excerpt",
            field=models.TextField(
                blank=True, help_text="Short summary used in listings, search results and AI answers."
            ),
        ),
        migrations.AddField(
            model_name="blogpost",
            name="published_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="blogpost",
            name="search_text",
            field=models.TextField(blank=True, editable=False, help_text="Plain-text version of the post."),
        ),
        migrations.AddField(
            model_name="blogpost",
            name="content_hash",
            field=models.CharField(blank=True, editable=False, max_length=64),
        ),
        migrations.AddField(
            model_name="blogpost",
            name="indexed_at",
            field=models.DateTimeField(blank=True, editable=False, null=True),
        ),
        migrations.AlterField(
            model_name="blogpost",
            name="slug",
            field=models.SlugField(blank=True, unique=True),
        ),
        migrations.AddIndex(
            model_name="blogpost",
            index=models.Index(fields=["is_published", "-created_at"], name="blog_post_published_idx"),
        ),
        migrations.RunPython(backfill_published_at, migrations.RunPython.noop),
        migrations.RunPython(backfill_category_slugs, migrations.RunPython.noop),
    ]
