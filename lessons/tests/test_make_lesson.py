import datetime as dt
import io
import json
import sys
import tarfile
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import connectors as c  # noqa: E402
import make_lesson as ml  # noqa: E402
from dailydose import feeds  # noqa: E402

FIXTURES = Path(__file__).parent / "fixtures"
DAY = dt.date(2026, 11, 27)

REPLY = """TITLE: How Vector Databases Find Neighbours
SUMMARY: Why approximate search is fast and when it is good enough.
TAGS: Vector DB, RAG , search
---
Vector databases store embeddings.

## Key takeaways
- Approximate is usually fine."""


def video(vid="dQw4w9WgXcQ", title='A "quoted" title'):
    return c.Item(f"youtube:{vid}", "video", f"https://www.youtube.com/watch?v={vid}", title, "Chan", video_id=vid)


# ---------------------------------------------------------------- parsing & posts


@pytest.mark.parametrize(
    "value",
    [
        "dQw4w9WgXcQ",
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLabc&index=3",
        "https://youtu.be/dQw4w9WgXcQ?si=abc",
        "https://m.youtube.com/shorts/dQw4w9WgXcQ",
        "https://www.youtube.com/embed/dQw4w9WgXcQ",
    ],
)
def test_video_id(value):
    assert c.video_id(value) == "dQw4w9WgXcQ"


def test_video_id_rejects_other_links():
    assert c.video_id("https://example.com/watch?v=dQw4w9WgXcQ") is None
    assert c.video_id("https://www.youtube.com/playlist?list=PLabc") is None


def test_video_in_playlist_link_means_one_video(monkeypatch):
    monkeypatch.setattr(c, "_oembed", lambda vid: ("Talk", "Chan"))
    items = c.youtube_items("https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLabc")
    assert [i.key for i in items] == ["youtube:dQw4w9WgXcQ"]


def test_parse_lesson():
    lesson = ml.parse_lesson(REPLY)
    assert lesson.title == "How Vector Databases Find Neighbours"
    assert lesson.tags == ["vector-db", "rag", "search"]
    assert lesson.body.startswith("Vector databases")


def test_parse_lesson_needs_separator():
    with pytest.raises(ValueError):
        ml.parse_lesson("TITLE: x\nno body")


def test_save_post_and_done_ids(tmp_path):
    lesson = ml.parse_lesson(REPLY)
    p1 = ml.save_post(video(), lesson, DAY, tmp_path)
    p2 = ml.save_post(video(), lesson, DAY, tmp_path)
    assert p1.name == "2026-11-27-how-vector-databases-find-neighbours.md"
    assert p2.name.endswith("-2.md")
    text = p1.read_text()
    assert "tags: [vector-db, rag, search]" in text
    assert 'source_id: "youtube:dQw4w9WgXcQ"' in text
    assert "youtube_id: dQw4w9WgXcQ" in text
    assert "*Lesson from the video [A \"quoted\" title](https://www.youtube.com/watch?v=dQw4w9WgXcQ) by Chan.*" in text
    assert ml.done_ids(tmp_path) == {"youtube:dQw4w9WgXcQ"}


def test_done_ids_reads_older_lessons(tmp_path):
    (tmp_path / "old.md").write_text("---\ntitle: x\nyoutube_id: abcdefghijk\n---\nbody")
    assert ml.done_ids(tmp_path) == {"youtube:abcdefghijk"}


def test_repo_prompt_is_architecture_only():
    item = c.Item("github:o/r", "repo", "https://github.com/o/r", "o/r", repo="o/r")
    system, user = ml.prompt_for(item, "SNAPSHOT")
    assert "architecture" in system and "<repository_snapshot>" in user
    system, user = ml.prompt_for(video(), "words")
    assert system == ml.SYSTEM and "<transcript>" in user


# ---------------------------------------------------------------- new items & dedup


@pytest.fixture
def feed(monkeypatch):
    data = (FIXTURES / "substack.xml").read_bytes()
    monkeypatch.setattr(feeds, "fetch", lambda url, timeout=15: data)


def fake_writer(item, text):
    return ml.Lesson(title=f"Lesson on {item.title}", summary="s", tags=["t"], body=text[:200])


def run(sources, state, tmp_path, extractor=None, limit=3, dry_run=False):
    return ml.run(
        sources, state, limit=limit, date=DAY, posts_dir=tmp_path, dry_run=dry_run,
        writer=fake_writer, extractor=extractor or c.extract,
    )


