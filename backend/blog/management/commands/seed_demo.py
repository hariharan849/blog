import os
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.models import User
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from blog.models import BlogPost, Category, Comment


class Command(BaseCommand):
    help = "Create demo users, posts and Daily Bytes data for local development and end-to-end tests."

    def add_arguments(self, parser):
        parser.add_argument("--password", default=os.environ.get("SEED_PASSWORD", ""),
                            help="Password for the demo 'admin' (superuser) and 'reader' accounts.")
        parser.add_argument("--force", action="store_true", help="Allow running when DEBUG is off.")

    def handle(self, *args, password, force, **options):
        if not settings.DEBUG and not force:
            raise CommandError("Refusing to seed demo data with DEBUG off (pass --force if you really mean it).")
        if not password:
            raise CommandError("Pass --password (or set SEED_PASSWORD) for the demo accounts.")

        admin, _ = User.objects.get_or_create(username="admin", defaults={"email": "admin@example.com"})
        admin.is_staff = admin.is_superuser = True
        admin.set_password(password)
        admin.save()
        reader, _ = User.objects.get_or_create(username="reader", defaults={"email": "reader@example.com"})
        reader.set_password(password)
        reader.save()

        dl, _ = Category.objects.get_or_create(name="Deep Learning")
        ml, _ = Category.objects.get_or_create(name="Machine Learning")
        posts = [
            ("Understanding Transformers", "hariharan", dl, ["transformers", "attention"],
             "<h2>Attention</h2><p>Self-attention lets every token look at every other token.</p>"
             "<h2>Why it scales</h2><p>Transformers parallelise across the sequence, unlike RNNs.</p>"),
            ("Retrieval Augmented Generation in Practice", "hariharan", ml, ["rag", "llm"],
             "<p>RAG grounds language model answers in your own documents using embeddings and search.</p>"),
            ("Feature Engineering for Tabular Data", "rajan", ml, ["features"],
             "<p>Good features still beat bigger models on tabular data. Start with target encoding.</p>"),
        ]
        for index, (title, blog, category, tags, content) in enumerate(posts):
            post, created = BlogPost.objects.get_or_create(
                title=title,
                defaults={"blog": blog, "category": category, "content": content, "author": admin, "is_published": True},
            )
            if created:
                BlogPost.objects.filter(pk=post.pk).update(published_at=timezone.now() - timedelta(days=index))
                post.tags.set(tags)
        first = BlogPost.objects.get(title=posts[0][0])
        Comment.objects.get_or_create(post=first, name="reader", defaults={"email": "reader@example.com",
                                                                            "content": "Great explanation!"})

        from learning.models import Interest

        for name, weight in (("LLM agents", 5), ("RAG", 4)):
            Interest.objects.get_or_create(name=name, defaults={"weight": weight})
        self.stdout.write(self.style.SUCCESS("Seeded demo data: users 'admin' (superuser) and 'reader'."))
