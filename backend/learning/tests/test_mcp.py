import asyncio
from unittest import mock

from django.test import TestCase, TransactionTestCase

from learning import mcp_tools, tasks
from learning.kb.indexing import index_article
from learning.management.commands.kb_mcp import build_server
from learning.models import Source

from .helpers import fake_parse
from .test_kb import newsletter
from .test_pipeline import SUBSTACK


class MCPToolTests(TestCase):
    def setUp(self):
        source = Source.objects.create(name="Agentic", feed_url="https://agentic.test/feed")
        index_article(newsletter(source, "Agent memory", "<p>Agents store memories with vector retrieval.</p>"))

    def test_search_and_ask_include_newsletters(self):
        hits = mcp_tools.search("vector retrieval")
        self.assertEqual(hits[0]["kind"], "newsletter")
        with mock.patch.object(mcp_tools, "get_client", return_value=None):
            result = mcp_tools.answer("How do agents store memories?")
        self.assertEqual(result["mode"], "passages")
        self.assertEqual(result["sources"][0]["title"], "Agent memory")

    def test_add_feed_queues_a_fetch(self):
        with fake_parse({SUBSTACK: "substack.xml"}), mock.patch.object(tasks, "get_client", return_value=None):
            result = mcp_tools.add_feed("https://agentic.substack.com")
        self.assertTrue(result["created"])
        self.assertEqual(result["source"]["feed_url"], SUBSTACK)
        self.assertEqual(result["fetch"]["state"], "SUCCESS")  # eager in tests: ran inline
        self.assertEqual(result["fetch"]["result"]["changed"], 1)

    def test_sync_reports_the_task(self):
        with fake_parse({"https://agentic.test/feed": "substack.xml"}), mock.patch.object(tasks, "get_client", return_value=None):
            info = mcp_tools.sync()
        self.assertEqual((info["state"], info["result"]), ("SUCCESS", 1))


class MCPServerTests(TransactionTestCase):
    """Calls the registered tools through the MCP server (tools run in a worker thread)."""

    def test_tools_are_registered_with_schemas(self):
        server = build_server()
        tools = {tool.name: tool for tool in asyncio.run(server.list_tools())}
        self.assertEqual(set(tools), {"kb_search", "kb_ask", "kb_add_source", "kb_sync"})
        self.assertTrue(tools["kb_search"].annotations.read_only_hint)
        self.assertEqual(tools["kb_search"].input_schema["properties"]["scope"]["enum"], ["posts", "newsletters", "all"])

    def test_call_kb_search(self):
        source = Source.objects.create(name="Agentic", feed_url="https://agentic.test/feed")
        index_article(newsletter(source, "Agent memory", "<p>Agents store memories with vector retrieval.</p>"))
        result = asyncio.run(build_server().call_tool("kb_search", {"query": "memories", "limit": 3}))
        self.assertIn("Agent memory", str(result))
