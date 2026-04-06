---
name: Platform Engineering Principles — From Real Companies
description: 10 principles for building intelligence platforms, sourced from Anthropic, Stripe, Palantir, Bloomberg, CB Insights, Linear. Apply to every new vertical.
type: reference
---

# 10 Principles for Building Intelligence Platforms

Sourced from Anthropic engineering blog, Stripe API design, Palantir Foundry, CB Insights pipeline overhaul, Linear product method, Confident AI (pgvector migration), and academic RAG research. Applied to Living Intelligence.

## 1. Store Raw, Transform Later
Every fetch, every agent output, every human decision = immutable event. You can always re-derive; you cannot re-fetch a deleted article. Palantir's Raw Zone pattern: raw data lands immutable, transforms flow through pipeline. (We learned this the hard way — see `feedback_database_first.md`.)

## 2. Start Simple, Add Complexity Only When Simpler Fails
Anthropic's #1 rule from "Building Effective Agents" (Dec 2024). Five patterns in order: prompt chaining → routing → parallelization → orchestrator-workers → evaluator-optimizer. Our pipeline uses patterns 1, 4, and 5 correctly. No LangChain/LangGraph needed — direct Claude API calls with orchestrator is what Anthropic themselves recommend.

## 3. Version Prompts Like Code
Every prompt change should be tracked with evaluation results. A `prompt_versions` table answers: "Did the new fabrication prompt actually improve quality?" Braintrust's pattern: scoring functions compare inputs/outputs/expected using automated scorers + LLM-as-judge.

## 4. Evaluate Continuously
Run offline evals (curated test sets, ~20 cases is enough) before prompt changes. Run online evals (score production outputs) continuously. Anthropic found LLM-as-judge with 0.0-1.0 numeric scores was the most reliable method. Token usage explains 80% of performance variance.

## 5. Human-in-the-Loop Is a Feature
2024 ACM study: human-in-the-loop RAG reduced hallucinations by 59%. BBC found 50%+ of AI-generated news had significant factual distortions. Our "nothing auto-publishes" design is architecturally correct. At $4,500/year, one fabricated claim costs a client.

## 6. pgvector in Supabase Is Right
Confident AI migrated FROM Pinecone TO pgvector. Reason: same-transaction updates between metadata and embeddings eliminate sync drift. Under 1M vectors, performance difference is smaller than embedding API latency. Supabase Pro handles 500K vectors. Use hybrid search: BM25 (full-text) + vector (semantic) + Reciprocal Rank Fusion.

## 7. Build Idempotent Pipelines
Stripe's core API principle: every mutation accepts an idempotency key. Content-hash dedup prevents duplicate publishes permanently. Every pipeline run should be safely re-runnable.

## 8. Observe Everything, Alert on What Matters
Log cost-per-entry, time-per-entry, score-per-entry. Stripe: "Monitoring tells you it broke; observability tells you why." 87% of platform engineering teams use centralized observability. Pipeline events table: `(entry_id, agent, prompt_version, model, tokens_in, tokens_out, latency_ms, score, created_at)`.

## 9. Editorial Overrides = Training Data
Every time a human editor changes AI output, log before/after. This compounds: prompt improvements get measurably better. CB Insights learned that tribal knowledge must be externalized — their solution was automated pipeline visualization, not documentation.

## 10. Design for the Next Vertical From Day One
The platform is a repeatable intelligence product factory. Data model, pipeline, and evaluation framework should be vertical-agnostic. Only prompts and sources change per vertical. Linear's 25 engineers serve 10,000+ companies — extreme leverage through composable architecture.

---

## Key Sources
- Anthropic: "Building Effective Agents" (anthropic.com/research/building-effective-agents)
- Anthropic: "How We Built Our Multi-Agent Research System" (anthropic.com/engineering/multi-agent-research-system)
- Anthropic: "Effective Harnesses for Long-Running Agents" (anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- Stripe: API Versioning + Idempotency (stripe.com/blog/api-versioning, stripe.com/blog/idempotency)
- Confident AI: "Why We Replaced Pinecone with pgvector" (confident-ai.com/blog)
- CB Insights: "Data Pipelines Overhaul" (cbinsights.com/research/team-blog/data-pipelines-overhaul)
- Linear Method (linear.app/method)
- Braintrust: "How to Eval" (braintrust.dev/articles/how-to-eval)
- Palantir Foundry Architecture (palantir.com/docs/foundry)
- Martin Kleppmann: "Designing Data-Intensive Applications"
