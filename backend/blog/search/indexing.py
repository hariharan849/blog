import hashlib
import logging

from django.conf import settings
from django.utils import timezone

from .embeddings import get_embedder, normalize
from .text import Chunk, chunk_html, html_to_text
from .vector_store import get_vector_store

logger = logging.getLogger(__name__)


def compute_hash(post, model_name):
    # Only what goes into the chunks/embeddings; tags and category are read live at query time.
    config = settings.AI_SEARCH
    source = "\x1f".join([
        post.title, post.excerpt, post.content, model_name,
        str(config["CHUNK_WORDS"]), str(config["CHUNK_OVERLAP_WORDS"]),
    ])
    return hashlib.sha256(source.encode()).hexdigest()


def index_post(post, force=False):
    """Refresh a post's plain text, chunks and embeddings. Returns True if it was re-indexed.

    Unchanged posts are skipped (by content hash) so repeated saves don't re-pay for embeddings.
    """
    from blog.models import BlogPost

    config = settings.AI_SEARCH
    embedder = get_embedder()
    content_hash = compute_hash(post, embedder.model_name)
    if not force and post.content_hash == content_hash and post.indexed_at:
        return False

    search_text = html_to_text(post.content)
    chunks = chunk_html(
        post.content, title=post.title,
        chunk_words=config["CHUNK_WORDS"], overlap_words=config["CHUNK_OVERLAP_WORDS"],
    )
    if post.excerpt:
        # The author's own summary is usually the best single passage for answering questions.
        chunks = [Chunk(0, "Summary", f"{post.title}\n{post.excerpt}")] + [
            Chunk(chunk.position + 1, chunk.heading, chunk.text) for chunk in chunks
        ]

    vectors = [normalize(vector) for vector in embedder.embed([chunk.text for chunk in chunks], "document")]
    get_vector_store().save(post, chunks, vectors, embedder.model_name)

    now = timezone.now()
    # update() rather than save() so indexing never re-triggers the post_save signal.
    BlogPost.objects.filter(pk=post.pk).update(search_text=search_text, content_hash=content_hash, indexed_at=now)
    post.search_text, post.content_hash, post.indexed_at = search_text, content_hash, now
    return True


def safe_index_post(post, force=False):
    """Index a post, but never let an embedding provider outage break saving a post."""
    try:
        return index_post(post, force=force)
    except Exception:
        logger.exception("Failed to index post %s; run `manage.py reindex_posts` to retry.", post.pk)
        return False
