"""Answer questions from the knowledge base with numbered citations."""
import logging
import re

from django.conf import settings
from pydantic import BaseModel, Field

from ..llm import LLMError, parse_structured
from .search import kb_search

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "You answer questions using only the numbered sources provided. Cite every claim with the "
    "source number in square brackets, like [1] or [2][3]. If the sources don't contain the answer, "
    "say so plainly instead of guessing. Write 1-3 short paragraphs of plain text: no markdown "
    "headings, lists or bold. Quote at most a sentence from any source."
)

CITATION_MARKER = re.compile(r"\[(\d+)\]")


class Citation(BaseModel):
    n: int = Field(description="Number of the cited source.")
    quote: str = Field(description="The exact sentence or phrase from that source that supports the answer.")


class Answer(BaseModel):
    answer: str = Field(description="The answer, with [n] markers after the claims they support.")
    citations: list[Citation] = Field(description="One entry per source number used in the answer.")


def format_sources(hits):
    blocks = []
    for number, hit in enumerate(hits, 1):
        heading = f" › {hit.heading}" if hit.heading else ""
        blocks.append(f'<source n="{number}" title="{hit.title}{heading}" from="{hit.source}">\n{hit.text}\n</source>')
    return "\n\n".join(blocks)


def ask(question, scope="posts", client=None, limit=8):
    """Retrieve passages and, if a Claude client is available, answer with validated citations.

    Returns ``{"question", "answer", "citations", "sources", "model", "mode"}``. ``mode`` is
    "answer", or "passages" when there is no client, nothing was found or the model call failed.
    """
    question = (question or "").strip()
    hits = kb_search(question, scope=scope, limit=limit) if question else []
    sources = [{"n": number, **hit.as_dict()} for number, hit in enumerate(hits, 1)]
    result = {"question": question, "answer": None, "citations": [], "sources": sources, "model": None, "mode": "passages"}
    if not hits or client is None:
        return result

    config = settings.KB_ASK
    try:
        answer, model = parse_structured(
            client, model=config["MODEL"], effort=config["EFFORT"], system=SYSTEM_PROMPT,
            user_content=f"{format_sources(hits)}\n\nQuestion: {question}", output_format=Answer,
            max_tokens=config["MAX_TOKENS"],
        )
    except LLMError as exc:
        logger.warning("Ask failed, returning passages only: %s", exc)
        result["error"] = "The answer could not be generated right now; here are the most relevant passages."
        return result

    # Only keep citations that point at sources we actually sent; drop markers that don't.
    valid = set(range(1, len(hits) + 1))
    citations, seen = [], set()
    for citation in answer.citations:
        if citation.n in valid and citation.n not in seen:
            seen.add(citation.n)
            citations.append({"n": citation.n, "quote": citation.quote.strip(), "source_id": hits[citation.n - 1].id})
    text = CITATION_MARKER.sub(lambda m: m.group(0) if int(m.group(1)) in valid else "", answer.answer).strip()
    result.update(answer=text, citations=sorted(citations, key=lambda c: c["n"]), model=model, mode="answer")
    return result
