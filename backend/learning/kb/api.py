"""Knowledge-base API, mounted at /api/v1/kb/.

    GET  search/?q=...&scope=posts|newsletters|all&mode=hybrid&limit=8
    POST ask/   {"question": "...", "scope": "posts|newsletters|all"}

Anyone can search and ask over published blog posts. Newsletter passages are other people's
writing kept privately, so the newsletters/all scopes are only honoured for staff.
"""
from django.conf import settings
from rest_framework import permissions, serializers
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle
from rest_framework.views import APIView

from ..llm import get_client
from .ask import ask
from .search import MODES, SCOPES, kb_search


class AskAnonThrottle(AnonRateThrottle):
    scope = "kb_ask_anon"


class AskUserThrottle(UserRateThrottle):
    scope = "kb_ask_user"


def allowed_scope(request, requested):
    scope = requested if requested in SCOPES else "posts"
    return scope if request.user.is_staff else "posts"


class SearchQuerySerializer(serializers.Serializer):
    q = serializers.CharField(max_length=500, trim_whitespace=True)
    scope = serializers.ChoiceField(choices=SCOPES, default="posts")
    mode = serializers.ChoiceField(choices=MODES, default="hybrid")
    limit = serializers.IntegerField(min_value=1, max_value=50, default=8)


class AskSerializer(serializers.Serializer):
    question = serializers.CharField(max_length=500, trim_whitespace=True)
    scope = serializers.ChoiceField(choices=SCOPES, default="posts")


class KBSearchView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        params = SearchQuerySerializer(data=request.query_params)
        params.is_valid(raise_exception=True)
        data = params.validated_data
        scope = allowed_scope(request, data["scope"])
        hits = kb_search(data["q"], scope=scope, limit=data["limit"], mode=data["mode"])
        return Response({"query": data["q"], "scope": scope, "count": len(hits), "results": [h.as_dict() for h in hits]})


class KBAskView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [AskAnonThrottle, AskUserThrottle]

    def post(self, request):
        body = AskSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        scope = allowed_scope(request, body.validated_data["scope"])
        result = ask(body.validated_data["question"], scope=scope, client=get_client(), limit=settings.KB_ASK["PASSAGES"])
        return Response({**result, "scope": scope})
