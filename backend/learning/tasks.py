"""Celery tasks for the Daily Bytes / knowledge-base pipeline.

poll_feeds ─► fetch_source (one per feed) ─► process_article (one per new/edited article)
build_daily_digest runs on its own schedule.

Tasks are idempotent and acknowledged late: if a worker dies mid-task, the message is redelivered
and the re-run skips steps that already completed (see pipeline/steps.py).
"""
import logging
from urllib.error import URLError

from celery import shared_task

from blog.search.embeddings import EmbeddingError

from .llm import TransientLLMError, get_client
from .models import Article, Source
from .pipeline.digest import build_digest, email_digest
from .pipeline.feeds import fetch_source as fetch_feed
from .pipeline.steps import pending_articles, run_article_steps

logger = logging.getLogger(__name__)

# Worth retrying later: network trouble, rate limits, provider outages.
TRANSIENT_ERRORS = (TransientLLMError, EmbeddingError, URLError, ConnectionError, TimeoutError)
RETRY = {
    "autoretry_for": TRANSIENT_ERRORS,
    "retry_backoff": 30,
    "retry_backoff_max": 30 * 60,
    "retry_jitter": True,
    "max_retries": 5,
}


@shared_task(name="learning.poll_feeds")
def poll_feeds():
    """Fan out one fetch per active feed. Returns the number of feeds queued."""
    source_ids = list(Source.objects.filter(is_active=True).values_list("pk", flat=True))
    for source_id in source_ids:
        fetch_source.delay(source_id)
    return len(source_ids)


@shared_task(name="learning.fetch_source", rate_limit="20/m", **RETRY)
def fetch_source(source_id):
    """Fetch one feed (ETag-aware) and queue processing for its new or edited articles."""
    source = Source.objects.filter(pk=source_id, is_active=True).first()
    if source is None:
        return {"changed": 0, "queued": 0}
    changed = fetch_feed(source)
    queued = [article.pk for article in pending_articles(source=source)]
    for article_id in queued:
        process_article.delay(article_id)
    return {"changed": changed, "queued": len(queued)}


@shared_task(name="learning.process_article", **RETRY)
def process_article(article_id):
    """Index and enrich one article; completed steps are skipped on retries and re-runs."""
    article = Article.objects.select_related("source").filter(pk=article_id).first()
    if article is None:
        return None
    return run_article_steps(article, get_client(), raise_transient=True)


@shared_task(name="learning.build_daily_digest")
def build_daily_digest(email=True):
    digest = build_digest(client=get_client())
    emailed = email_digest(digest) if email else False
    return {"date": digest.date.isoformat(), "articles": digest.items.count(), "emailed": emailed}
