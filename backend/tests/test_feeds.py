import pytest

from dailydose import feeds


@pytest.mark.parametrize(
    "kind,value,expected",
    [
        ("medium", "@janedoe", "https://medium.com/feed/@janedoe"),
        ("medium", "janedoe", "https://medium.com/feed/@janedoe"),
        ("medium", "https://medium.com/@janedoe/some-post-1", "https://medium.com/feed/@janedoe"),
        ("medium", "https://janedoe.medium.com", "https://medium.com/feed/@janedoe"),
        ("medium", "medium.com/towards-data-science", "https://medium.com/feed/towards-data-science"),
        ("substack", "simonw", "https://simonw.substack.com/feed"),
        ("substack", "https://simonw.substack.com/p/some-post", "https://simonw.substack.com/feed"),
        ("substack", "https://www.latent.space", "https://www.latent.space/feed"),
        ("rss", "huggingface.co/blog/feed.xml", "https://huggingface.co/blog/feed.xml"),
    ],
)
def test_resolve(kind, value, expected):
    assert feeds.resolve_feed_url(kind, value) == expected


@pytest.mark.parametrize("kind,value", [("medium", ""), ("nope", "x"), ("rss", "ftp://x.com/feed")])
def test_resolve_rejects(kind, value):
    with pytest.raises(feeds.SourceError):
        feeds.resolve_feed_url(kind, value)


def test_parse_medium(fixture_bytes):
    feed = feeds.parse(fixture_bytes("medium.xml"))
    assert feed.title == "Stories by Jane Doe on Medium"
    first = feed.entries[0]
    assert first.url == "https://medium.com/@janedoe/agents-that-ship-123abc"  # tracking stripped
    assert first.author == "Jane Doe"
    assert first.excerpt == "Most agent demos never reach production. Here's what changes when they do."
    assert first.image == "https://cdn-images.medium.com/max/1024/a.png"
    assert first.published_at.isoformat() == "2026-11-10T18:30:00+00:00"


def test_parse_atom(fixture_bytes):
    feed = feeds.parse(fixture_bytes("atom.xml"))
    assert feed.title == "Example AI Lab Blog"
    assert feed.entries[0].url == "https://lab.example.com/posts/long-context"
    assert feed.entries[0].author == "Example Lab"


def test_parse_rejects_html():
    with pytest.raises(feeds.SourceError):
        feeds.parse(b"<html><body>not a feed</body></html>")


def test_parse_rejects_entity_bomb():
    bomb = b'<?xml version="1.0"?><!DOCTYPE x [<!ENTITY a "aaaa"><!ENTITY b "&a;&a;">]><rss><channel><title>&b;</title></channel></rss>'
    with pytest.raises(Exception):
        feeds.parse(bomb)


def test_clean_text_truncates_on_word():
    assert feeds.clean_text("<p>one two three four</p>", limit=10) == "one two…"
