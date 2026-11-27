---
title: "From demo agent to production system: durable pipelines, hybrid RAG and knowledge graphs"
date: 2026-11-28
summary: "What it takes to build an AI system you can leave running: harness engineering, durable execution and knowledge graphs, shown through a six-step build."
tags: [agents, durable-execution, rag, knowledge-graphs]
source_id: "web:https://www.theneuralmaze.com/p/one-free-course-to-learn-durable"
source_url: "https://www.theneuralmaze.com/p/one-free-course-to-learn-durable"
source_type: article
source_title: "One free course to learn Durable Agents, Knowledge Graphs and AI Evals"
source_author: "Miguel Otero Pedrido"
---

*Lesson from the article [One free course to learn Durable Agents, Knowledge Graphs and AI Evals](https://www.theneuralmaze.com/p/one-free-course-to-learn-durable) by Miguel Otero Pedrido.*

Most agents fall over the moment nobody is watching. A rate limit hits, a container restarts, a feed returns garbage, and the whole run is lost. Miguel Otero Pedrido's point is simple: building an agent is easy, but building a system you can leave running and trust is the hard part, and it is the part almost nobody teaches. To show what that takes, he and his collaborators built one in the open over six weeks: the Substack Brain, a living knowledge base made from the AI newsletters you mean to read but never get to. It pulls articles from RSS feeds, keeps itself up to date, works out who said what, and lets any agent search it and cite its sources.

## Three skills that separate a demo from production

The project is organised around three skills. The first is **harness engineering**: everything around the LLM call, such as retries, idempotency, and evaluations built from real failures rather than generic benchmarks. The second is **durable execution**: every step runs on Inngest, so when a run crashes it picks up from the step that failed instead of starting over. The third is **knowledge graphs**: claims are stored in Memgraph, so you can ask who said something and when, not just what was said.

The stack is Python, FastAPI, Postgres with pgvector, Inngest, Memgraph and MCP, and the finished Brain can be plugged into Claude Code, Cursor or Codex as a tool.

## Growing the system one hard problem at a time

The build starts deliberately small: one newsletter, five articles, one Postgres table. The first step is a durable RSS importer triggered over HTTP, where seven Inngest steps take a feed from raw XML to embedded chunks in pgvector. The instructive part is breaking it on purpose: kill the embedding step halfway, restart, and only that step reruns. The same stage compares sparse BM25 retrieval with dense vector retrieval on the same articles.

Five articles is a toy, so the second step backfills 100 to 300 of them. That is where rate limits and partial failures start to bite. Retrieval becomes hybrid, combining BM25 and dense vectors inside Postgres, and the Brain gives its first LLM answers with citations you can click and check.

A knowledge base that goes stale is just an archive, so the third step adds a cheap poller that checks every feed and pulls in only what changed. The Brain is then wrapped in an MCP server, so coding assistants can search your newsletters as if it were a built-in tool.

The fourth step tackles what vector search cannot do. Similar text is not the same as knowing that two authors disagree, or that someone changed their mind last month. An LLM extracts claims from every article into a temporal knowledge graph, each tied to who made it, when and where. Because extraction runs as durable steps, a failed article is retried on its own without reprocessing everything else.

The fifth step is error analysis on the Brain's real mistakes, such as wrong citations, missed articles and bad claims, which are turned into an evaluation suite so every future change is tested against failures that actually happened. The last step brings it together: a bounded research agent with clear limits that digs through the Brain to answer harder questions, a weekly digest of the newsletters you never got to, and a production deployment that keeps running without you.

## Key takeaways

- The hard part of agents is not the LLM call but the harness around it: retries, idempotency and evals.
- Durable execution lets a crashed pipeline resume from the failed step instead of starting over.
- Hybrid retrieval (BM25 plus dense vectors) and a temporal knowledge graph answer questions plain similarity search cannot, such as who said what and when.
- Build evaluations from your system's real errors, not generic benchmarks.
- Start tiny and add one hard problem at a time: one feed, then scale, freshness, structure, evals and deployment.
