import logging
from dataclasses import dataclass, field

from django.conf import settings
from django.db import connection
from django.db.models import Q

from .embeddings import get_embedder, normalize
from .text import snippet, tokenize
from .vector_store import get_vector_store

logger = logging.getLogger(__name__)

MODES = ("keyword", "semantic", "hybrid")
RRF_K = 60  # Standard reciprocal-rank-fusion constant.


class SearchUnavailable(RuntimeError):
    """Semantic search was requested but the embedding provider or vector store failed."""


@dataclass
class Passage:
    text: str
    heading: str
    score: float


@dataclass
class SearchResult:
    post: object
    score: float
    snippet: str
    passages: list = field(default_factory=list)
    matched_by: list = field(default_factory=list)


def search(query, mode=None, limit=10, queryset=None):
    """Search published posts.

    ``keyword``  – full-text (PostgreSQL) or term-matching (other databases) ranking.
    ``semantic`` – nearest chunks by embedding similarity; the matching passages are returned too,
                   so results can be fed straight into an LLM as grounded context (RAG).
    ``hybrid``   – both, merged with reciprocal rank fusion. Falls back to keyword-only if the
                   embedding provider is unavailable.
    """
    from blog.models import BlogPost

    query = (query or "").strip()
    mode = mode if mode in MODES else settings.AI_SEARCH["DEFAULT_MODE"]
    limit = max(1, min(int(limit), settings.AI_SEARCH["MAX_RESULTS"]))
    if not query:
        return []
    if queryset is None:
        queryset = BlogPost.objects.published()

    keyword_hits, semantic_hits = [], []
    if mode in ("keyword", "hybrid"):
        keyword_hits = keyword_search(query, queryset, limit * 2)
    if mode in ("semantic", "hybrid"):
        try:
            semantic_hits = semantic_search(query, queryset, limit * 2)
        except Exception as exc:
            if mode == "semantic":
                raise SearchUnavailable(str(exc)) from exc
            logger.exception("Semantic search unavailable; returning keyword results only.")

    if mode == "keyword":
        return [_result(post, score, query, [], ["keyword"]) for post, score in keyword_hits[:limit]]
    if mode == "semantic":
        return [_result(post, score, query, passages, ["semantic"]) for post, score, passages in semantic_hits[:limit]]

    fused = {}
    for rank, (post, _score) in enumerate(keyword_hits):
        entry = fused.setdefault(post.pk, {"post": post, "score": 0.0, "passages": [], "matched_by": []})
        entry["score"] += 1.0 / (RRF_K + rank + 1)
        entry["matched_by"].append("keyword")
    for rank, (post, _score, passages) in enumerate(semantic_hits):
        entry = fused.setdefault(post.pk, {"post": post, "score": 0.0, "passages": [], "matched_by": []})
        entry["score"] += 1.0 / (RRF_K + rank + 1)
        entry["passages"] = passages
        entry["matched_by"].append("semantic")
    ranked = sorted(fused.values(), key=lambda entry: entry["score"], reverse=True)[:limit]
    return [_result(e["post"], e["score"], query, e["passages"], e["matched_by"]) for e in ranked]


def _result(post, score, query, passages, matched_by):
    source = passages[0].text if passages else (post.search_text or post.excerpt or post.title)
    return SearchResult(post=post, score=round(score, 6), snippet=snippet(source, query),
                        passages=passages, matched_by=matched_by)


def keyword_search(query, queryset, limit):
    """Return ``[(post, score)]`` best first."""
    if connection.vendor == "postgresql":
        return _postgres_keyword_search(query, queryset, limit)

    terms = tokenize(query) or [query.lower()]
    condition = Q()
    for term in terms:
        condition |= Q(title__icontains=term) | Q(search_text__icontains=term) | Q(excerpt__icontains=term)
        condition |= Q(tags__name__iexact=term) | Q(category__name__icontains=term)
    candidates = queryset.filter(condition).distinct().select_related("category").prefetch_related("tags")

    phrase = query.lower()
    scored = []
    for post in candidates:
        title, body = post.title.lower(), f"{post.excerpt} {post.search_text}".lower()
        tags = {name.lower() for name in post.tags.names()}
        category = post.category.name.lower() if post.category else ""
        score = 0.0
        for term in terms:
            score += 5 * (term in title) + 3 * (term in tags) + 2 * (term in category)
            score += min(body.count(term), 10) * 0.5
        score += 5 * (phrase in title) + 2 * (phrase in body)
        if score:
            scored.append((post, score))
    scored.sort(key=lambda pair: (pair[1], pair[0].created_at), reverse=True)
    return scored[:limit]


def _postgres_keyword_search(query, queryset, limit):
    from django.contrib.postgres.aggregates import StringAgg
    from django.contrib.postgres.search import SearchQuery, SearchRank, SearchVector
    from django.db.models import OuterRef, Subquery, TextField, Value
    from django.db.models.functions import Coalesce

    from blog.models import BlogPost

    # Aggregate tag names in a subquery so the many-to-many join can't duplicate rows.
    tag_text = Subquery(
        BlogPost.objects.filter(pk=OuterRef("pk"))
        .annotate(names=StringAgg("tags__name", " "))
        .values("names")[:1]
    )
    vector = (
        SearchVector("title", weight="A")
        + SearchVector(Coalesce(tag_text, Value(""), output_field=TextField()), weight="A")
        + SearchVector("excerpt", "category__name", weight="B")
        + SearchVector("search_text", weight="C")
    )
    search_query = SearchQuery(query, search_type="websearch")
    posts = (
        queryset.annotate(rank=SearchRank(vector, search_query))
        .filter(rank__gt=0)
        .order_by("-rank", "-created_at")[:limit]
    )
    return [(post, float(post.rank)) for post in posts]


def semantic_search(query, queryset, limit, passages_per_post=3):
    """Return ``[(post, score, passages)]`` best first, scored by each post's best chunk."""
    embedder = get_embedder()
    [vector] = embedder.embed([query], "query")

    matches = get_vector_store().query(normalize(vector), embedder.model_name, queryset, limit * 5)
    by_post = {}
    for chunk, score in matches:
        if score <= 0:
            continue
        entry = by_post.setdefault(chunk.post_id, {"post": chunk.post, "score": score, "passages": []})
        if len(entry["passages"]) < passages_per_post:
            entry["passages"].append(Passage(text=chunk.text, heading=chunk.heading, score=round(score, 6)))
    ranked = sorted(by_post.values(), key=lambda entry: entry["score"], reverse=True)[:limit]
    return [(entry["post"], entry["score"], entry["passages"]) for entry in ranked]
