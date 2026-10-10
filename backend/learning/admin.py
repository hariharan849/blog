from django.contrib import admin, messages

from .models import Article, DailyDigest, DigestItem, Interest, Source
from .pipeline.enrich import enrich_article, get_client
from .pipeline.feeds import fetch_all


@admin.register(Source)
class SourceAdmin(admin.ModelAdmin):
    list_display = ("name", "kind", "feed_url", "is_active", "last_fetched_at", "last_error")
    list_filter = ("kind", "is_active")
    search_fields = ("name", "feed_url", "site_url")
    actions = ["fetch_now"]

    @admin.action(description="Fetch selected feeds now")
    def fetch_now(self, request, queryset):
        new, failed = fetch_all(queryset)
        self.message_user(request, f"{new} new article(s); {failed} source(s) with errors.", messages.INFO)


@admin.register(Interest)
class InterestAdmin(admin.ModelAdmin):
    list_display = ("name", "weight")
    list_editable = ("weight",)


@admin.register(Article)
class ArticleAdmin(admin.ModelAdmin):
    list_display = ("title", "source", "published_at", "status", "relevance", "difficulty", "is_starred")
    list_filter = ("status", "difficulty", "source", "is_starred", "is_read")
    search_fields = ("title", "summary", "url")
    readonly_fields = ("fetched_at", "enriched_at", "enriched_model")
    actions = ["re_enrich"]

    @admin.action(description="Re-run AI enrichment")
    def re_enrich(self, request, queryset):
        client = get_client()
        statuses = [enrich_article(article, client) for article in queryset.select_related("source")]
        self.message_user(request, f"Re-enriched {len(statuses)} article(s).", messages.SUCCESS)


class DigestItemInline(admin.TabularInline):
    model = DigestItem
    extra = 0
    raw_id_fields = ("article",)


@admin.register(DailyDigest)
class DailyDigestAdmin(admin.ModelAdmin):
    list_display = ("date", "headline", "generated_by", "emailed_at")
    inlines = [DigestItemInline]
