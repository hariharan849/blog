"""Record pipeline steps that failed for good, as a dataset for debugging and evaluation."""
import logging
import traceback as tb

from celery.signals import task_failure

logger = logging.getLogger(__name__)


def record_failure(task_name, error, *, article=None, source=None, payload=None, attempts=1, task_id="", trace=""):
    from .models import PipelineFailure

    try:
        return PipelineFailure.objects.create(
            task_name=task_name, task_id=task_id or "", article=article, source=source, payload=payload or {},
            error_type=type(error).__name__ if isinstance(error, BaseException) else "",
            error=str(error)[:5000], traceback=trace or "", attempts=attempts,
        )
    except Exception:  # never let failure bookkeeping hide the original error
        logger.exception("Could not record pipeline failure for %s", task_name)
        return None


@task_failure.connect
def on_task_failure(sender=None, task_id=None, exception=None, args=None, kwargs=None, einfo=None, **_):
    """Celery fires this once retries are exhausted (or for errors that aren't retried)."""
    if not getattr(sender, "name", "").startswith("learning."):
        return
    from .models import Article, Source

    args, kwargs = list(args or []), dict(kwargs or {})
    target_id = kwargs.get("article_id", kwargs.get("source_id", args[0] if args else None))
    article = Article.objects.filter(pk=target_id).first() if sender.name == "learning.process_article" else None
    source = Source.objects.filter(pk=target_id).first() if sender.name == "learning.fetch_source" else None
    record_failure(
        sender.name, exception, article=article, source=source, payload={"args": args, "kwargs": kwargs},
        attempts=(getattr(sender.request, "retries", 0) or 0) + 1, task_id=task_id,
        trace=str(einfo) if einfo else "".join(tb.format_exception(exception)) if exception else "",
    )
