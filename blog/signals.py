from django.conf import settings
from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import BlogPost
from .search.indexing import safe_index_post


@receiver(post_save, sender=BlogPost, dispatch_uid="blog_index_post_on_save")
def index_post_on_save(sender, instance, raw=False, **kwargs):
    if raw or not settings.AI_SEARCH["AUTO_INDEX"]:
        return  # Skip fixture loading, or leave indexing to a worker / `manage.py reindex_posts`.
    transaction.on_commit(lambda: safe_index_post(instance))
