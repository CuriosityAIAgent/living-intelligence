# Content Audit

**Trigger phrases:** "run audit", "check content quality", "audit the platform", "check for stale entries", "quality check", "/audit"

A full sweep of the platform's content health. Catches broken URLs, stale data, maturity over-claims, fabricated metrics, and anything that would embarrass the platform in a CEO presentation. Run this before any major demo, after a batch of new entries, or at the start of a new month.

---

## Step 0 — Smoke Test (run first)

```bash
cd /Users/haresh/Desktop/Living\ Intelligence/living-intelligence
export PATH="$HOME/.fnm/node-versions/v20.20.0/installation/bin:$PATH"
node intake-server/scripts/smoke-test.js
```

This catches the most common issues fast: JSON parse errors, missing required fields, slug mismatches between filename and id, banned URLs (clearbit/unavatar), and test artifacts (_testpub_* files). If smoke tests fail, fix those issues before proceeding with the full audit.

---

## Step 1 — Run the Automated Health Check

```bash
cd /Users/haresh/Desktop/Living\ Intelligence/living-intelligence
export PATH="$HOME/.fnm/node-versions/v20.20.0/installation/bin:$PATH"
node intake-server/scripts/test-portal.js --fast
```

This checks:
- All `source_url` fields resolve (no 404s)
- All `document_url` fields resolve (TL PDFs still accessible)
- All `image_url` fields are null or resolve
- `source_verified` consistency
- All portal pages load at localhost:3002

Report the results. Auto-fixes will run for broken image URLs. Flag anything that needs manual attention.

---

## Step 2 — Intelligence Entry Audit

Read all files in `data/intelligence/`. For each entry, check:

| Check | Pass condition |
|-------|---------------|
| `the_so_what` is specific | Not generic ("AI is transforming wealth management") — must name a specific implication |
| `the_so_what` has no directive language | No "firms should", "CXO", "board", "must now decide", "game-changing". Should be analytical insight only — competitive benchmarks, cross-landscape context, infrastructure parallels. Not advice. |
| `date` is not today's date | Entry dates should be article publication dates |
| `source_verified` is honest | If `true`, source must be fetchable — spot-check 3 random entries |
| `human_approved` is set | All live entries should have `human_approved: true` |
| `_governance.verdict` is set | All entries should have a governance block |
| No clearbit/unavatar URLs | `image_url` should be null or a local path |
| No `_testpub_` prefix | Delete any test publication files immediately |

Flag any entries that fail these checks. For `the_so_what` failures, rewrite them (with source confirmation if needed).

---

## Step 3 — Landscape Audit

Read all files in `data/competitors/`. For each company, check:

| Check | Pass condition |
|-------|---------------|
| All 7 capability dimensions present | No missing dimensions |
| `overall_maturity` matches best confirmed capability | Not over-stated |
| `last_updated` within 6 months | Flag companies not updated since before Jan 2026 |
| `headline_metric` follows formula | `[AI metric] · [scale context]` |
| Logo exists | `data/logos/{id}.svg` or `.png` |
| No `announced` rated as `deployed` | Check evidence quality |

**Maturity audit focus:** The most common failure is `deployed` when evidence only supports `announced`. For any company rated `deployed` or `scaled`, verify you can find a source confirming live production deployment.

Output a table:
```
| Company | Last Updated | Maturity | Flag |
```

---

## Step 4 — Thought Leadership Audit

Read all files in `data/thought-leadership/`. For each entry:

| Check | Pass condition |
|-------|---------------|
| `key_quotes` are all verbatim | Spot-check — fetch the source for any that look suspicious |
| `source_url` resolves | Fetch it |
| `document_url` resolves if set | Fetch it |
| Author attribution correct | Name + title + organisation accurate |
| `source_verified: true` | All TL entries should be source-verified |

---

## Step 5 — Data Counts Reconciliation

Count actual files and confirm they match memory:

```bash
ls data/intelligence/*.json | wc -l
ls data/thought-leadership/*.json | wc -l
ls data/competitors/*.json | wc -l
ls data/logos/* | wc -l
```

If counts differ from `project_living_intelligence.md`, update the memory file with the correct counts.

---

## Step 6 — Audit Report

Output a clean summary:

```
AUDIT REPORT — [date]

Intelligence entries: [N] total
  ✅ [N] clean
  ⚠️  [N] need attention: [list issues]

Landscape companies: [N] total
  ✅ [N] clean
  ⚠️  [N] stale (last updated > 6 months)
  ⚠️  [N] maturity flags

Thought leadership: [N] total
  ✅ [N] clean
  ⚠️  [N] need attention

Broken URLs: [N] (auto-fixed: [N], needs manual: [N])

RECOMMENDED ACTIONS:
1. [highest priority fix]
2. [next fix]
```

---

## Step 7 — Fix What Can Be Fixed Now

For each flagged issue, decide with Haresh:
- Fix now (rewrite the_so_what, update maturity, fix URL)
- Defer to roadmap (add as a task in `project_roadmap.md`)
- Delete (if the entry cannot be verified and shouldn't stay live)

**Default: prefer deleting over leaving broken or unverifiable content.**

---

## Notes

- Run this before every major demo or CEO presentation
- The audit takes 20–40 minutes for a full run — block time for it
- `--fast` flag on test-portal.js skips slow source_url checks — use for quick sweeps, not pre-demo
- Any entry you cannot verify in this session should have `source_verified` set to `false` until re-verified