def test_new_feed_source_only_picks_up_posts_after_it_was_added(feed, tmp_path, monkeypatch):
    sources = [{"type": "substack", "url": "notes"}]
    state = ml.load_state(tmp_path / "state.json")
    assert run(sources, state, tmp_path) == []  # first run: existing posts become the baseline
    assert {k for k, v in state["items"].items() if v["status"] == "baseline"} == {
        "web:https://notes.substack.com/p/old-post",
        "web:https://notes.substack.com/p/queues",
    }

    # A new post appears in the feed.
    xml = (FIXTURES / "substack.xml").read_text().replace(
        "<item>", "<item><title>Brand new</title><link>https://notes.substack.com/p/new</link>"
        "<pubDate>Sat, 28 Nov 2026 08:00:00 GMT</pubDate><content:encoded><![CDATA[<p>"
        + "word " * 200 + "</p>]]></content:encoded></item><item>", 1)
    monkeypatch.setattr(feeds, "fetch", lambda url, timeout=15: xml.encode())
    [path] = run(sources, state, tmp_path)
    assert 'source_id: "web:https://notes.substack.com/p/new"' in path.read_text()
    assert "*Lesson from the article [Brand new](https://notes.substack.com/p/new) by Engineering Notes.*" in path.read_text()

    # Running again writes nothing: it's already published.
    assert run(sources, state, tmp_path) == []


def test_backfill_source_and_limit(feed, tmp_path, monkeypatch):
    monkeypatch.setattr(c, "MIN_ARTICLE_WORDS", 1)
    sources = [{"type": "substack", "url": "notes", "backfill": True}]
    state = ml.load_state(tmp_path / "s.json")
    [first] = run(sources, state, tmp_path, limit=1)
    assert "Old post" in first.read_text()  # oldest first
    [second] = run(sources, state, tmp_path, limit=1)
    text = second.read_text()
    assert "Queues in practice" in text and "QUEUE_BODY" in text and "alert(1)" not in text
    assert run(sources, state, tmp_path) == []


def test_same_item_in_two_sources_is_written_once(tmp_path, monkeypatch):
    monkeypatch.setattr(c, "_oembed", lambda vid: ("Talk", "Chan"))
    sources = [
        {"type": "youtube", "url": "https://youtu.be/dQw4w9WgXcQ"},
        {"type": "youtube", "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"},
    ]
    paths = run(sources, ml.load_state(tmp_path / "s.json"), tmp_path, extractor=lambda item: "transcript words")
    assert len(paths) == 1


def test_failures_retry_then_give_up(tmp_path, monkeypatch):
    monkeypatch.setattr(c, "_oembed", lambda vid: ("Talk", "Chan"))
    sources = [{"type": "youtube", "url": "https://youtu.be/dQw4w9WgXcQ"}]
    state = ml.load_state(tmp_path / "s.json")

    def blocked(item):
        raise c.ExtractError("YouTube refused the transcript")

    for attempt in range(1, ml.MAX_ATTEMPTS + 1):
        assert run(sources, state, tmp_path, extractor=blocked) == []
        assert state["items"]["youtube:dQw4w9WgXcQ"]["attempts"] == attempt
    assert state["items"]["youtube:dQw4w9WgXcQ"]["status"] == "skipped"
    assert run(sources, state, tmp_path, extractor=lambda i: "now it works") == []  # given up


def test_permanent_failure_skips_at_once(tmp_path, monkeypatch):
    monkeypatch.setattr(c, "_oembed", lambda vid: ("Talk", "Chan"))
    state = ml.load_state(tmp_path / "s.json")

    def no_captions(item):
        raise c.ExtractError("no captions", permanent=True)

    run([{"type": "youtube", "url": "dQw4w9WgXcQ"}], state, tmp_path, extractor=no_captions)
    assert state["items"]["youtube:dQw4w9WgXcQ"]["status"] == "skipped"


def test_dry_run_writes_nothing(feed, tmp_path, capsys):
    sources = [{"type": "substack", "url": "notes", "backfill": True}]
    assert run(sources, ml.load_state(tmp_path / "s.json"), tmp_path, dry_run=True) == []
    assert "new: web:https://notes.substack.com/p/queues" in capsys.readouterr().out
    assert list(tmp_path.glob("*.md")) == []


def test_load_sources(tmp_path):
    f = tmp_path / "sources.yml"
    f.write_text("settings:\n  max_per_run: 2\nsources:\n  - type: YouTube\n    url: ' dQw4w9WgXcQ '\n")
    sources, settings = ml.load_sources(f)
    assert sources == [{"type": "youtube", "url": "dQw4w9WgXcQ"}] and settings["max_per_run"] == 2
    f.write_text("sources:\n  - type: youtube\n")
    with pytest.raises(ValueError):
        ml.load_sources(f)


