# Session Catchup

**Trigger phrases:** "catchup", "what's the status", "where were we", "session start", "what's pending", "things to do", "/catchup"

Run this at the start of every session. Gets you oriented in under 2 minutes — roadmap, Railway health, inbox status, and any overnight pipeline results.

---

## Step 1 — Read the Roadmap

Read `~/.claude/projects/-Users-haresh/memory/project_roadmap.md` and output the current pending work:

```
🔴 IMMEDIATE (do this session):
  1. [item]
  2. [item]

🟡 NEXT (coming sessions):
  3. [item]
  4. [item]

✅ Last completed: [most recent completed item + date]
```

---

## Step 2 — Check Railway Health

Run a quick health check against the intake server:

```bash
curl -s -u $STUDIO_USER:$STUDIO_PASS https://[railway-url]/api/health
```

Report:
- Server status (up/down)
- Queue depth (how many items in inbox)
- Blocked URL count
- Last pipeline run timestamp (from `/api/pipeline-status`)

If the server is down or returning errors: flag it immediately as the top priority before anything else.

---

## Step 2b — Run Tests

Run tests before making any code changes:

```bash
cd /Users/haresh/Desktop/Living\ Intelligence/living-intelligence
export PATH="$HOME/.fnm/node-versions/v20.20.0/installation/bin:$PATH"
node intake-server/scripts/run-tests.js
node intake-server/scripts/smoke-test.js
```

- `run-tests.js`: 119 unit tests across 13 suites. All must pass.
- `smoke-test.js`: 7 data integrity checks (JSON validity, required fields, slug mismatches, banned URLs, test artifacts). All must pass.

Both must pass before any code changes this session.

---

## Step 3 — Inbox Summary

If queue > 0, show a brief summary:
```
📥 Inbox: [N] items pending review
  • [N] PASS (score ≥ 75)
  • [N] REVIEW (score 60–74)
  Oldest item: [date]
```

If the pipeline ran overnight (last_run_at < 12 hours ago), flag it:
```
🌙 Pipeline ran at [time] — [N] new candidates queued
```

---

## Step 4 — Surface Any Alerts

Check for anything that needs immediate attention:
- Any items in inbox older than 3 days (stale review queue)
- Blocked URL count > 20 (worth a review pass)
- Last pipeline run > 48 hours ago (pipeline may have stalled)

---

## Step 5 — Confirm Focus

Ask: "Ready to start with [top roadmap item], or something else?"

Then proceed with whatever Haresh chooses.

---

## Notes

- This skill is fast — it should take under 2 minutes
- If Railway health check fails (no credentials in env), skip Step 2 and note it
- Always surface the roadmap first — the most common session failure is starting something new while forgetting what was in flight
- **Development workflow: Think → Test → Code → Verify → Local → Commit → Push → Deploy. No code ships without a test.**
