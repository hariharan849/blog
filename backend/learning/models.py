from django.db import models
from taggit.managers import TaggableManager


class Source(models.Model):
    class Kind(models.TextChoices):
        SUBSTACK = "substack", "Substack"
        MEDIUM = "medium", "Medium"
        TOWARDS_AI = "towards_ai", "Towards AI"
        RSS = "rss", "RSS / other"

    name = models.CharField(max_length=200)
    kind = models.CharField(max_length=20, choices=Kind.choices, default=Kind.RSS)
    site_url = models.URLField(max_length=500, blank=True)
    feed_url = models.URLField(max_length=500, unique=True)
    is_active = models.BooleanField(default=True)

    # HTTP caching validators so unchanged feeds come back as 304s.
    etag = models.CharField(max_length=255, blank=True)
    modified = models.CharField(max_length=255, blank=True)
    last_fetched_at = models.DateTimeField(null=True, blank=True)
    last_error = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Interest(models.Model):
    """A topic you want to learn about; drives relevance scoring."""

    name = models.CharField(max_length=100, unique=True)
    weight = models.PositiveSmallIntegerField(default=3, help_text="1 (mild) to 5 (top priority).")

    class Meta:
        ordering = ["-weight", "name"]

    def __str__(self):
        return self.name


class Article(models.Model):
    class Status(models.TextChoices):
        NEW = "new", "New"
        ENRICHED = "enriched", "Enriched by AI"
        BASIC = "basic", "Basic (keyword) enrichment"
        FAILED = "failed", "Failed"

    class Difficulty(models.TextChoices):
        BEGINNER = "beginner", "Beginner"
        INTERMEDIATE = "intermediate", "Intermediate"
        ADVANCED = "advanced", "Advanced"

    source = models.ForeignKey(Source, on_delete=models.CASCADE, related_name="articles")
    url = models.URLField(max_length=1000, unique=True)
    guid = models.CharField(max_length=1000, blank=True)
    title = models.CharField(max_length=500)
    author = models.CharField(max_length=200, blank=True)
    published_at = models.DateTimeField(null=True, blank=True, db_index=True)
    fetched_at = models.DateTimeField(auto_now_add=True)
    content_html = models.TextField(blank=True)
    content_text = models.TextField(blank=True)
    word_count = models.PositiveIntegerField(default=0)
    feed_categories = models.JSONField(default=list, blank=True)

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.NEW, db_index=True)
    summary = models.TextField(blank=True)
    key_points = models.JSONField(default=list, blank=True, help_text='[{"point": ..., "why_interesting": ...}]')
    tags = TaggableManager(blank=True)
    difficulty = models.CharField(max_length=20, choices=Difficulty.choices, blank=True)
    content_type = models.CharField(max_length=30, blank=True)
    relevance = models.PositiveSmallIntegerField(default=0, db_index=True)
    relevance_reason = models.TextField(blank=True)
    worth_deep_read = models.BooleanField(default=False)
    enriched_model = models.CharField(max_length=100, blank=True)
    enriched_at = models.DateTimeField(null=True, blank=True)
    error = models.TextField(blank=True)

    is_read = models.BooleanField(default=False)
    is_starred = models.BooleanField(default=False)

    # Pipeline bookkeeping: each step records the content hash it last completed for, so a retry
    # or re-run skips finished steps (and never pays twice for embeddings or Claude calls).
    content_hash = models.CharField(max_length=64, blank=True, editable=False)
    indexed_hash = models.CharField(max_length=64, blank=True, editable=False)
    enriched_hash = models.CharField(max_length=64, blank=True, editable=False)

    class Meta:
        ordering = ["-published_at", "-fetched_at"]

    @property
    def reading_minutes(self):
        return max(1, round(self.word_count / 230))

    def __str__(self):
        return self.title


class DailyDigest(models.Model):
    date = models.DateField(unique=True)
    articles = models.ManyToManyField(Article, through="DigestItem", related_name="digests")

    # The day's learning byte, synthesised from the selected articles.
    headline = models.CharField(max_length=300, blank=True)
    intro = models.TextField(blank=True)
    takeaways = models.JSONField(default=list, blank=True, help_text='[{"title", "explanation", "source_urls"}]')
    try_today = models.TextField(blank=True)
    generated_by = models.CharField(max_length=100, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    emailed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-date"]

    def __str__(self):
        return f"Daily Bytes {self.date:%Y-%m-%d}"


class DigestItem(models.Model):
    digest = models.ForeignKey(DailyDigest, on_delete=models.CASCADE, related_name="items")
    article = models.ForeignKey(Article, on_delete=models.CASCADE)
    rank = models.PositiveSmallIntegerField()

    class Meta:
        ordering = ["rank"]
        constraints = [models.UniqueConstraint(fields=["digest", "article"], name="unique_digest_article")]


class ArticlePassage(models.Model):
    """A chunk of a newsletter article plus its embedding: the unit of search and of citations.

    When an article is edited, its old passages are kept with ``valid_to`` set instead of being
    deleted, so answers that cited them stay traceable.
    """

    article = models.ForeignKey(Article, on_delete=models.CASCADE, related_name="passages")
    position = models.PositiveIntegerField()
    heading = models.CharField(max_length=255, blank=True)
    text = models.TextField()
    embedding = models.JSONField(null=True, blank=True)
    embedding_model = models.CharField(max_length=100, blank=True)
    content_hash = models.CharField(max_length=64)
    valid_from = models.DateTimeField()
    valid_to = models.DateTimeField(null=True, blank=True, db_index=True)

    class Meta:
        ordering = ["article", "position"]
        indexes = [models.Index(fields=["article", "valid_to"], name="passage_current_idx")]

    @property
    def is_current(self):
        return self.valid_to is None

    def __str__(self):
        return f"{self.article.title} [{self.position}]"


class PipelineFailure(models.Model):
    """A pipeline step that still failed after its retries: raw material for an evaluation set."""

    task_name = models.CharField(max_length=200)
    task_id = models.CharField(max_length=255, blank=True)
    source = models.ForeignKey(Source, null=True, blank=True, on_delete=models.SET_NULL, related_name="failures")
    article = models.ForeignKey(Article, null=True, blank=True, on_delete=models.SET_NULL, related_name="failures")
    payload = models.JSONField(default=dict, blank=True)
    error_type = models.CharField(max_length=200, blank=True)
    error = models.TextField()
    traceback = models.TextField(blank=True)
    attempts = models.PositiveIntegerField(default=1)
    resolved = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.task_name}: {self.error[:60]}"
