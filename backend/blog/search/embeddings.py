"""Embedding providers.

An embedder is any object with ``model_name`` and ``embed(texts, input_type) -> list[list[float]]``
where ``input_type`` is ``"document"`` or ``"query"``. Select one with ``AI_SEARCH["EMBEDDER"]``.
"""
import hashlib
import json
import math
import urllib.request

from django.conf import settings
from django.utils.module_loading import import_string

from .text import tokenize


class EmbeddingError(RuntimeError):
    pass


def get_embedder():
    config = settings.AI_SEARCH
    return import_string(config["EMBEDDER"])(config)


def normalize(vector):
    norm = math.sqrt(sum(value * value for value in vector))
    return [value / norm for value in vector] if norm else list(vector)


class BaseEmbedder:
    default_model = ""

    def __init__(self, config):
        self.config = config
        self.model = config.get("EMBEDDING_MODEL") or self.default_model
        self.dimensions = config.get("EMBEDDING_DIMENSIONS")

    @property
    def model_name(self):
        return f"{type(self).__name__}:{self.model}"

    def embed(self, texts, input_type="document"):
        raise NotImplementedError


class HashingEmbedder(BaseEmbedder):
    """Dependency-free feature-hashing embedder (unigrams + bigrams).

    It captures word overlap rather than meaning, so it is a stand-in that keeps the whole pipeline
    working offline and in tests. Switch to a real model for true semantic search.
    """

    default_model = "hashing-v1"

    @property
    def model_name(self):
        return f"{type(self).__name__}:{self.model}:{self.dimensions}"

    def embed(self, texts, input_type="document"):
        return [self._embed_one(text) for text in texts]

    def _embed_one(self, text):
        vector = [0.0] * self.dimensions
        tokens = tokenize(text)
        features = tokens + [f"{a}_{b}" for a, b in zip(tokens, tokens[1:])]
        for feature in features:
            digest = hashlib.blake2b(feature.encode(), digest_size=8).digest()
            index = int.from_bytes(digest[:4], "little") % self.dimensions
            sign = 1.0 if digest[4] & 1 else -1.0
            vector[index] += sign
        return normalize(vector)


class HTTPEmbedder(BaseEmbedder):
    api_base = ""
    batch_size = 64
    timeout = 30

    def __init__(self, config):
        super().__init__(config)
        self.api_key = config.get("EMBEDDING_API_KEY")
        self.api_base = (config.get("EMBEDDING_API_BASE") or self.api_base).rstrip("/")
        if not self.api_key:
            raise EmbeddingError(f"{type(self).__name__} needs AI_SEARCH_EMBEDDING_API_KEY to be set.")

    def embed(self, texts, input_type="document"):
        vectors = []
        for start in range(0, len(texts), self.batch_size):
            vectors.extend(self._request(texts[start:start + self.batch_size], input_type))
        return vectors

    def _post(self, path, payload):
        request = urllib.request.Request(
            f"{self.api_base}{path}",
            data=json.dumps(payload).encode(),
            headers={"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                body = json.load(response)
        except Exception as exc:  # network, HTTP and JSON errors
            raise EmbeddingError(f"Embedding request failed: {exc}") from exc
        return [item["embedding"] for item in sorted(body["data"], key=lambda item: item["index"])]

    def _request(self, texts, input_type):
        raise NotImplementedError


class VoyageEmbedder(HTTPEmbedder):
    """Voyage AI embeddings (https://docs.voyageai.com/reference/embeddings-api)."""

    default_model = "voyage-3.5"
    api_base = "https://api.voyageai.com/v1"

    def _request(self, texts, input_type):
        return self._post("/embeddings", {"input": texts, "model": self.model, "input_type": input_type})


class OpenAICompatibleEmbedder(HTTPEmbedder):
    """Any server exposing the OpenAI ``/embeddings`` API (OpenAI, Ollama, vLLM, LM Studio, ...)."""

    default_model = "text-embedding-3-small"
    api_base = "https://api.openai.com/v1"

    def _request(self, texts, input_type):
        return self._post("/embeddings", {"input": texts, "model": self.model})
