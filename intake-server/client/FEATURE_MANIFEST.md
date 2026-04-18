# Editorial Studio — Feature Manifest

**Purpose:** This file lists every feature the Editorial Studio must have. Check this before ANY UI deploy to prevent silent regressions. If a feature listed here is missing from the deployed UI, it's a bug.

**Last updated:** 2026-04-17 (session 42)

---

## CORE EDITORIAL WORKFLOW

### Inbox Tab
- [ ] V2 brief cards with: headline, company, type badge, score, fabrication verdict, McKinsey checks, source count
- [ ] "The So What" pull-out per card
- [ ] Key stat display per card
- [ ] Summary text per card
- [ ] Sources list with primary badge
- [ ] Expandable detail sections: McKinsey checks, Research brief, Fabrication report, Iteration history
- [ ] Approve & Publish action (triggers publish + git push)
- [ ] Re-research action (sends back through pipeline)
- [ ] Reject action with reason selection + optional notes
- [ ] Manual URL processing panel ("+ Process URL" toggle)
- [ ] SSE streaming log for URL processing
- [ ] Entry count display
- [ ] Auto-refresh every 30 seconds
- [ ] Empty state with pipeline schedule info

### Held Tab
- [ ] Held brief cards with: large score, hold reason badges, age indicator
- [ ] Company name, headline, the_so_what
- [ ] Fabrication issues display (up to 3)
- [ ] Source link
- [ ] Retry action
- [ ] Reject action
- [ ] Entry count display
- [ ] Auto-refresh every 60 seconds
- [ ] Empty state

### History Tab
- [ ] Decision list grouped by date (Today/Yesterday/date)
- [ ] Filter pills: All, Approved, Rejected, Held, Retried, Produced, Duplicate
- [ ] Stats bar with counts per decision type (clickable)
- [ ] Expandable decision rows: badge, headline, score, time
- [ ] Expanded view: reason, notes, decided_by, evaluator score, capability, entry type
- [ ] Entry snapshot (headline + the_so_what) when available
- [ ] Auto-refresh every 60 seconds

---

## PIPELINE OPERATIONS

### Pipeline Tab
- [ ] Pipeline stage visualization (Discovery → Triage → Dedup → Research → Produce → Review)
- [ ] Daily schedule display (5:00 AM Railway, 5:27 AM Remote Trigger)
- [ ] Last run stats: Found, Queued, Blocked, Errors (color-coded)
- [ ] Run Pipeline button with SSE streaming log
- [ ] Run History table: Date, Found, Queued, Blocked, Errors
- [ ] Latest run highlighted
- [ ] Auto-refresh every 60 seconds

### Blocked URLs (sub-section of Pipeline) — ⚠️ TODO: NO UI IMPLEMENTED
- [ ] Blocked URL list with: title, source domain, blocked date, reason — **SERVER ROUTES EXIST (`/api/blocked`, `/api/blocked/unblock`) BUT NO UI COMPONENT**
- [ ] Search/filter blocked URLs
- [ ] Near-miss badge (score 35-44)
- [ ] Fabrication badge
- [ ] Unblock + reprocess action per URL
- [ ] Blocked count display

---

## CONTENT TOOLS

### Thought Leadership Tab
- [ ] Discover TL button (triggers TL discovery)
- [ ] Candidates list: title, source domain badge, publication date, snippet
- [ ] Publish action per candidate (SSE streaming)
- [ ] Dismiss action per candidate
- [ ] Published TL list: title, author/org, date
- [ ] Candidate + published counts
- [ ] SSE streaming log for publish flow
- [ ] Empty state

### Landscape Tab
- [ ] Run Sweep button (triggers landscape sweep, SSE streaming)
- [ ] Maturity suggestions: company, capability, suggested maturity, reason
- [ ] Apply action per suggestion (updates competitor JSON + git push)
- [ ] Dismiss action per suggestion
- [ ] Stale entries list: company, capability, current maturity, last assessed date
- [ ] Maturity color coding (scaled/deployed/piloting/announced/no_activity)
- [ ] Suggestion + stale counts
- [ ] SSE streaming log for sweep
- [ ] Empty state

### Audit Tab
- [ ] Mode toggle: Fast / Deep
- [ ] Run Audit button (SSE streaming)
- [ ] Live log display
- [ ] Summary pills: Clean count, Warnings count, Errors count
- [ ] Issues list by severity with field name + description
- [ ] Entry count checked
- [ ] Empty state + success state

---

## GLOBAL UI

### Header
- [ ] Two-tier header matching portal (masthead + nav bar)
- [ ] Tab navigation with badge counts (Inbox, Held)
- [ ] Process indicator (pulsing dot when background operation running)
- [ ] All tabs accessible

### Shared Patterns
- [ ] SSE streaming for long operations (approve, pipeline, publish, sweep, audit)
- [ ] Query invalidation after mutations
- [ ] Color-coded status indicators (green/orange/red/gray)
- [ ] Auto-refresh intervals per data type
- [ ] Error boundary (crash recovery)
- [ ] Empty states for all lists

---

## API DEPENDENCIES

Every API endpoint the UI depends on. If any of these break, features break.

| Endpoint | Used by | Method |
|----------|---------|--------|
| `/api/v2/inbox` | Inbox, Header badge | GET |
| `/api/v2/held` | Held, Header badge | GET |
| `/api/v2/history` | History | GET |
| `/api/v2/decide/:briefId` | Inbox, Held | POST |
| `/api/pipeline-status` | Pipeline | GET |
| `/api/pipeline-history` | Pipeline | GET |
| `/api/run-pipeline` | Pipeline | POST (SSE) |
| `/api/process-url` | Inbox | POST (SSE) |
| `/api/blocked` | Pipeline/Blocked | GET |
| `/api/blocked/unblock` | Pipeline/Blocked | POST |
| `/api/tl-discover` | TL | POST |
| `/api/tl-candidates` | TL | GET |
| `/api/tl-published` | TL | GET |
| `/api/tl-publish` | TL | POST (SSE) |
| `/api/tl-candidates/dismiss` | TL | POST |
| `/api/landscape-suggestions` | Landscape | GET |
| `/api/landscape-stale` | Landscape | GET |
| `/api/landscape-sweep` | Landscape | POST (SSE) |
| `/api/landscape-suggestions/:id/apply` | Landscape | POST |
| `/api/landscape-suggestions/:id/dismiss` | Landscape | POST |
| `/api/audit/report` | Audit | GET |
| `/api/audit` | Audit | GET (SSE) |
| `/api/audit/deep` | Audit | GET (SSE) |
