"""Pick the day's best articles and turn them into a short learning byte."""
import logging
from datetime import datetime, time, timedelta

from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone
from pydantic import BaseModel, Field

from ..models import Article, DailyDigest, DigestItem
from .enrich import EnrichmentError, call_claude

logger = logging.getLogger(__name__)


class Takeaway(BaseModel):
    title: str = Field(description="Short name of the idea.")
    explanation: str = Field(description="2-4 sentences teaching the idea, combining sources where useful.")
    source_urls: list[str] = Field(description="URLs of the articles this takeaway is drawn from.")


class DailyLesson(BaseModel):
    headline: str = Field(description="A specific, curiosity-sparking headline for today's byte.")
    intro: str = Field(description="2-3 sentences: the common thread across today's reading.")
    takeaways: list[Takeaway] = Field(description="3 to 5 takeaways, most valuable first.")
    try_today: str = Field(description="One small, concrete exercise to apply something today (under 30 min).")


def select_articles(date):
    """Top articles for ``date``: relevant, recent, not featured on an earlier day, capped per source."""
    config = settings.DAILY_BYTES
    end = timezone.make_aware(datetime.combine(date + timedelta(days=1), time.min))
    start = end - timedelta(days=config["MAX_ARTICLE_AGE_DAYS"])
    candidates = (
        Article.objects.filter(
            status__in=[Article.Status.ENRICHED, Article.Status.BASIC],
            relevance__gte=config["MIN_RELEVANCE"],
            published_at__gte=start, published_at__lt=end,
        )
        .exclude(digests__date__lt=date)
        .select_related("source")
        .order_by("-relevance", "-worth_deep_read", "-published_at")
    )
    picked, per_source = [], {}
    for article in candidates:
        if per_source.get(article.source_id, 0) >= config["MAX_PER_SOURCE"]:
            continue
        per_source[article.source_id] = per_source.get(article.source_id, 0) + 1
        picked.append(article)
        if len(picked) >= config["DIGEST_SIZE"]:
            break
    return picked


def lesson_prompt(articles):
    blocks = []
    for article in articles:
        points = "\n".join(f"  - {p['point']} ({p.get('why_interesting', '')})" for p in article.key_points)
        blocks.append(f"## {article.title}\nURL: {article.url}\nSummary: {article.summary}\nKey points:\n{points}")
    return "Today's selected articles:\n\n" + "\n\n".join(blocks)


def basic_lesson(articles):
    if not articles:
        return DailyLesson(headline="No new reading today", intro="", takeaways=[], try_today="")
    takeaways = [
        Takeaway(
            title=article.title,
            explanation=(article.key_points[0]["point"] if article.key_points else article.summary),
            source_urls=[article.url],
        )
        for article in articles[:5]
    ]
    top = articles[0]
    return DailyLesson(
        headline=f"{len(articles)} reads worth your time today",
        intro="Picked by matching today's articles against your interests.",
        takeaways=takeaways,
        try_today=f"Read “{top.title}” in full (~{top.reading_minutes} min) and note one idea to try.",
    )


def build_digest(date=None, client=None):
    """Create or refresh the digest for ``date`` (idempotent)."""
    date = date or timezone.localdate()
    articles = select_articles(date)
    lesson, generated_by = basic_lesson(articles), "keyword"
    if client and articles:
        try:
            lesson, generated_by = call_claude(
                client,
                "You are a learning coach. Turn today's reading into one short, high-signal lesson. "
                "Only use URLs from the provided articles.",
                lesson_prompt(articles),
                DailyLesson,
            )
        except EnrichmentError as exc:
            logger.warning("Lesson generation failed, using the basic lesson: %s", exc)

    allowed_urls = {article.url for article in articles}
    with transaction.atomic():
        digest, _ = DailyDigest.objects.update_or_create(
            date=date,
            defaults={
                "headline": lesson.headline[:300],
                "intro": lesson.intro,
                "takeaways": [
                    {**takeaway.model_dump(), "source_urls": [u for u in takeaway.source_urls if u in allowed_urls]}
                    for takeaway in lesson.takeaways[:5]
                ],
                "try_today": lesson.try_today,
                "generated_by": generated_by,
            },
        )
        digest.items.all().delete()
        DigestItem.objects.bulk_create(
            [DigestItem(digest=digest, article=article, rank=rank) for rank, article in enumerate(articles, 1)]
        )
    return digest


def digest_as_text(digest, base_url=""):
    lines = [digest.headline, "=" * len(digest.headline), "", digest.intro, ""]
    for number, takeaway in enumerate(digest.takeaways, 1):
        lines += [f"{number}. {takeaway['title']}", f"   {takeaway['explanation']}"]
        lines += [f"   {url}" for url in takeaway.get("source_urls", [])]
        lines.append("")
    if digest.try_today:
        lines += ["Try today:", digest.try_today, ""]
    lines += ["Today's reading:", ""]
    for item in digest.items.select_related("article__source"):
        article = item.article
        lines += [
            f"* {article.title} ({article.source.name}, {article.reading_minutes} min, relevance {article.relevance})",
            f"  {article.url}",
            f"  {article.summary}",
            "",
        ]
    if base_url:
        lines.append(f"Open in Daily Bytes: {base_url}")
    return "\n".join(lines)


def email_digest(digest, base_url="", force=False):
    recipients = settings.DAILY_BYTES["EMAIL_TO"]
    if not recipients or (digest.emailed_at and not force) or not digest.items.exists():
        return False
    send_mail(f"Daily Bytes: {digest.headline}", digest_as_text(digest, base_url), None, recipients)
    digest.emailed_at = timezone.now()
    digest.save(update_fields=["emailed_at"])
    return True
