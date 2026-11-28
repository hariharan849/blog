---
title: Multi-Agent Course Creator (A2A + MCP)
date: 2026-11-01
summary: How the distributed course-creation agents work together.
tags: [agents, a2a, mcp]
---

## The problem

Asking one LLM to "write me a course" gives confident but thin material with weak sources. A good course needs research, someone to check that research, a plan the learner agrees to, and only then the content. I built that as separate agent services that talk to each other over open protocols, so each one can use the framework and model that suits its job.

## Architecture

```text
Browser
  │
  ▼
FastAPI web app
  │
  ▼
Orchestrator (LangGraph workflow)
  ├── A2A ──▶ Researcher       ─┐
  ├── A2A ──▶ Judge            ─┼──▶ Source Intelligence (MCP server)
  └── A2A ──▶ Content Builder  ─┘     web search, page retrieval,
                                       citation checks
```

## How a course gets made

1. The **researcher** (a LangGraph workflow on an OpenAI model) gathers grounded research on the topic.
2. The **judge** (CrewAI) assesses the evidence and checks the citations. If the research is not good enough, the orchestrator sends it back for another round.
3. The orchestrator proposes a **learning path** and pauses until the learner approves it, using a LangGraph interrupt.
4. The **content builder** (Amazon Bedrock) writes the final course in Markdown from the approved research.

## Key design decisions

- **A2A for handoffs between agents.** Each specialist publishes an agent card and is called as a service, so agents can be built with different frameworks and deployed separately.
- **MCP for tools.** Web access lives in one Source Intelligence MCP server that all specialists share. It keeps live-web access separate from the workflow handoffs and gives a single place to apply least privilege.
- **Human in the loop.** The learner approves the plan before any content is written, which saves cost and keeps the course on target.
- **Validated contracts.** Data passed between agents is described with Pydantic models.

## Deployment

Locally, each specialist starts its own MCP process over stdio. In the cloud, the five services and the web app run on Google Cloud Run, and the shared MCP endpoint is protected by IAM so only the agent service identities can call it.

## Stack

LangGraph, CrewAI, A2A SDK, MCP (FastMCP), Tavily, Amazon Bedrock, OpenAI, FastAPI, Pydantic, Google ADK, Cloud Run and uv.
