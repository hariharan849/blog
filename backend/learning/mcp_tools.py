"""Knowledge-base operations exposed to AI tools over MCP (see ``manage.py kb_mcp``).

Reads answer immediately; writes queue Celery tasks and return the task id (when no Redis is
configured the tasks run inline and their result is returned instead).
"""
from django.db import close_old_connections, connection

from .kb.ask import ask
from .kb.search import kb_search
from .llm import get_client
from .pipeline.feeds import add_source
from .tasks import fetch_source, poll_feeds


def _fresh_connection():
    """Tools run in reused worker threads: drop stale DB connections, but never mid-transaction."""
    if not connection.in_atomic_block:
        close_old_connections()


def _task_info(result):
    info = {"task_id": result.id, "state": result.state}
    if result.ready():
        info["result"] = result.result if result.successful() else str(result.result)
    return info


def search(query: str, scope: str = "all", limit: int = 8) -> list[dict]:
    _fresh_connection()
    return [hit.as_dict() for hit in kb_search(query, scope=scope, limit=limit)]


def answer(question: str, scope: str = "all") -> dict:
    _fresh_connection()
    return ask(question, scope=scope, client=get_client())


def add_feed(url: str) -> dict:
    _fresh_connection()
    source, created = add_source(url)
    return {
        "source": {"id": source.pk, "name": source.name, "feed_url": source.feed_url},
        "created": created,
        "fetch": _task_info(fetch_source.delay(source.pk)),
    }


def sync() -> dict:
    _fresh_connection()
    return _task_info(poll_feeds.delay())
