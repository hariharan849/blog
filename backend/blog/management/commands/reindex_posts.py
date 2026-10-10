from django.core.management.base import BaseCommand

from blog.models import BlogPost
from blog.search.indexing import index_post


class Command(BaseCommand):
    help = "Rebuild the plain-text search index and embeddings for blog posts."

    def add_arguments(self, parser):
        parser.add_argument("slugs", nargs="*", help="Only re-index these posts.")
        parser.add_argument("--force", action="store_true", help="Re-index even if a post is unchanged.")

    def handle(self, *args, slugs, force, **options):
        posts = BlogPost.objects.all()
        if slugs:
            posts = posts.filter(slug__in=slugs)
        indexed = skipped = 0
        for post in posts.iterator():
            if index_post(post, force=force):
                indexed += 1
                self.stdout.write(f"indexed  {post.slug} ({post.chunks.count()} chunks)")
            else:
                skipped += 1
        self.stdout.write(self.style.SUCCESS(f"Done: {indexed} indexed, {skipped} unchanged."))
