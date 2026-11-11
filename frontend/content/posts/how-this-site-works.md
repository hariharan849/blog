---
title: How this site works
date: 2026-11-11
summary: A Next.js portfolio with a serverless Daily Dose that collects GenAI writing from Medium, Substack and RSS every night.
tags: [nextjs, aws, serverless]
---

This site has two jobs: show what I build, and keep me up to date with the GenAI writing I follow.

## The portfolio

The site is a **Next.js** app. Blog posts like this one are plain Markdown files in the repository. Publishing means committing a file, so there's no CMS or database to look after.

## The Daily Dose

Every night at 2 AM a small serverless job wakes up and checks the authors I follow:

1. **EventBridge Scheduler** triggers an **AWS Lambda** function.
2. The function reads each author's Medium, Substack or RSS feed.
3. New posts are de-duplicated and saved to **DynamoDB**.
4. A digest email goes out through **Amazon SES**, and the site refreshes the [Daily Dose](/daily) page.

Adding a new author takes a few seconds from a small admin page behind GitHub sign-in. Paste a Medium username or Substack URL and the backend checks the feed before saving it.

```text
EventBridge (2 AM) → Lambda → RSS feeds → DynamoDB → SES email
                                             ↓
                         API Gateway → Next.js /daily
```

No AI summarisation here: the digest links straight to the original writers.
