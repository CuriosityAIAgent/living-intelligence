# Known Issues & Technical Debt
**Definitive Reference — April 17, 2026 | Verified against codebase**

---

## CRITICAL — Fix Before Go-Live

### 1. Remote Trigger Prompt — Cannot Verify Current State
- **What:** The Remote Trigger prompt is stored in Anthropic's Managed Agents dashboard, NOT in this repo
- **Risk:** Session 38 discovered the mandatory eval+refinement loop was MISSING from the prompt because it was written from memory instead of translated from `content-producer.js`
- **Impact:** Without the iteration loop, Phase 2 produces v1-quality entries (no refinement, no re-evaluation) — defeats the entire purpose of v2
- **Action:** Open `claude.ai` → Scheduled Agents → verify the trigger prompt contains ALL steps: fetch briefs → hydrate sources → write v1 → fabrication v1 → evaluate v1 → IF NEEDS_WORK refine to v2 → fabrication v2 → score → store
- **Rule:** Before ANY future trigger prompt update: read `content-producer.js` first, translate step-by-step. NEVER write from memory.
- **Source:** `feedback_trigger_prompt.md`

### 2. Railway Dual-Instance Ghost Process
- **What:** Railway `proud-reflection` was running TWO processes — old v1 + new v2. Both fired the 5am cron.
- **Fix Applied (session 41):** All v1 code removed from server.js. Pushed to intake.
- **Remaining:** Railway service needs restart to kill orphan v1 process
- **Verify:** Check `pipeline_runs` in Supabase after next 5am — should see exactly ONE run, not two
- **Source:** `project_v1_ghost_pipeline.md`

### 3. Supabase UNIQUE Constraint Not Yet Run
- **SQL:** `ALTER TABLE research_briefs ADD CONSTRAINT research_briefs_candidate_url_unique UNIQUE (candidate_url);`
- **Impact:** Without this, same URL could create duplicate briefs in Supabase
- **Action:** Run in Supabase SQL Editor

---

## MEDIUM — Should Fix Soon

### 4. Blocked URLs Panel — No UI
- **What:** Server routes `/api/blocked` and `/api/blocked/unblock` exist and work. No UI component in Editorial Studio.
- **Impact:** Cannot view or manage blocked URLs from the UI. Must use direct API calls.
- **Where:** Pipeline Tab should have a Blocked URLs sub-section
- **Effort:** Small — wire existing API into a simple list component
- **Source:** FEATURE_MANIFEST.md (marked TODO)

### 5. Auditor Hardcoded Reference Date
- **What:** `auditor.js` line 18: `const TODAY = new Date('2026-03-19')`
- **Impact:** Freshness checks use March 19 as reference, not actual current date. All entries >90 days from March 19 get flagged incorrectly.
- **Fix:** Change to `const TODAY = new Date()`

### 6. Race Condition on `/api/v2/store-produced`
- **What:** No check if brief is already in `produced` or `held` status before overwriting
- **Impact:** If Remote Trigger retries or is called twice, second call overwrites first entry
- **Fix:** Check brief status before update, reject if already produced/held

### 7. Scorer Tier Inconsistency
- **What:** `scorer.js` — weak newsroom patterns (/news/, /blog/) score 20 points, but Tier 2 industry press scores only 17
- **Impact:** A company blog post outscores ThinkAdvisor or RIABiz
- **Fix:** Adjust weak newsroom to 15 or Tier 2 to 20

### 8. `/api/blocked/unblock` Fires Async Without Feedback
- **What:** Returns `{ ok: true }` immediately, research runs in background with fire-and-forget
- **Impact:** If research fails silently, user never knows
- **Fix:** Either await research and return result, or queue it with status tracking

### 9. 14 Agent Files Create `new Anthropic()`
- **What:** These files burn API credits when called: auditor, context-enricher, evaluator-agent, fabrication-strict, governance (dead), intake (dead), landscape-evaluator-agent, landscape-sweep, landscape-trigger, landscape-writer-agent, research-agent, tl-publisher, writer-agent
- **Impact:** Expected for Phase 1 (Railway). But legacy agents that are no longer imported could still be called if someone runs them directly from CLI.
- **Note:** Phase 2 via Remote Trigger uses Max tokens ($0). Only Phase 1 + on-demand tools burn credits.

---

## LOW — Technical Debt

### 10. Dead Code Files
Delete these — they are not imported anywhere in the active pipeline:

**Editorial Studio:**
- `intake-server/client/src/components/V2Card.tsx` — replaced by ArticleCard.tsx
- `intake-server/client/src/components/StoryCard.tsx` — legacy v1 card
- `intake-server/client/src/components/ActivityLog.tsx` — never wired
- v1 API functions in `api.ts`: `fetchInbox`, `fetchArchive`, `rejectItem`, `approveUrl`, `fetchActivityLog`

**Agents:**
- `agents/discovery.js` — RSS feed parser, replaced by auto-discover.js
- `agents/format-validator.js` — schema validation, never wired
- `agents/landscape-producer.js` — replaced by landscape-trigger.js
- `agents/landscape-writer-agent.js` — replaced by inline logic
- `agents/landscape-research-agent.js` — replaced by landscape-sweep.js
- `agents/landscape-evaluator-agent.js` — replaced by inline logic
- `agents/intake.js` — legacy structuring (utility functions still used by tests)
- `agents/governance.js` — legacy verification (only used by tests)

### 11. Missing Process Indicator in Audit Tab
- **What:** Audit tab doesn't call `useProcessTracker`, so running an audit doesn't show the pulsing dot in the header when viewing other tabs
- **Fix:** Add `startProcess('audit', ...)` and `stopProcess('audit')` calls

### 12. `/audit` Skill Needs V2 Update
- **What:** Skill covers v1 pipeline checks but misses v2-specific audits
- **Missing:** Research brief status (ready/produced/held), editorial decisions table, KB health (source embeddings, brief count), Phase 2 completion status
- **Fix:** Add v2 audit steps referencing `/api/v2/kb/stats` and Supabase queries

### 13. Entity Extraction Fallback
- **What:** `research-agent.js` — if Claude entity extraction fails, `entities` is null. Downstream code may assume it exists.
- **Fix:** Add null checks in all downstream consumers

### 14. Domain Authority Cache Not Persistent
- **What:** `scorer.js` `domainAuthorityCache` is a local Map, rebuilt every execution
- **Impact:** One DataForSEO API call per unique domain per pipeline run (~45 calls/day)
- **Fix:** Persist cache to file or Supabase with TTL

### 15. TL Voice Preservation — Unclear
- **What:** Pipeline plan says "Writer Agent must preserve author's voice for TL entries" but unclear if writer-agent has a TL mode
- **Impact:** TL entries may bypass writer-agent entirely (just structured, not refined) or lose author voice
- **Verify:** Read `tl-publisher.js` to confirm whether it calls writer-agent or publishes as-is

### 16. Empty Research Distribution File
- **What:** `memory/research_distribution.md` is 0 bytes — placeholder created but never filled
- **Fix:** Either write content or delete the file and remove from MEMORY.md index
