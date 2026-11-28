---
title: vLLM Serve
date: 2026-11-01
summary: A small, production-minded LLM serving stack.
tags: [vllm, serving]
---

## The problem

Loading a model in PyTorch and calling `generate()` works for one person, but under real traffic each request blocks the GPU, memory fragments and throughput collapses. I wanted the smallest service that serves an open model the way production systems do, behind an API that existing OpenAI clients can call unchanged.

## Architecture

```text
Client (OpenAI SDK, curl, Swagger UI)
   │  POST /v1/chat/completions  (streaming or not)
   ▼
FastAPI app ── request/response schemas compatible with OpenAI
   │
   ▼
vLLM engine ── PagedAttention + continuous batching on the GPU
   │
   ▼
Hugging Face model (e.g. Llama 3.1 8B Instruct)
```

## Why vLLM

- **PagedAttention** stores each request's key-value cache in small reusable pages instead of one large block, so the same GPU holds many more concurrent requests.
- **Continuous batching** adds new requests to the running batch as they arrive, so the GPU keeps doing useful work instead of waiting for the slowest request.

## Key design decisions

- **OpenAI-compatible API**, including server-sent-event streaming, so any OpenAI client works by changing only the base URL.
- **All settings from environment variables** (model, tensor-parallel size, GPU memory share, quantization, max length, dtype), so the same image runs any model.
- **Four small modules**: config, schemas, engine and app, which keeps the service easy to read and extend.
- **Docker image** that runs with `--gpus all`, plus FastAPI's interactive docs for trying requests in the browser.

## Stack

vLLM, FastAPI, Uvicorn, Pydantic, Docker and uv.
