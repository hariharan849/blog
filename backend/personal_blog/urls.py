"""Django serves only the JSON API, the admin and discovery files; pages come from the Next.js frontend."""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path, re_path
from django.views.static import serve

from blog.urls import api_urlpatterns, discovery_urlpatterns

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v1/', include(api_urlpatterns)),
    path('api/v1/bytes/', include('learning.urls')),
    path('api/v1/kb/', include('learning.kb.urls')),
    *discovery_urlpatterns,
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
elif settings.SERVE_MEDIA:
    # Uploaded images for a small personal blog; use object storage (S3, etc.) for anything bigger.
    urlpatterns += [re_path(r"^media/(?P<path>.*)$", serve, {"document_root": settings.MEDIA_ROOT})]
