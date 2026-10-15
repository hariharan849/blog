"""Hybrid (keyword + semantic, merged with RRF) search over passages of blog posts and newsletters.

Passages, not whole documents, are the unit here: they are what an answer cites.
"""
import logging
from dataclasses import asdict, dataclass, field

from django.db import connection
from django.db.models import Q

from blog.models import PostChunk
from blog.search.embeddings import get_embedder, normalize
from blog.search.fusion import rrf_merge
from blog.search.text import snippet, tokenize
from blog.search.vector_store import cosine

from ..models import ArticlePassage

logger = logging.getLogger(__name__)

SCOPES = ("posts", "newsletters", "all")
MODES = ("keyword", "semantic", "hybrid")
CANDIDATE_POOL = 500  # rows scored in Python by the portable keyword fallback


@dataclass
class Hit:
    id: str  # "post:<chunk id>" or "newsletter:<passage id>"
    kind: str  # "post" | "newsletter"
    title: str
    url: str  # site path for posts, original URL for newsletter articles
    heading: str
    text: str
    snippet: str
    source: str
    published_at: str | None
    score: float = 0.0
    matched_by: list = field(default_factory=list)

    def as_dict(self):
        return asdict(self)


def strip_context(text):
    """Chunks start with a "Title > Heading" context line (helps retrieval); drop it for display."""
    return text.split("\n", 1)[-1]


def _querysets(scope):
    sets = {}
    if scope in ("posts", "all"):
        sets["post"] = PostChunk.objects.filter(post__is_published=True).select_related("post", "post__author")
    if scope in ("newsletters", "all"):
        sets["newsletter"] = ArticlePassage.objects.filter(valid_to__isnull=True).select_related("article__source")
    return sets


def keyword_rank(queryset, query, limit):
    """Return ``[(row, score)]`` best first, matching on the passage text."""
    if connection.vendor == "postgresql":
        from django.contrib.postgres.search import SearchQuery, SearchRank, SearchVector

        rows = (
            queryset.annotate(rank=SearchRank(SearchVector("text"), SearchQuery(query, search_type="websearch")))
            .filter(rank__gt=0)
            .order_by("-rank")[:limit]
        )
        return [(row, float(row.rank)) for row in rows]

    terms = tokenize(query) or [query.lower()]
    condition = Q()
    for term in terms:
        condition |= Q(text__icontains=term)
    scored = []
    for row in queryset.filter(condition)[:CANDIDATE_POOL]:
        text = row.text.lower()
        score = sum(min(text.count(term), 10) for term in terms) + 3 * (query.lower() in text)
        if score:
            scored.append((row, float(score)))
    scored.sort(key=lambda pair: pair[1], reverse=True)
    return scored[:limit]


def semantic_rank(queryset, vector, model_name, limit):
    """Return ``[(row, cosine)]`` best first, for rows embedded with the current model."""
    rows = queryset.filter(embedding_model=model_name).exclude(embedding=None)
    scored = [(row, cosine(vector, row.embedding)) for row in rows.iterator(chunk_size=500)]
    scored = [pair for pair in scored if pair[1] > 0]
    scored.sort(key=lambda pair: pair[1], reverse=True)
    return scored[:limit]


def to_hit(kind, row, query):
    text = strip_context(row.text)
    if kind == "post":
        post = row.post
        return Hit(
            id=f"post:{row.pk}", kind=kind, title=post.title, url=post.get_absolute_url(), heading=row.heading,
            text=text, snippet=snippet(text, query), source=post.author.get_full_name() or post.author.username,
            published_at=(post.published_at or post.created_at).isoformat(),
        )
    article = row.article
    return Hit(
        id=f"newsletter:{row.pk}", kind=kind, title=article.title, url=article.url, heading=row.heading,
        text=text, snippet=snippet(text, query), source=article.source.name,
        published_at=article.published_at.isoformat() if article.published_at else None,
    )


def kb_search(query, scope="posts", limit=8, mode="hybrid"):
    """Search passages. ``scope`` is posts, newsletters or all; returns ``[Hit]`` best first."""
    query = (query or "").strip()
    if not query:
        return []
    scope = scope if scope in SCOPES else "posts"
    mode = mode if mode in MODES else "hybrid"
    limit = max(1, min(int(limit), 50))
    querysets = _querysets(scope)

    rankings, rows = {}, {}
    if mode in ("keyword", "hybrid"):
        for kind, queryset in querysets.items():
            ranked = keyword_rank(queryset, query, limit * 2)
            rankings[f"keyword:{kind}"] = [(kind, row.pk) for row, _ in ranked]
            rows.update({(kind, row.pk): row for row, _ in ranked})
    if mode in ("semantic", "hybrid"):
        try:
            embedder = get_embedder()
            [vector] = embedder.embed([query], "query")
            vector = normalize(vector)
            for kind, queryset in querysets.items():
                ranked = semantic_rank(queryset, vector, embedder.model_name, limit * 2)
                rankings[f"semantic:{kind}"] = [(kind, row.pk) for row, _ in ranked]
                rows.update({(kind, row.pk): row for row, _ in ranked})
        except Exception:
            if mode == "semantic":
                raise
            logger.exception("Semantic search unavailable; using keyword results only.")

    hits = []
    for key, score, found_by in rrf_merge(rankings)[:limit]:
        hit = to_hit(key[0], rows[key], query)
        hit.score = round(score, 6)
        hit.matched_by = sorted({name.split(":")[0] for name in found_by})
        hits.append(hit)
    return hits
