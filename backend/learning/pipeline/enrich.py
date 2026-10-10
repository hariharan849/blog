"""Turn raw articles into learning material: summary, interesting points, tags, relevance.

Uses Claude structured outputs when ANTHROPIC_API_KEY is set, otherwise a keyword fallback.
"""
import logging
import os
import re
from typing import Literal

import anthropic
from django.conf import settings
from django.utils import timezone
from pydantic import BaseModel, Field

from blog.search.text import chunk_html, tokenize

from ..models import Article, Interest

logger = logging.getLogger(__name__)

# Models that accept server-side refusal fallbacks (`fallbacks="default"`).
FALLBACK_MODELS = {"claude-opus-5-5", "claude-opus-5", "claude-fable-5-1", "claude-sonnet-5-5"}
FALLBACK_BETA = "server-side-fallback-2026-07-01"
MAX_ARTICLE_WORDS = 40_000


class KeyPoint(BaseModel):
    point: str = Field(description="One concrete idea, technique, finding or number from the article.")
    why_interesting: str = Field(description="Why it matters or what the reader can do with it.")


class ArticleInsights(BaseModel):
    summary: str = Field(description="2-3 sentence plain-language summary.")
    key_points: list[KeyPoint] = Field(description="3 to 5 of the most interesting, non-obvious points.")
    tags: list[str] = Field(description="3 to 6 short lowercase topic tags, e.g. 'rag', 'fine-tuning'.")
    difficulty: Literal["beginner", "intermediate", "advanced"]
    content_type: Literal["tutorial", "research", "opinion", "news", "case-study", "other"]
    relevance: int = Field(description="0-100: how useful this is for the reader's learning interests.")
    relevance_reason: str = Field(description="One sentence explaining the relevance score.")
    worth_deep_read: bool = Field(description="True if the full article rewards a careful read.")


class EnrichmentError(RuntimeError):
    pass


def get_client():
    """An Anthropic client when credentials are configured, else ``None`` (keyword fallback)."""
    if not (os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN")):
        return None
    return anthropic.Anthropic()


def interests_text():
    interests = list(Interest.objects.order_by("-weight", "name"))
    if not interests:
        return "No explicit interests set: assume a practitioner learning AI/ML engineering."
    return "\n".join(f"- {interest.name} (priority {interest.weight}/5)" for interest in interests)


def system_prompt(task):
    # Stable across the day's calls (interests are sorted), so it is a cacheable prefix.
    return (
        f"{task}\n\n"
        "The reader is building a daily learning habit. Their interests, highest priority first:\n"
        f"{interests_text()}\n\n"
        "Be specific and concrete: prefer techniques, numbers, trade-offs and surprising findings "
        "over generic statements. Never invent facts that are not in the provided text."
    )


def call_claude(client, task, user_content, output_format):
    config = settings.DAILY_BYTES
    model = config["MODEL"]
    extra = {"betas": [FALLBACK_BETA], "fallbacks": "default"} if model in FALLBACK_MODELS else {}
    try:
        response = client.beta.messages.parse(
            model=model,
            max_tokens=16000,
            output_config={"effort": config["EFFORT"]},
            system=[{"type": "text", "text": system_prompt(task), "cache_control": {"type": "ephemeral"}}],
            messages=[{"role": "user", "content": user_content}],
            output_format=output_format,
            **extra,
        )
    except anthropic.AuthenticationError:
        raise  # Misconfiguration: every call would fail, so stop the run.
    except anthropic.RateLimitError as exc:  # Already retried by the SDK.
        raise EnrichmentError(f"Rate limited: {exc.message}") from exc
    except anthropic.APIStatusError as exc:
        raise EnrichmentError(f"API error {exc.status_code}: {exc.message}") from exc
    except anthropic.APIConnectionError as exc:
        raise EnrichmentError(f"Connection error: {exc}") from exc

    if response.stop_reason == "refusal":
        category = getattr(response.stop_details, "category", None) if response.stop_details else None
        raise EnrichmentError(f"Model declined (category: {category or 'unspecified'})")
    if response.parsed_output is None:
        raise EnrichmentError(f"No structured output (stop_reason: {response.stop_reason})")
    return response.parsed_output, response.model


def article_prompt(article):
    words = article.content_text.split()
    body = " ".join(words)
    if len(words) > MAX_ARTICLE_WORDS:
        logger.warning("Article %s has %d words; sending the first %d.", article.pk, len(words), MAX_ARTICLE_WORDS)
        body = " ".join(words[:MAX_ARTICLE_WORDS]) + "\n[article truncated]"
    if len(words) < 120:
        body += "\n[Note: the feed only included an excerpt of this article.]"
    return (
        f"Title: {article.title}\nSource: {article.source.name}\nAuthor: {article.author or 'unknown'}\n"
        f"URL: {article.url}\nFeed categories: {', '.join(article.feed_categories) or 'none'}\n\n{body}"
    )


def enrich_with_claude(article, client):
    insights, model = call_claude(
        client,
        "You extract the most useful learning material from technical blog posts.",
        article_prompt(article),
        ArticleInsights,
    )
    article.summary = insights.summary.strip()
    article.key_points = [point.model_dump() for point in insights.key_points[:5]]
    article.difficulty = insights.difficulty
    article.content_type = insights.content_type
    article.relevance = max(0, min(100, insights.relevance))
    article.relevance_reason = insights.relevance_reason.strip()
    article.worth_deep_read = insights.worth_deep_read
    article.enriched_model = model
    article.status = Article.Status.ENRICHED
    tags = [tag.strip().lower()[:100] for tag in insights.tags if tag.strip()][:6]
    return tags


SENTENCE = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9\"'])")


