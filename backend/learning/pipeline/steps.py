"""Per-article pipeline: index (chunk + embed) then enrich. Every step is idempotent.

Each step records the content hash it completed for (``indexed_hash`` / ``enriched_hash``), so
re-running an article (a retry, a resumed run, a duplicate message) skips work already done and
never pays twice for embeddings or Claude calls.
"""
import logging

import anthropic
from django.conf import settings
from django.db.models import Q

from ..failures import record_failure
from ..kb.indexing import index_article
from ..models import Article
from .enrich import enrich_article

logger = logging.getLogger(__name__)


def needs_enrichment(article):
    return article.status == Article.Status.NEW or article.enriched_hash != article.content_hash


def run_article_steps(article, client=None, *, raise_transient=False):
    """Index then enrich one article; returns ``{"indexed": bool, "status": str | None}``."""
    indexed = index_article(article)
    status = None
    if needs_enrichment(article):
        status = enrich_article(article, client, raise_transient=raise_transient)
        if status == Article.Status.FAILED:
            record_failure("learning.enrich", article.error, article=article, payload={"article_id": article.pk})
    return {"indexed": indexed, "status": status}


def pending_articles(source=None, limit=None):
    """Articles with work left (new, edited, or never indexed), newest first."""
    articles = Article.objects.filter(Q(status=Article.Status.NEW) | Q(indexed_hash="")).select_related("source")
    if source is not None:
        articles = articles.filter(source=source)
    return articles.order_by("-published_at")[: limit or settings.DAILY_BYTES["MAX_ENRICH_PER_RUN"]]


def process_pending(limit=None, client=None):
    """Run the steps for pending articles in-process (used by ``run_daily_bytes``).

    One failing article never stops the rest; it is recorded as a PipelineFailure.
    Returns ``{"indexed": n, "statuses": {status: n}, "failed": n}``.
    """
    summary = {"indexed": 0, "statuses": {}, "failed": 0}
    for article in pending_articles(limit=limit):
        try:
            result = run_article_steps(article, client)
        except anthropic.AuthenticationError:
            raise  # misconfiguration: every article would fail
        except Exception as exc:
            logger.exception("Processing article %s failed", article.pk)
            record_failure("learning.process_article", exc, article=article, payload={"article_id": article.pk})
            summary["failed"] += 1
            continue
        summary["indexed"] += result["indexed"]
        if result["status"]:
            summary["statuses"][result["status"]] = summary["statuses"].get(result["status"], 0) + 1
    return summary
