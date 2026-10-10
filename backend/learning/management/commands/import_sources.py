from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from learning.pipeline.feeds import import_sources


class Command(BaseCommand):
    help = "Add feeds from an OPML export, a CSV (URL in the first column) or a text file (one URL per line)."

    def add_arguments(self, parser):
        parser.add_argument("path")

    def handle(self, *args, path, **options):
        file = Path(path)
        if not file.exists():
            raise CommandError(f"{path} does not exist")
        created, existing, errors = import_sources(file.read_text(encoding="utf-8"), file.name)
        for source in created:
            self.stdout.write(f"added    {source.name} <{source.feed_url}>")
        for error in errors:
            self.stderr.write(f"error    {error}")
        self.stdout.write(self.style.SUCCESS(
            f"{len(created)} added, {len(existing)} already present, {len(errors)} failed."
        ))
