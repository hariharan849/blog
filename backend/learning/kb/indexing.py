import hashlib
import logging

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from blog.search.embeddings import get_embedder, normalize
from blog.search.text import chunk_html

from ..models import Article, ArticlePassage

logger = logging.getLogger(__name__)


def index_hash(article, model_name):
    config = settings.AI_SEARCH
    source = "\x1f".join([
        article.content_hash or hashlib.sha256(article.content_html.encode()).hexdigest(),
        article.title, model_name, str(config["CHUNK_WORDS"]), str(config["CHUNK_OVERLAP_WORDS"]),
    ])
    return hashlib.sha256(source.encode()).hexdigest()


def index_article(article, force=False):
    """Chunk and embed an article's full text. Returns True if new passages were written.

    Skips articles already indexed for the same content + model. When the content changed, the
    previous passages are superseded (``valid_to`` set) rather than deleted, so citations that
    pointed at them still resolve.
    """
    config = settings.AI_SEARCH
    embedder = get_embedder()
    digest = index_hash(article, embedder.model_name)
    if not force and article.indexed_hash == digest:
        return False

    chunks = chunk_html(
        article.content_html, title=article.title,
        chunk_words=config["CHUNK_WORDS"], overlap_words=config["CHUNK_OVERLAP_WORDS"],
    )
    # Embed before opening the transaction: the API call can be slow or fail and be retried.
    vectors = [normalize(vector) for vector in embedder.embed([chunk.text for chunk in chunks], "document")] if chunks else []

    now = timezone.now()
    with transaction.atomic():
        article.passages.filter(valid_to__isnull=True).update(valid_to=now)
        ArticlePassage.objects.bulk_create([
            ArticlePassage(
                article=article, position=chunk.position, heading=chunk.heading[:255], text=chunk.text,
                embedding=vector, embedding_model=embedder.model_name, content_hash=digest, valid_from=now,
            )
            for chunk, vector in zip(chunks, vectors)
        ])
        Article.objects.filter(pk=article.pk).update(indexed_hash=digest)
    article.indexed_hash = digest
    return True
