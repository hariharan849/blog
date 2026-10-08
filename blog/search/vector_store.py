"""Vector stores hold chunk embeddings and answer nearest-neighbour queries.

``DatabaseVectorStore`` keeps vectors in ``PostChunk.embedding`` and scores them in Python. That is
simple and portable and comfortably handles a personal blog (thousands of chunks). For larger
corpora implement the same two methods on top of pgvector, Qdrant, etc. and point
``AI_SEARCH["VECTOR_STORE"]`` at it.
"""
from django.conf import settings
from django.utils.module_loading import import_string


def get_vector_store():
    return import_string(settings.AI_SEARCH["VECTOR_STORE"])()


def cosine(a, b):
    # Embeddings are normalised on write, so the dot product is the cosine similarity.
    return sum(x * y for x, y in zip(a, b))


class DatabaseVectorStore:
    def save(self, post, chunks, vectors, model_name):
        from blog.models import PostChunk

        post.chunks.all().delete()
        PostChunk.objects.bulk_create([
            PostChunk(
                post=post, position=chunk.position, heading=chunk.heading[:255], text=chunk.text,
                embedding=vector, embedding_model=model_name,
            )
            for chunk, vector in zip(chunks, vectors)
        ])

    def query(self, vector, model_name, post_queryset, limit):
        """Return ``[(chunk, score)]`` best first, restricted to posts in ``post_queryset``."""
        from blog.models import PostChunk

        chunks = (
            PostChunk.objects.filter(post__in=post_queryset, embedding_model=model_name)
            .exclude(embedding=None)
            .select_related("post")
        )
        scored = [(chunk, cosine(vector, chunk.embedding)) for chunk in chunks.iterator()]
        scored.sort(key=lambda pair: pair[1], reverse=True)
        return scored[:limit]