def test_repo_default_sources_file_is_valid():
    sources, settings = ml.load_sources()
    assert int(settings["max_per_run"]) >= 1
    assert all(s["type"] in ("youtube", "substack", "medium", "rss", "github") for s in sources)


@pytest.mark.parametrize(
    "url,expected",
    [
        ("https://youtu.be/dQw4w9WgXcQ", "youtube"),
        ("https://github.com/o/r", "github"),
        ("@someone", "medium"),
        ("https://x.substack.com", "substack"),
        ("https://blog.example.com/feed.xml", "rss"),
    ],
)
def test_guess_type(url, expected):
    assert ml.guess_type(url) == expected


def test_backfill_defaults():
    assert ml.backfills({"type": "youtube", "url": "https://www.youtube.com/playlist?list=PL1"})
    assert not ml.backfills({"type": "youtube", "url": "https://www.youtube.com/@chan"})
    assert not ml.backfills({"type": "github", "url": "https://github.com/someone"})
    assert ml.backfills({"type": "github", "url": "https://github.com/someone/repo"})
    assert not ml.backfills({"type": "medium", "url": "@a"})


# ---------------------------------------------------------------- GitHub


def tarball(files):
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        for name, body in files.items():
            data = body if isinstance(body, bytes) else body.encode()
            info = tarfile.TarInfo(f"owner-repo-abc123/{name}")
            info.size = len(data)
            tar.addfile(info, io.BytesIO(data))
    return buf.getvalue()


def test_github_user_lists_own_new_repos(monkeypatch):
    repos = [
        {"full_name": "me/new", "html_url": "https://github.com/me/new", "created_at": "2026-11-20", "owner": {"login": "me"}},
        {"full_name": "me/fork", "html_url": "x", "created_at": "2026-11-21", "fork": True},
        {"full_name": "me/old", "html_url": "https://github.com/me/old", "created_at": "2025-01-01", "owner": {"login": "me"}},
    ]
    monkeypatch.setattr(c, "_gh", lambda path, raw=False: repos)
    assert [i.key for i in c.github_items("https://github.com/me")] == ["github:me/old", "github:me/new"]


def test_repo_snapshot_prioritises_manifests_and_skips_noise(monkeypatch):
    files = {
        "README.md": "# Repo",
        "package.json": "{}",
        "src/server.ts": "export const server = 1",
        "src/deep/a/b/util.ts": "x",
        "node_modules/lib/index.js": "SHOULD_NOT_APPEAR",
        "assets/logo.png": b"\x89PNG\x00\x00",
        "package-lock.json": "LOCK",
        "tests/test_x.py": "def test(): pass",
    }

    def gh(path, raw=False):
        return tarball(files) if raw else {"description": "A demo"}

    monkeypatch.setattr(c, "_gh", gh)
    snap = c.repo_snapshot("owner/repo")
    assert "Description: A demo" in snap
    assert "SHOULD_NOT_APPEAR" not in snap and "LOCK" not in snap and "logo.png" not in snap
    order = [snap.index(f'<file path="{p}">') for p in ("README.md", "package.json", "src/server.ts", "src/deep/a/b/util.ts", "tests/test_x.py")]
    assert order == sorted(order)


def test_snapshot_respects_budget():
    files = {f"src/f{i}.py": "x" * 1000 for i in range(50)}
    snap = c.build_snapshot(files, "o/r", budget=10_000)
    assert len(snap) < 12_000 and "more files left out" in snap


# ---------------------------------------------------------------- announce


def test_announce_parse(tmp_path):
    import announce

    lesson = ml.Lesson(
        title='Vectors: a "fast" intro',
        summary="Why ANN works.",
        tags=["rag"],
        body="## Start\n\nVector databases store **embeddings** from [models](https://x.y).\n\nMore.",
    )
    path = ml.save_post(video(), lesson, DAY, tmp_path)
    assert announce.parse(path) == {
        "slug": "2026-11-27-vectors-a-fast-intro",
        "title": 'Vectors: a "fast" intro',
        "summary": "Why ANN works.",
        "snippet": "Vector databases store embeddings from models.",
    }


def test_announce_snippet_is_shortened():
    import announce

    long = " ".join(f"w{i}" for i in range(100))
    assert announce.snippet(long).endswith("w69…")


def test_announce_skips_without_backend(monkeypatch, capsys):
    import announce

    monkeypatch.delenv("FEED_API_URL", raising=False)
    assert announce.main(["does-not-exist.md"]) == 0
    assert "not emailing" in capsys.readouterr().out
