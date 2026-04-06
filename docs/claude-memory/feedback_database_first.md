---
name: Database First — Persist Raw Data From Day One
description: Architecture lesson — set up persistent storage before building pipeline, not after. Avoids costly rework when you need historical data later.
type: feedback
---

Set up a database (or persistent store) BEFORE building the content pipeline, not after 20+ sessions of work.

**Why:** The Living Intelligence platform fetched ~300 source articles via Jina Reader across sessions 1-13. Every one was used once for structuring, then discarded. When the v2 pipeline needed multi-source research and institutional memory (sessions 14-19), we had to re-fetch everything — 264 URLs, all over again. The entire v2 retrofit (6 sessions of re-processing all 43 entries) could have been avoided if raw sources had been stored from the start.

**How to apply:** For any new vertical or intelligence product:
1. Create the database in session 1 (even a simple sources table with url + content_md)
2. Every Jina fetch, every API response, every raw document → store it immediately
3. Build the pipeline to read FROM the database, not from ephemeral in-memory data
4. Storage is $25/month. Six sessions of rework is weeks of effort. The math is obvious.

**Concrete cost of not doing this:**
- Sessions 14-19 (v2 retrofit): ~30 hours of work that was primarily re-fetching and re-processing content we already had
- 609K words of source material fetched twice
- Every landscape profile researched twice (v1 flat files, then v2 with proper sources)
