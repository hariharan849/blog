import json

from django.core.management.base import BaseCommand

from learning.models import PipelineFailure


class Command(BaseCommand):
    help = "Export pipeline failures as JSON Lines, e.g. to build an evaluation set from real failures."

    def add_arguments(self, parser):
        parser.add_argument("--output", "-o", help="File to write (default: stdout).")
        parser.add_argument("--unresolved", action="store_true", help="Only failures not marked resolved.")
        parser.add_argument("--with-content", action="store_true", help="Include the article text that failed.")

    def handle(self, *args, output, unresolved, with_content, **options):
        failures = PipelineFailure.objects.select_related("article__source", "source").order_by("created_at")
        if unresolved:
            failures = failures.filter(resolved=False)
        stream = open(output, "w", encoding="utf-8") if output else self.stdout
        count = 0
        try:
            for failure in failures.iterator():
                record = {
                    "id": failure.pk, "created_at": failure.created_at.isoformat(), "task": failure.task_name,
                    "error_type": failure.error_type, "error": failure.error, "attempts": failure.attempts,
                    "resolved": failure.resolved, "payload": failure.payload,
                    "source": failure.source.feed_url if failure.source else None,
                    "article": {"id": failure.article_id, "title": failure.article.title, "url": failure.article.url}
                    if failure.article else None,
                }
                if with_content and failure.article:
                    record["article"]["content_text"] = failure.article.content_text
                line = json.dumps(record, ensure_ascii=False)
                stream.write(line + "\n" if output else line)  # OutputWrapper adds the newline
                count += 1
        finally:
            if output:
                stream.close()
        self.stderr.write(f"Exported {count} failure(s).")
