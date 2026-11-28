---
title: Production-Grade RAG for Nuke
date: 2026-11-01
summary: How the Nuke documentation assistant is built.
tags: [rag, langgraph]
---

## The problem

Foundry Nuke's documentation is large, and artists usually need one precise answer: which node, which knob, which Python call. Plain keyword search misses questions phrased in different words, and a pure vector search misses exact names. I wanted an assistant that answers from the Nuke 17.0 docs, cites them, and can be run and watched like a real service rather than a notebook demo.

## Architecture

```text
Browser ── Next.js chat UI (CopilotKit sidebar / OpenAI-style chat)
              │
              ▼
FastAPI ── /hybrid-search   BM25 + kNN fused with Reciprocal Rank Fusion
        ── /ask, /stream    retrieve → local LLM (Ollama), with answer cache
        ── /ask-agentic     LangGraph agentic RAG workflow
              │
   ┌──────────┼──────────────┬─────────────┐
   ▼          ▼              ▼             ▼
Postgres   OpenSearch      Ollama        Redis
(vectors,  (fallback       (llama3.2)    (exact and
 pages,     backend)                      semantic cache)
 checkpoints)

Ingestion (pick one orchestrator: Airflow, Prefect or Dagster)
scrape → save to Postgres → chunk → embed (Jina v3, 1024-dim) → index
```

## Key design decisions

- **Hybrid retrieval by default.** Keyword (BM25) and vector results are merged with Reciprocal Rank Fusion, so exact node names and paraphrased questions both find the right page.
- **A swappable search backend.** Postgres vector search is the default and OpenSearch stays available as a rollback path, chosen with one setting.
- **Agentic RAG with checkpoints.** The `/ask-agentic` route runs a LangGraph workflow whose state is checkpointed in Postgres, so a conversation can resume and be inspected.
- **Caching with a safety valve.** Exact-match answers are cached in Redis. Semantic caching is opt-in, checks that Redis supports vector search at startup, and uses a scope version that is bumped after any change to prompts, chunking or search so stale answers never match.
- **Three orchestrators, one pipeline.** The same ingestion steps run under Airflow, Prefect or Dagster, which made it a fair side-by-side comparison of the three.

## Running it in production

Tracing goes to Langfuse, metrics and logs to Prometheus, Grafana and Loki, and answers are scored with a DeepEval harness using an LLM judge. The AWS deployment is described in Terraform, split into four layers.

## Stack

FastAPI, LangGraph, PostgreSQL vector search, OpenSearch, Ollama, Jina embeddings, Redis, Airflow / Prefect / Dagster, Next.js with CopilotKit, Langfuse, Prometheus, Grafana, Loki, DeepEval and Terraform.
