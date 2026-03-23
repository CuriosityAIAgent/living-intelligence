import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

export async function verify({ entry, sourceMarkdown, send }) {
  send('status', { message: 'Running governance verification...' });

  const claimsToVerify = [
    entry.headline,
    entry.summary,
    entry.key_stat ? `${entry.key_stat.number} — ${entry.key_stat.label}` : null,
  ].filter(Boolean).join('\n\n');

  const prompt = `You are a fact-checking agent for an AI in wealth management publication.

Your job: verify that every factual claim in the GENERATED ENTRY is supported by the SOURCE ARTICLE.

GENERATED ENTRY (what we plan to publish):
---
Headline: ${entry.headline}
Summary: ${entry.summary}
Key stat: ${entry.key_stat ? `${entry.key_stat.number} — ${entry.key_stat.label}` : 'none'}
---

SOURCE ARTICLE (ground truth):
---
${sourceMarkdown.slice(0, 6000)}
---

Verify each claim in the generated entry against the source article.

Return a JSON object in this exact format:
{
  "verdict": "PASS" | "REVIEW" | "FAIL",
  "confidence": 0-100,
  "verified_claims": ["list of claims that are clearly supported by the source"],
  "unverified_claims": ["list of claims that could not be found in or clearly inferred from the source"],
  "fabricated_claims": ["list of claims that appear to contradict the source or cannot exist in it"],
  "notes": "Brief explanation of your verdict",
  "paywall_caveat": true | false
}

Verdict rules:
- PASS: All claims are verifiable in the source. Minor paraphrasing is fine. No fabrications.
- REVIEW: 1-2 claims could not be verified (may be implied but not explicit). No fabrications.
- FAIL: Any claim contradicts the source, OR any specific number/name/statistic appears to be fabricated.
- If paywall_caveat is true (insufficient source content), give REVIEW even if other signals look fine.

Return only valid JSON. No explanation outside the JSON.`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1000,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = response.content[0].text.trim();
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON in governance response');

  const result = JSON.parse(jsonMatch[0]);

  send('result', {
    verdict: result.verdict,
    confidence: result.confidence,
    verified_claims: result.verified_claims || [],
    unverified_claims: result.unverified_claims || [],
    fabricated_claims: result.fabricated_claims || [],
    notes: result.notes,
    paywall_caveat: result.paywall_caveat || false,
  });

  return result;
}
