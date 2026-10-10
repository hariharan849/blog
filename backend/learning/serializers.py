from rest_framework import serializers

from .models import Article, DailyDigest, Interest, Source


class SourceSerializer(serializers.ModelSerializer):
    kind_display = serializers.CharField(source="get_kind_display", read_only=True)

    class Meta:
        model = Source
        fields = ["id", "name", "kind", "kind_display", "site_url", "feed_url", "is_active", "last_fetched_at", "last_error"]
        read_only_fields = [f for f in fields if f != "is_active"]


class InterestSerializer(serializers.ModelSerializer):
    weight = serializers.IntegerField(min_value=1, max_value=5, default=3)

    class Meta:
        model = Interest
        fields = ["id", "name", "weight"]


class ArticleSerializer(serializers.ModelSerializer):
    source = serializers.SerializerMethodField()
    tags = serializers.SerializerMethodField()
    difficulty_display = serializers.CharField(source="get_difficulty_display", read_only=True)
    reading_minutes = serializers.IntegerField(read_only=True)

    class Meta:
        model = Article
        fields = [
            "id", "title", "url", "source", "author", "published_at", "reading_minutes", "status", "error",
            "summary", "key_points", "tags", "difficulty", "difficulty_display", "content_type", "relevance",
            "relevance_reason", "worth_deep_read", "is_read", "is_starred",
        ]
        read_only_fields = [f for f in fields if f not in ("is_read", "is_starred")]

    def get_source(self, article):
        return {"id": article.source_id, "name": article.source.name}

    def get_tags(self, article):
        return [{"name": tag.name, "slug": tag.slug} for tag in article.tags.all()]


class DigestSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = DailyDigest
        fields = ["date", "headline"]


class DigestSerializer(serializers.ModelSerializer):
    articles = serializers.SerializerMethodField()

    class Meta:
        model = DailyDigest
        fields = ["date", "headline", "intro", "takeaways", "try_today", "generated_by", "updated_at", "articles"]

    def get_articles(self, digest):
        items = digest.items.select_related("article__source").prefetch_related("article__tags")
        return ArticleSerializer([item.article for item in items], many=True).data
