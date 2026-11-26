import datetime as dt
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import make_lesson as ml  # noqa: E402


@pytest.mark.parametrize(
    "value",
    [
        "dQw4w9WgXcQ",
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=WL&index=3",
        "https://youtu.be/dQw4w9WgXcQ?si=abc",
        "https://m.youtube.com/shorts/dQw4w9WgXcQ",
        "https://www.youtube.com/embed/dQw4w9WgXcQ",
    ],
)
def test_video_id(value):
    assert ml.video_id(value) == "dQw4w9WgXcQ"


def test_video_id_rejects_other_links():
    with pytest.raises(ValueError):
        ml.video_id("https://example.com/watch?v=dQw4w9WgXcQ")


REPLY = """TITLE: How Vector Databases Find Neighbours
SUMMARY: Why approximate search is fast and when it is good enough.
TAGS: Vector DB, RAG , search
---
Vector databases store embeddings.

## Key takeaways
- Approximate is usually fine."""


def test_parse_lesson():
    lesson = ml.parse_lesson(REPLY)
    assert lesson.title == "How Vector Databases Find Neighbours"
    assert lesson.tags == ["vector-db", "rag", "search"]
    assert lesson.body.startswith("Vector databases")


def test_parse_lesson_needs_separator():
    with pytest.raises(ValueError):
        ml.parse_lesson("TITLE: x\nno body")


def test_save_post_and_done_ids(tmp_path):
    video = ml.Video("dQw4w9WgXcQ", 'A "quoted" title', "Some Channel")
    lesson = ml.parse_lesson(REPLY)
    day = dt.date(2026, 11, 26)
    p1 = ml.save_post(video, lesson, day, tmp_path)
    p2 = ml.save_post(video, lesson, day, tmp_path)
    assert p1.name == "2026-11-26-how-vector-databases-find-neighbours.md"
    assert p2.name.endswith("-2.md")
    text = p1.read_text()
    assert "tags: [vector-db, rag, search]" in text
    assert "youtube_id: dQw4w9WgXcQ" in text
    assert "https://www.youtube.com/watch?v=dQw4w9WgXcQ" in text
    assert ml.done_ids(tmp_path) == {"dQw4w9WgXcQ"}
