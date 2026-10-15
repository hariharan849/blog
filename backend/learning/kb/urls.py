from django.urls import path

from . import api

urlpatterns = [
    path("search/", api.KBSearchView.as_view(), name="kb-search"),
    path("ask/", api.KBAskView.as_view(), name="kb-ask"),
]
