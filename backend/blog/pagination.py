from rest_framework import pagination
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler


class PageNumberPagination(pagination.PageNumberPagination):
    """Pages as ``{count, page, num_pages, results}`` (the shape the v1 API has always used)."""

    page_size_query_param = "page_size"
    max_page_size = 100

    def get_paginated_response(self, data):
        return Response({
            "count": self.page.paginator.count,
            "page": self.page.number,
            "num_pages": self.page.paginator.num_pages,
            "results": data,
        })


def exception_handler(exc, context):
    """Errors as ``{"error": "...", "fields": {...}}`` so the frontend has one shape to handle."""
    response = drf_exception_handler(exc, context)
    if response is None:
        return None
    data = response.data
    if isinstance(data, dict) and "detail" in data and len(data) == 1:
        response.data = {"error": str(data["detail"])}
    elif isinstance(data, dict):
        non_field = data.pop("non_field_errors", None)
        first = non_field or next(iter(data.values()), ["Invalid input."])
        message = first[0] if isinstance(first, list) and first else str(first)
        response.data = {"error": str(message), "fields": data}
    else:
        response.data = {"error": str(data[0] if isinstance(data, list) and data else data)}
    return response
