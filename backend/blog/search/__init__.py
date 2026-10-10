"""AI-ready search for blog posts.

Layers (each one replaceable via ``settings.AI_SEARCH``):

* ``text``         – HTML -> plain text, and splitting into overlapping, heading-aware chunks.
* ``embeddings``   – turns text into vectors (local hashing, Voyage AI, any OpenAI-compatible API).
* ``vector_store`` – stores and queries chunk vectors (database/JSON by default; pgvector etc. later).
* ``indexing``     – keeps ``BlogPost.search_text`` and ``PostChunk`` rows in sync with posts.
* ``service``      – keyword, semantic and hybrid (reciprocal rank fusion) search.
"""
from .service import SearchResult, SearchUnavailable, search

__all__ = ["SearchResult", "SearchUnavailable", "search"]
