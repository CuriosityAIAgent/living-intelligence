# Editorial Studio — Definitive Reference
**April 17, 2026 | v5 Complete (Sessions 43-44)**

---

## Overview

React (Vite + TypeScript + Tailwind v4) application at `intake-server/client/`. Builds to `intake-server/public/`. Served by Express server on port 3003.

7 tabs with visual separator: Editorial (Inbox | Pipeline | Held | History) | Tools (TL | Landscape | Audit)

---

## Tab Status — Verified Against Code

### Inbox Tab — FULLY WORKING
- V2 brief cards via ArticleCard.tsx (2-column grid: content + 280px sidebar)
- Headline, company, type badge, score (56px sidebar), fabrication verdict
- "Why It Matters" pull-out (17px italic, claret left border)
- Key stat (44px, claret), summary text, sources with primary badge
- Expandable: McKinsey checks, Research brief, Fabrication report, Iteration history
- Approve & Publish (SSE streaming + git push)
- Re-research (sends back through pipeline)
- Reject with reason selection + optional notes
- Manual URL processing panel ("+ Process URL" toggle, SSE streaming)
- Auto-refresh every 30 seconds

### Pipeline Tab — WORKING (BLOCKED URLS UI MISSING)
- Daily schedule display (5:00 AM Railway, 5:27 AM Remote Trigger)
- Last run stats: Found, Queued, Blocked, Errors (color-coded)
- Run Pipeline button with SSE streaming log
- Run History table with latest run highlighted
- Auto-refresh every 60 seconds
- **MISSING:** Blocked URLs panel — server routes exist (`/api/blocked`, `/api/blocked/unblock`) but NO UI component

### Held Tab — WORKING
- Held brief cards via ArticleCard (compact mode)
- Large score, hold reason badges, age indicator
- Retry action, Reject action
- Entry count, auto-refresh 60s, empty state

### History Tab — FULLY WORKING
- Decision list grouped by date (Today/Yesterday/date)
- Filter pills: All, Approved, Rejected, Held, Re-researched, Pipeline Output, Duplicates
- Stats bar with counts per decision type (clickable)
- Expandable decision rows with full detail
- Entry snapshot (headline + the_so_what) when available
- Auto-refresh every 60 seconds

### Thought Leadership Tab — WORKING
- Discover TL button (SSE streaming)
- Candidates: title, source domain badge, date, snippet, Publish/Dismiss actions
- Published TL: proper cards (title, author/org, date)
- Candidate + published counts
- Empty state when both empty

### Landscape Tab — WORKING
- Run Sweep button (SSE streaming)
- Maturity suggestions: company, capability, suggested maturity, reason
- Apply/Dismiss actions per suggestion
- Stale entries list with maturity color coding
- Suggestion + stale counts
- Empty state when both empty

### Audit Tab — WORKING
- Mode toggle: Fast / Deep
- Run Audit button (SSE streaming)
- Live log display
- Summary pills: Clean, Warnings, Errors
- Issues list by severity with field + description
- Empty state before first run

---

## Design Tokens

| Token | Value | Usage |
|-------|-------|-------|
| Claret | `#990F3D` | Accent, section labels, links, CTA |
| Ink | `#0E1116` | Primary text |
| Cream | `#F7F2E8` | Body background |
| Sidebar bg | `#FAF7F2` | Card sidebar, expanded sections |
| Border | `#E4DFD4` | Card borders, dividers |
| Monospace | `ui-monospace, monospace` | Labels, badges, timestamps |

### Typography Scale

| Element | Size | Weight | Tracking |
|---------|------|--------|----------|
| Score number | 56px | 700 | -0.03em |
| Key stat number | 44px | 700 | — |
| Stat cell number | 32px | 800 | — |
| Schedule time | 18px | 800 | — |
| Headline | 28px | — | — |
| Summary | 15px | — | — |
| "Why It Matters" | 17px | — | italic |
| Section label | 10-11px | 600 | 0.16-0.24em, uppercase |
| Badge | 9-10px | bold | 0.08em, uppercase |

### Spacing

| Element | Value |
|---------|-------|
| Card padding | 48px |
| Sidebar padding | 32px top, 28px sides |
| Section gap | 28px |
| Max content width | 1280px |
| Page horizontal padding | 40px |
| "Why It Matters" left padding | 24px (with 2px claret border) |

---

## Key Components

### ArticleCard.tsx (Core Card)
- 2-column grid: content (flex-1) | sidebar (280px fixed)
- Left accent stripe (3px, color by score band: green ≥75, orange 45-74, red <45)
- Sidebar: score (56px), fabrication verdict badge, action buttons (stacked)
- Expandable "Show research, fabrication & checks" toggle (bordered button, claret text)
- Iteration labels: "Iteration 1" / "Iteration 2" (not v1/v2 to avoid confusion with platform versions)
- Compact mode (for Held tab): smaller card, fewer details

### Header.tsx
- Two-tier matching portal design
- Tab navigation with badge counts (Inbox count, Held count)
- Process indicator (pulsing dot when background operation running)
- Visual separator between editorial tabs and tool tabs

---

## SSE Streaming Pattern

All long operations use Server-Sent Events:

```javascript
// Client pattern (all tabs)
const res = await fetch('/api/endpoint', { method: 'POST', ... });
const reader = res.body.getReader();
const decoder = new TextDecoder();
let buffer = '';
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split('\n');
  buffer = lines.pop() ?? '';
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = JSON.parse(line.slice(6));
      if (data.message) setLog(prev => [...prev, data.message]);
      if (data.done) queryClient.invalidateQueries({ ... });
    }
  }
}
```

---

## Tab Routing

All tabs mounted simultaneously with `display: none` pattern — preserves state (SSE streams, query cache, scroll position) across tab switches. No unmounting/remounting.

```tsx
{['inbox', 'pipeline', 'held', 'history', 'tl', 'landscape', 'audit'].map(tab => (
  <div key={tab} style={{ display: activeTab === tab ? 'block' : 'none' }}>
    <TabComponent />
  </div>
))}
```

---

## Dead Code (To Delete)

| File | Why Dead |
|------|----------|
| `V2Card.tsx` | Replaced by ArticleCard.tsx, not imported anywhere |
| `StoryCard.tsx` | Legacy v1 card, not imported anywhere |
| `ActivityLog.tsx` | Never wired into any tab |
| v1 API functions in `api.ts` | `fetchInbox`, `fetchArchive`, `rejectItem`, `approveUrl`, `fetchActivityLog` — all v1 legacy |

---

## Feature Manifest

Full checklist at `intake-server/client/FEATURE_MANIFEST.md`. **Check this before every UI deploy to prevent silent regressions.** Session 35 dropped 4 tabs (TL/Landscape/Audit/Blocked) without anyone noticing until session 42.
