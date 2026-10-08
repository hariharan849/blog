import re
from dataclasses import dataclass
from html import unescape
from html.parser import HTMLParser

BLOCK_TAGS = {
    "p", "div", "br", "li", "ul", "ol", "pre", "blockquote", "table", "tr", "section", "article",
    "h1", "h2", "h3", "h4", "h5", "h6",
}
HEADING_TAGS = {"h1", "h2", "h3", "h4", "h5", "h6"}
SKIP_TAGS = {"script", "style"}
HEADING_MARK = "\x00H\x00"


class _TextExtractor(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []
        self._skip = 0

    def handle_starttag(self, tag, attrs):
        if tag in SKIP_TAGS:
            self._skip += 1
        elif tag in BLOCK_TAGS:
            self.parts.append("\n")
            if tag in HEADING_TAGS:
                self.parts.append(HEADING_MARK)

    def handle_endtag(self, tag):
        if tag in SKIP_TAGS:
            self._skip = max(0, self._skip - 1)
        elif tag in BLOCK_TAGS:
            self.parts.append("\n")

    def handle_data(self, data):
        if not self._skip:
            self.parts.append(data)


def _extract(html):
    parser = _TextExtractor()
    parser.feed(html or "")
    parser.close()
    lines = []
    for raw in "".join(parser.parts).split("\n"):
        line = re.sub(r"\s+", " ", unescape(raw)).strip()
        if line.replace(HEADING_MARK, "").strip():
            lines.append(line)
    return lines


def html_to_text(html):
    """Return readable plain text with one block per line."""
    return "\n".join(line.replace(HEADING_MARK, "").strip() for line in _extract(html))


@dataclass
class Chunk:
    position: int
    heading: str
    text: str


def chunk_html(html, title="", chunk_words=200, overlap_words=40):
    """Split a post into overlapping word windows that never cross a heading.

    Each chunk is prefixed with the post title and section heading so it stays meaningful when it
    is retrieved on its own (by a semantic search or as context for an LLM).
    """
    overlap_words = max(0, min(overlap_words, chunk_words - 1))
    sections = []  # (heading, [words])
    heading = ""
    for line in _extract(html):
        if line.startswith(HEADING_MARK):
            heading = line.replace(HEADING_MARK, "").strip()
            sections.append((heading, []))
            continue
        if not sections:
            sections.append((heading, []))
        sections[-1][1].extend(line.split())

    chunks = []
    for heading, words in sections:
        if not words:
            continue
        start = 0
        while True:
            window = words[start:start + chunk_words]
            prefix = " > ".join(part for part in (title, heading) if part)
            body = " ".join(window)
            chunks.append(Chunk(len(chunks), heading, f"{prefix}\n{body}" if prefix else body))
            if start + chunk_words >= len(words):
                break
            start += chunk_words - overlap_words
    if not chunks and title:
        chunks.append(Chunk(0, "", title))
    return chunks


def snippet(text, query, length=240):
    """Return a short excerpt of ``text`` centred on the first query term found."""
    text = re.sub(r"\s+", " ", text or "").strip()
    if len(text) <= length:
        return text
    lowered = text.lower()
    hit = -1
    for term in sorted(tokenize(query), key=len, reverse=True):
        hit = lowered.find(term)
        if hit >= 0:
            break
    start = max(0, hit - length // 3) if hit >= 0 else 0
    excerpt = text[start:start + length].strip()
    return ("…" if start else "") + excerpt + ("…" if start + length < len(text) else "")


def tokenize(text):
    return [token for token in re.findall(r"\w+", (text or "").lower()) if len(token) > 1]