def sentences(text):
    return [sentence.strip() for sentence in SENTENCE.split(text.replace("\n", " ")) if sentence.strip()]


def enrich_basic(article):
    """Keyword fallback: no API needed, weaker insights."""
    text_sentences = sentences(article.content_text)
    summary = []
    for sentence in text_sentences:
        summary.append(sentence)
        if len(" ".join(summary).split()) >= 45:
            break
    article.summary = " ".join(summary)

    points = []
    for chunk in chunk_html(article.content_html, chunk_words=100_000):
        if chunk.heading:
            body = chunk.text.split("\n", 1)[-1]
            lead = sentences(body)[:1]
            if lead:
                points.append({"point": f"{chunk.heading}: {lead[0]}", "why_interesting": ""})
    if not points:
        points = [{"point": sentence, "why_interesting": ""} for sentence in text_sentences[len(summary):][:3]]
    article.key_points = points[:5]

    tokens = tokenize(f"{article.title} {article.title} {article.content_text}")
    counts = {}
    for token in tokens:
        counts[token] = counts.get(token, 0) + 1
    score, matched = 0, []
    for interest in Interest.objects.all():
        terms = tokenize(interest.name)
        if terms and all(term in counts for term in terms):
            hits = min(counts[term] for term in terms)
            score += interest.weight * min(hits, 3)
            matched.append(interest.name.lower())
    article.relevance = min(100, score * 7) if Interest.objects.exists() else 50
    article.relevance_reason = (
        f"Mentions your interests: {', '.join(matched)}." if matched else "No direct match with your interests."
    )
    article.difficulty = ""
    article.content_type = ""
    article.worth_deep_read = article.word_count > 1500 and bool(matched)
    article.enriched_model = "keyword"
    article.status = Article.Status.BASIC
    categories = [category.lower()[:100] for category in article.feed_categories]
    return list(dict.fromkeys(matched + categories))[:6]


def enrich_article(article, client=None):
    """Enrich one article in place and save it. Returns the new status."""
    try:
        tags = enrich_with_claude(article, client) if client else enrich_basic(article)
        article.error = ""
    except EnrichmentError as exc:
        logger.warning("Enriching article %s failed: %s", article.pk, exc)
        article.status = Article.Status.FAILED
        article.error = str(exc)[:2000]
        tags = None
    article.enriched_at = timezone.now()
    article.save()
    if tags is not None:
        article.tags.set(tags, clear=True)
    return article.status


def enrich_pending(limit=None, client=None):
    """Enrich new articles, newest first. Returns ``{status: count}``."""
    limit = limit or settings.DAILY_BYTES["MAX_ENRICH_PER_RUN"]
    counts = {}
    for article in Article.objects.filter(status=Article.Status.NEW).select_related("source")[:limit]:
        status = enrich_article(article, client)
        counts[status] = counts.get(status, 0) + 1
    return counts
