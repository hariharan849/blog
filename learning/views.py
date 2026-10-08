from datetime import date as date_type

from django.contrib import messages
from django.contrib.auth.decorators import user_passes_test
from django.core.paginator import Paginator
from django.db.models import Q
from django.http import Http404
from django.shortcuts import get_object_or_404, redirect, render
from django.utils import timezone
from django.utils.http import url_has_allowed_host_and_scheme
from django.views.decorators.http import require_POST

from .forms import InterestForm, SourceImportForm
from .models import Article, DailyDigest, Interest, Source
from .pipeline.feeds import import_sources

staff_required = user_passes_test(lambda user: user.is_active and user.is_staff, login_url="login")


@staff_required
def digest_view(request, date=None):
    if date:
        try:
            day = date_type.fromisoformat(date)
        except ValueError:
            raise Http404("Invalid date")
        digest = get_object_or_404(DailyDigest, date=day)
    else:
        digest = DailyDigest.objects.first()
    items = []
    if digest:
        items = digest.items.select_related("article__source").prefetch_related("article__tags")
    return render(request, "learning/digest.html", {
        "digest": digest,
        "items": items,
        "is_today": digest is not None and digest.date == timezone.localdate(),
        "has_sources": Source.objects.exists(),
    })


@staff_required
def archive_view(request):
    digests = DailyDigest.objects.all()
    return render(request, "learning/archive.html", {"digests": Paginator(digests, 30).get_page(request.GET.get("page"))})


@staff_required
def articles_view(request):
    articles = Article.objects.select_related("source").prefetch_related("tags").order_by("-published_at")
    filters = {key: request.GET.get(key, "") for key in ("q", "tag", "source", "starred", "unread")}
    if filters["q"]:
        articles = articles.filter(Q(title__icontains=filters["q"]) | Q(summary__icontains=filters["q"]))
    if filters["tag"]:
        articles = articles.filter(tags__slug=filters["tag"]).distinct()
    if filters["source"]:
        articles = articles.filter(source_id=filters["source"])
    if filters["starred"]:
        articles = articles.filter(is_starred=True)
    if filters["unread"]:
        articles = articles.filter(is_read=False)
    params = request.GET.copy()
    params.pop("page", None)
    return render(request, "learning/articles.html", {
        "articles": Paginator(articles, 30).get_page(request.GET.get("page")),
        "filters": filters,
        "sources": Source.objects.all(),
        "query_string": params.urlencode(),
    })


@staff_required
@require_POST
def toggle_view(request, pk, field):
    fields = {"read": "is_read", "star": "is_starred"}
    if field not in fields:
        raise Http404
    article = get_object_or_404(Article, pk=pk)
    setattr(article, fields[field], not getattr(article, fields[field]))
    article.save(update_fields=[fields[field]])
    next_url = request.POST.get("next", "")
    if not url_has_allowed_host_and_scheme(next_url, {request.get_host()}, request.is_secure()):
        next_url = "learning:digest"
    return redirect(next_url)


@staff_required
def sources_view(request):
    import_form, interest_form = SourceImportForm(), InterestForm()
    if request.method == "POST" and request.POST.get("action") == "import":
        import_form = SourceImportForm(request.POST, request.FILES)
        if import_form.is_valid():
            batches = []
            if import_form.cleaned_data["urls"]:
                batches.append((import_form.cleaned_data["urls"], ""))
            if upload := import_form.cleaned_data["opml"]:
                batches.append((upload.read().decode("utf-8", errors="replace"), upload.name))
            created, existing, errors = [], [], []
            for content, filename in batches:
                try:
                    new, old, failed = import_sources(content, filename)
                except Exception as exc:  # e.g. malformed OPML
                    new, old, failed = [], [], [f"{filename or 'URL list'}: {exc}"]
                created += new
                existing += old
                errors += failed
            messages.success(request, f"Added {len(created)} source(s); {len(existing)} already present.")
            for error in errors:
                messages.error(request, error)
            return redirect("learning:sources")
    elif request.method == "POST" and request.POST.get("action") == "interest":
        interest_form = InterestForm(request.POST)
        if interest_form.is_valid():
            interest_form.save()
            return redirect("learning:sources")
    elif request.method == "POST" and request.POST.get("action") in ("toggle_source", "delete_interest"):
        if request.POST["action"] == "toggle_source":
            source = get_object_or_404(Source, pk=request.POST.get("pk"))
            source.is_active = not source.is_active
            source.save(update_fields=["is_active"])
        else:
            Interest.objects.filter(pk=request.POST.get("pk")).delete()
        return redirect("learning:sources")

    return render(request, "learning/sources.html", {
        "sources": Source.objects.all(),
        "interests": Interest.objects.all(),
        "import_form": import_form,
        "interest_form": interest_form,
    })
