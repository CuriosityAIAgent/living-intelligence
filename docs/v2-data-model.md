# v2 Entry Data Model

Every entry produced by the v2 pipeline stores the full audit trail.

```json
{
  // ── Core fields (same as v1, populated by Writer Agent) ──
  "id": "slug-format-id",
  "type": "product_launch | partnership | funding | ...",
  "headline": "Capability-led, specific, under 120 chars",
  "summary": "Analytical, multi-source synthesis. 3-5 sentences.",
  "the_so_what": "Falsifiable competitive claim. Peer context. Decision-grade.",
  "company": "company-slug",
  "company_name": "Full Name",
  "date": "YYYY-MM-DD",
  "week": "YYYY-MM-DD (Monday)",
  "source_name": "Primary publication",
  "source_url": "https://...",
  "source_verified": true,
  "image_url": "/logos/company.svg",
  "key_stat": { "number": "15,000", "label": "advisors using the platform" },
  "capability_evidence": {
    "capability": "advisor_productivity",
    "stage": "deployed",
    "evidence": "Specific proof from source",
    "metric": "Quantified impact or null"
  },
  "tags": {
    "capability": "advisor_productivity",
    "region": "us",
    "segment": "wirehouse",
    "theme": ["agentic_ai", "meeting_automation"]
  },
  "sources": [
    { "name": "BofA Newsroom", "url": "https://...", "type": "primary" },
    { "name": "American Banker", "url": "https://...", "type": "coverage" },
    { "name": "Fortune", "url": "https://...", "type": "discovery" }
  ],
  "source_count": 3,
  "featured": false,
  "published_at": "ISO timestamp",

  // ── v2 pipeline fields ──

  "_triage_score": 62,
  "_final_score": 84,

  "_research": {
    "entities": {
      "company_name": "...",
      "company_slug": "...",
      "people": ["..."],
      "metrics": ["..."],
      "capability_area": "...",
      "key_topic": "...",
      "event_type": "..."
    },
    "source_count": 4,
    "sources_found": 8,
    "sources_fetched": 4,
    "sources_paywalled": 2,
    "landscape_context": {
      "is_tracked": true,
      "current_maturity": "deployed",
      "peer_comparison": "Morgan Stanley at scaled, Goldman at piloting"
    },
    "past_entries_count": 3,
    "whats_new": "First production deployment — was in pilot since Q3 2025",
    "cross_source_conflicts": [],
    "confidence": "high",
    "researched_at": "ISO timestamp"
  },

  "_fabrication": {
    "verdict": "CLEAN",
    "claims_checked": 12,
    "claims_verified": 11,
    "claims_unverified": 1,
    "claims_fabricated": 0,
    "details": [
      { "claim": "15,000 advisors", "source": "BofA Newsroom", "status": "verified" }
    ],
    "cross_source_conflicts": [],
    "drift_from_previous": [],
    "checked_at": "ISO timestamp"
  },

  "_iterations": [
    {
      "version": 1,
      "headline": "...",
      "the_so_what": "...",
      "evaluation": {
        "specificity": true,
        "so_what": false,
        "source": true,
        "substance": true,
        "stat": true,
        "competitor": false,
        "overall": "NEEDS_WORK",
        "feedback": "Generic so-what. Missing peer context."
      },
      "fabrication_verdict": "CLEAN",
      "timestamp": "ISO"
    },
    {
      "version": 2,
      "headline": "...",
      "the_so_what": "...",
      "evaluation": {
        "specificity": true,
        "so_what": true,
        "source": true,
        "substance": true,
        "stat": true,
        "competitor": true,
        "overall": "PASS"
      },
      "fabrication_verdict": "CLEAN",
      "timestamp": "ISO"
    }
  ],

  "_editor_notes": [],

  // ── Governance (populated at publish time) ──
  "_governance": {
    "verdict": "PASS",
    "confidence": 92,
    "verified_claims": ["..."],
    "unverified_claims": ["..."],
    "fabricated_claims": [],
    "notes": "...",
    "paywall_caveat": false,
    "verified_at": "ISO",
    "human_approved": true,
    "approved_at": "ISO"
  }
}
```
