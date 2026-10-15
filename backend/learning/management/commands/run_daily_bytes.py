from datetime import date as date_type

from django.core.management.base import BaseCommand, CommandError

from learning.pipeline.digest import build_digest, email_digest
from learning.llm import get_client
from learning.pipeline.feeds import fetch_all
from learning.pipeline.steps import process_pending


class Command(BaseCommand):
    help = "Fetch followed feeds, index and enrich new articles, and build the day's Daily Bytes digest (runs inline)."

    def add_arguments(self, parser):
        parser.add_argument("--date", help="Digest date (YYYY-MM-DD); defaults to today.")
        parser.add_argument("--skip-fetch", action="store_true")
        parser.add_argument("--skip-enrich", action="store_true")
        parser.add_argument("--no-email", action="store_true")
        parser.add_argument("--limit", type=int, help="Max articles to enrich this run.")
        parser.add_argument("--base-url", default="", help="Public URL of /bytes/ to link from the email.")

    def handle(self, *args, **options):
        try:
            date = date_type.fromisoformat(options["date"]) if options["date"] else None
        except ValueError as exc:
            raise CommandError(f"Invalid --date: {exc}")
        client = get_client()
        if client is None:
            self.stdout.write(self.style.WARNING("ANTHROPIC_API_KEY not set: using keyword-based enrichment."))

        if not options["skip_fetch"]:
            new, failed = fetch_all()
            self.stdout.write(f"Fetched {new} new article(s); {failed} source(s) reported errors.")
        if not options["skip_enrich"]:
            # Index (chunk + embed) and enrich each new or edited article; finished steps are skipped.
            summary = process_pending(limit=options["limit"], client=client)
            statuses = ", ".join(f"{count} {status}" for status, count in summary["statuses"].items()) or "nothing new"
            self.stdout.write(f"Indexed {summary['indexed']} article(s) for search.")
            self.stdout.write(f"Enriched: {statuses}.")
            if summary["failed"]:
                self.stdout.write(self.style.WARNING(f"{summary['failed']} article(s) failed; see Pipeline failures."))

        digest = build_digest(date=date, client=client)
        self.stdout.write(self.style.SUCCESS(
            f"{digest}: {digest.items.count()} article(s) — {digest.headline}"
        ))
        if not options["no_email"] and email_digest(digest, base_url=options["base_url"]):
            self.stdout.write("Emailed the digest.")
