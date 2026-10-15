from django.apps import AppConfig


class LearningConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "learning"
    verbose_name = "Daily Bytes"

    def ready(self):
        from . import failures  # noqa: F401  (connects the Celery task_failure handler)
