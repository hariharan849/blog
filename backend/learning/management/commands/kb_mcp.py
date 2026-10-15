from typing import Literal

from django.core.management.base import BaseCommand
from mcp.server.mcpserver import MCPServer
from mcp.types import ToolAnnotations

from learning import mcp_tools

Scope = Literal["posts", "newsletters", "all"]

INSTRUCTIONS = (
    "PyChanter knowledge base: the PyChanter blog's posts plus the owner's newsletter library "
    "(Substack, Medium, Towards AI, ...). Use kb_search to find passages and kb_ask for an answer "
    "with numbered citations. Cite the returned URLs when you use a passage."
)


def build_server():
    server = MCPServer("pychanter-kb", instructions=INSTRUCTIONS)

    @server.tool(annotations=ToolAnnotations(readOnlyHint=True, openWorldHint=False))
    def kb_search(query: str, scope: Scope = "all", limit: int = 8) -> list[dict]:
        """Hybrid (keyword + semantic) search over blog posts and newsletter passages.

        Returns passages best first, each with title, url, heading, text and source.
        """
        return mcp_tools.search(query, scope=scope, limit=min(max(limit, 1), 25))

    @server.tool(annotations=ToolAnnotations(readOnlyHint=True, openWorldHint=False))
    def kb_ask(question: str, scope: Scope = "all") -> dict:
        """Answer a question from the knowledge base with [n] citations to the returned sources.

        Without an Anthropic API key on the server, returns only the most relevant passages.
        """
        return mcp_tools.answer(question, scope=scope)

    @server.tool(annotations=ToolAnnotations(readOnlyHint=False, idempotentHint=True, openWorldHint=True))
    def kb_add_source(url: str) -> dict:
        """Follow a Substack, Medium (@user, publication or tag), Towards AI or RSS URL and fetch it."""
        return mcp_tools.add_feed(url)

    @server.tool(annotations=ToolAnnotations(readOnlyHint=False, idempotentHint=True, openWorldHint=True))
    def kb_sync() -> dict:
        """Poll all followed feeds now and index/enrich anything new or edited."""
        return mcp_tools.sync()

    return server


class Command(BaseCommand):
    help = "Run the knowledge-base MCP server over stdio (for Claude Code, Claude Desktop, Cursor, ...)."

    def handle(self, *args, **options):
        build_server().run("stdio")
