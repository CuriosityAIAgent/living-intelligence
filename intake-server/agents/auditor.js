/**
 * auditor.js — Data Quality Audit Engine
 *
 * Two exported functions:
 *   runFastAudit({ send })  — rule-based checks, no API cost
 *   runDeepAudit({ send })  — fast audit + Claude AI verification
 *
 * Reference date: 2026-03-19 (hardcoded as system "today")
 */

import { readFileSync, readdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import Anthropic from '@anthropic-ai/sdk';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR   = join(__dirname, '..', '..', 'data');
const TODAY      = new Date('2026-03-19');

// ─── Maturity ordering ────────────────────────────────────────────────────────

const MATURITY_SCORE = {
  scaled:      5,
  deployed:    4,
  piloting:    3,
  announced:   2,
  no_activity: 1,
};

const VALID_SEGMENTS = new Set([
  'wirehouse',
  'global_private_bank',
  'regional_champion',
  'digital_disruptor',
  'ai_native',
  'ria_independent',
  'advisor_tools',
]);

const VALID_MATURITY = new Set(Object.keys(MATURITY_SCORE));

// ─── Date helpers ──────────────────────────────────────────────────────────────

/**
 * Returns the Monday of the ISO week containing the given date string.
 */
function getMondayOf(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  const day = d.getUTCDay(); // 0=Sun,1=Mon,...,6=Sat
  const diff = (day === 0) ? -6 : 1 - day; // shift to Monday
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() + diff);
  return monday;
}

function daysDiff(dateStrA, dateStrB) {
  const a = new Date(dateStrA + 'T00:00:00Z');
  const b = new Date(dateStrB + 'T00:00:00Z');
  return (a - b) / (1000 * 60 * 60 * 24);
}

// ─── Fast audit — intelligence entries ────────────────────────────────────────

function auditIntelligenceEntry(entry, filename, featuredCount) {
  const issues = [];

  // 1. date_url_mismatch
  const urlMatch = (entry.source_url || '').match(/(\d{4})\/(\d{2})/);
  if (urlMatch && entry.date) {
    const urlYear  = parseInt(urlMatch[1], 10);
    const urlMonth = parseInt(urlMatch[2], 10);
    const [entryYear, entryMonth] = entry.date.split('-').map(Number);
    if (urlYear !== entryYear) {
      issues.push({
        severity: 'critical',
        check: 'date_url_mismatch',
        detail: `URL contains year ${urlYear} but entry date is ${entry.date} (year mismatch)`,
      });
    } else if (Math.abs(urlMonth - entryMonth) > 1) {
      issues.push({
        severity: 'critical',
        check: 'date_url_mismatch',
        detail: `URL contains month ${urlMonth} but entry date is ${entry.date} (month differs by more than 1)`,
      });
    }
  }

  // 2. week_field_correct
  if (entry.date && entry.week) {
    const expectedMonday = getMondayOf(entry.date);
    const actualWeek = new Date(entry.week + 'T00:00:00Z');
    const diff = Math.abs((actualWeek - expectedMonday) / (1000 * 60 * 60 * 24));
    if (diff > 6) {
      issues.push({
        severity: 'warning',
        check: 'week_field_correct',
        detail: `'week' is ${entry.week} but expected Monday ${expectedMonday.toISOString().slice(0,10)} for date ${entry.date} (${Math.round(diff)} days off)`,
      });
    }
  }

  // 3. future_date
  if (entry.date) {
    const entryDate = new Date(entry.date + 'T00:00:00Z');
    const futureDays = (entryDate - TODAY) / (1000 * 60 * 60 * 24);
    if (futureDays > 2) {
      issues.push({
        severity: 'critical',
        check: 'future_date',
        detail: `Entry date ${entry.date} is ${Math.round(futureDays)} days in the future (reference: 2026-03-19)`,
      });
    }
  }

  // 4. missing_governance
  if (!entry._governance || !entry._governance.verdict) {
    issues.push({
      severity: 'critical',
      check: 'missing_governance',
      detail: entry._governance
        ? 'Governance block exists but has no verdict'
        : 'No _governance block found on entry',
    });
  }

  // 5. source_verified_mismatch
  if (entry._governance) {
    const gov = entry._governance;
    const shouldBeVerified =
      gov.verdict === 'PASS' || gov.human_approved === true;
    if (shouldBeVerified && entry.source_verified !== true) {
      issues.push({
        severity: 'critical',
        check: 'source_verified_mismatch',
        detail: `Governance verdict is ${gov.verdict} and/or human_approved is ${gov.human_approved}, but source_verified is ${entry.source_verified} (should be true)`,
      });
    }
  }

  // 6. multiple_featured — checked at batch level, flagged here if entry is featured
  if (entry.featured === true && featuredCount > 1) {
    issues.push({
      severity: 'warning',
      check: 'multiple_featured',
      detail: `This entry has featured: true, but ${featuredCount} entries have featured: true (should be at most 1)`,
    });
  }

  // 7. key_stat_in_summary
  // Checks the core numeric part appears in the summary — tolerates format differences
  // e.g. "$130B" matches "$130 billion", "30B" matches "30 billion", "2M+" matches "2 million"
  if (entry.key_stat && entry.key_stat.number && entry.summary) {
    const statNumber = String(entry.key_stat.number).trim();
    const summaryLower = entry.summary.toLowerCase();
    const numericCore = statNumber.replace(/[$,+%]/g, '').toLowerCase();
    const expanded = numericCore
      .replace(/(\d+\.?\d*)b\b/, (_, n) => `${n} billion`)
      .replace(/(\d+\.?\d*)m\b/, (_, n) => `${n} million`)
      .replace(/(\d+\.?\d*)t\b/, (_, n) => `${n} trillion`)
      .replace(/(\d+\.?\d*)k\b/, (_, n) => `${n},000`);
    const inSummary = summaryLower.includes(numericCore)
      || summaryLower.includes(expanded)
      || summaryLower.includes(statNumber.toLowerCase());
    if (statNumber && !inSummary) {
      issues.push({
        severity: 'warning',
        check: 'key_stat_in_summary',
        detail: `key_stat.number "${statNumber}" does not appear in summary (checked verbatim, core "${numericCore}", expanded "${expanded}")`,
      });
    }
  }

  // 8. no_source_url
  if (!entry.source_url) {
    issues.push({
      severity: 'critical',
      check: 'no_source_url',
      detail: 'Missing source_url field',
    });
  }

  // 9. governance_confidence_low
  if (entry._governance && entry._governance.confidence != null) {
    if (entry._governance.confidence < 75) {
      issues.push({
        severity: 'warning',
        check: 'governance_confidence_low',
        detail: `Governance confidence is ${entry._governance.confidence} (below threshold of 75)`,
      });
    }
  }

  // 10. fabricated_claims
  if (
    entry._governance &&
    Array.isArray(entry._governance.fabricated_claims) &&
    entry._governance.fabricated_claims.length > 0
  ) {
    issues.push({
      severity: 'critical',
      check: 'fabricated_claims',
      detail: `Entry has ${entry._governance.fabricated_claims.length} fabricated claim(s): ${entry._governance.fabricated_claims.slice(0,2).join('; ')}`,
    });
  }

  const criticals = issues.filter(i => i.severity === 'critical').length;
  const warnings  = issues.filter(i => i.severity === 'warning').length;

  return {
    id:     entry.id || filename.replace('.json', ''),
    file:   filename,
    name:   entry.headline
              ? entry.headline.slice(0, 80) + (entry.headline.length > 80 ? '...' : '')
              : entry.id || filename,
    status: criticals > 0 ? 'FAIL' : warnings > 0 ? 'WARN' : 'PASS',
    issues,
  };
}

// ─── Fast audit — competitor entries ──────────────────────────────────────────

function auditCompetitorEntry(competitor, filename) {
  const issues = [];

  // 1. invalid_segment
  if (!VALID_SEGMENTS.has(competitor.segment)) {
    issues.push({
      severity: 'critical',
      check: 'invalid_segment',
      detail: `segment "${competitor.segment}" is not valid. Must be one of: ${[...VALID_SEGMENTS].join(', ')}`,
    });
  }

  // 2. invalid_maturity (overall + per capability)
  if (!VALID_MATURITY.has(competitor.overall_maturity)) {
    issues.push({
      severity: 'critical',
      check: 'invalid_maturity',
      detail: `overall_maturity "${competitor.overall_maturity}" is not valid. Must be one of: ${[...VALID_MATURITY].join(', ')}`,
    });
  }

  if (competitor.capabilities) {
    for (const [capId, cap] of Object.entries(competitor.capabilities)) {
      if (cap.maturity && !VALID_MATURITY.has(cap.maturity)) {
        issues.push({
          severity: 'critical',
          check: 'invalid_maturity',
          detail: `Capability "${capId}" has invalid maturity "${cap.maturity}"`,
        });
      }
    }
  }

  // 3. maturity_inconsistency
  if (competitor.capabilities && VALID_MATURITY.has(competitor.overall_maturity)) {
    const capScores = Object.values(competitor.capabilities)
      .map(cap => MATURITY_SCORE[cap.maturity] || 0);
    const maxCapScore = capScores.length > 0 ? Math.max(...capScores) : 0;
    const overallScore = MATURITY_SCORE[competitor.overall_maturity] || 0;
    if (overallScore > maxCapScore + 1) {
      issues.push({
        severity: 'warning',
        check: 'maturity_inconsistency',
        detail: `overall_maturity "${competitor.overall_maturity}" (score ${overallScore}) is higher than best capability maturity (score ${maxCapScore}) by more than 1 step`,
      });
    }
  }

  // 4 & 5. capability checks
  if (competitor.capabilities) {
    for (const [capId, cap] of Object.entries(competitor.capabilities)) {
      // capability_no_sources
      if (!cap.sources || cap.sources.length === 0) {
        issues.push({
          severity: 'warning',
          check: 'capability_no_sources',
          detail: `Capability "${capId}" has no sources array or empty sources`,
        });
      }
      // capability_no_evidence
      if (!cap.evidence || cap.evidence.length === 0) {
        issues.push({
          severity: 'warning',
          check: 'capability_no_evidence',
          detail: `Capability "${capId}" has empty evidence array`,
        });
      }
      // 6. stale_date_assessed
      if (cap.date_assessed) {
        const daysOld = (TODAY - new Date(cap.date_assessed + 'T00:00:00Z')) / (1000 * 60 * 60 * 24);
        if (daysOld > 90) {
          issues.push({
            severity: 'warning',
            check: 'stale_date_assessed',
            detail: `Capability "${capId}" date_assessed is ${cap.date_assessed} — ${Math.round(daysOld)} days ago (threshold: 90 days)`,
          });
        }
      }
    }
  }

  // 7. missing_headline_metric
  if (!competitor.headline_metric || String(competitor.headline_metric).trim() === '') {
    issues.push({
      severity: 'warning',
      check: 'missing_headline_metric',
      detail: 'headline_metric is empty or missing',
    });
  }

  // 8. capability_maturity_stale
  if (competitor.last_updated) {
    const daysOld = (TODAY - new Date(competitor.last_updated + 'T00:00:00Z')) / (1000 * 60 * 60 * 24);
    if (daysOld > 90) {
      issues.push({
        severity: 'warning',
        check: 'capability_maturity_stale',
        detail: `last_updated is ${competitor.last_updated} — ${Math.round(daysOld)} days ago (threshold: 90 days)`,
      });
    }
  }

  const criticals = issues.filter(i => i.severity === 'critical').length;
  const warnings  = issues.filter(i => i.severity === 'warning').length;

  return {
    id:     competitor.id || filename.replace('.json', ''),
    file:   filename,
    name:   competitor.name || competitor.id || filename,
    status: criticals > 0 ? 'FAIL' : warnings > 0 ? 'WARN' : 'PASS',
    issues,
  };
}

// ─── Load data files ───────────────────────────────────────────────────────────

function loadJsonFiles(dir) {
  const files = readdirSync(dir).filter(f => f.endsWith('.json') && !f.startsWith('.'));
  return files.map(filename => {
    try {
      const raw = readFileSync(join(dir, filename), 'utf8');
      return { filename, data: JSON.parse(raw) };
    } catch (err) {
      return { filename, data: null, parseError: err.message };
    }
  });
}

// ─── Build summary ─────────────────────────────────────────────────────────────

function buildSummary(results) {
  const all = [...results.intelligence, ...results.landscape];
  const passCount = all.filter(r => r.status === 'PASS').length;
  const warnCount = all.filter(r => r.status === 'WARN').length;
  const failCount = all.filter(r => r.status === 'FAIL').length;
  const criticals = all.reduce((n, r) => n + r.issues.filter(i => i.severity === 'critical').length, 0);
  const warnings  = all.reduce((n, r) => n + r.issues.filter(i => i.severity === 'warning').length, 0);
  const total = all.length;
  const score = total > 0 ? Math.round((passCount + warnCount * 0.5) / total * 100) : 100;

  return {
    total_intelligence: results.intelligence.length,
    total_competitors:  results.landscape.length,
    issues_critical: criticals,
    issues_warning:  warnings,
    pass_count: passCount,
    warn_count: warnCount,
    fail_count: failCount,
    score,
  };
}

// ─── runFastAudit ──────────────────────────────────────────────────────────────

export async function runFastAudit({ send }) {
  send('status', { message: 'Starting fast audit (rule-based checks)...' });

  const intelligenceDir = join(DATA_DIR, 'intelligence');
  const competitorsDir  = join(DATA_DIR, 'competitors');

  // ── Intelligence entries ──

  send('status', { message: 'Checking intelligence entries...' });

  const intelligenceFiles = loadJsonFiles(intelligenceDir);

  // Pre-pass: count featured entries
  const featuredCount = intelligenceFiles.filter(f => f.data && f.data.featured === true).length;

  const intelligenceResults = [];
  for (let i = 0; i < intelligenceFiles.length; i++) {
    const { filename, data, parseError } = intelligenceFiles[i];

    send('progress', { checked: i + 1, total: intelligenceFiles.length, phase: 'intelligence' });

    if (parseError || !data) {
      const result = {
        id: filename.replace('.json', ''),
        file: filename,
        name: filename,
        status: 'FAIL',
        issues: [{
          severity: 'critical',
          check: 'parse_error',
          detail: `JSON parse error: ${parseError || 'unknown error'}`,
        }],
      };
      intelligenceResults.push(result);
      send('file_result', { type: 'intelligence', result });
      continue;
    }

    const result = auditIntelligenceEntry(data, filename, featuredCount);
    intelligenceResults.push(result);
    send('file_result', { type: 'intelligence', result });
  }

  // ── Competitor entries ──

  send('status', { message: 'Checking competitor/landscape entries...' });

  const competitorFiles = loadJsonFiles(competitorsDir);
  const landscapeResults = [];

  for (let i = 0; i < competitorFiles.length; i++) {
    const { filename, data, parseError } = competitorFiles[i];

    send('progress', { checked: i + 1, total: competitorFiles.length, phase: 'landscape' });

    if (parseError || !data) {
      const result = {
        id: filename.replace('.json', ''),
        file: filename,
        name: filename,
        status: 'FAIL',
        issues: [{
          severity: 'critical',
          check: 'parse_error',
          detail: `JSON parse error: ${parseError || 'unknown error'}`,
        }],
      };
      landscapeResults.push(result);
      send('file_result', { type: 'landscape', result });
      continue;
    }

    const result = auditCompetitorEntry(data, filename);
    landscapeResults.push(result);
    send('file_result', { type: 'landscape', result });
  }

  // ── Assemble report ──

  const summary = buildSummary({ intelligence: intelligenceResults, landscape: landscapeResults });

  const report = {
    run_at:  new Date().toISOString(),
    mode:    'fast',
    summary,
    intelligence: intelligenceResults,
    landscape:    landscapeResults,
  };

  // Save to disk
  try {
    writeFileSync(join(DATA_DIR, 'audit-report.json'), JSON.stringify(report, null, 2), 'utf8');
  } catch (err) {
    send('status', { message: `Warning: could not save audit report — ${err.message}` });
  }

  send('complete', { report });
  return report;
}

// ─── Deep audit helpers ────────────────────────────────────────────────────────

async function fetchJinaContent(url) {
  try {
    const res = await fetch(`https://r.jina.ai/${encodeURIComponent(url)}`, {
      headers: {
        'Authorization': `Bearer ${process.env.JINA_API_KEY}`,
      },
      signal: AbortSignal.timeout(15000),
    });
    const text = await res.text();
    return text.slice(0, 3000);
  } catch (err) {
    return null;
  }
}

async function verifyIntelligenceWithClaude(entry, sourceContent) {
  const client = new Anthropic();

  const keyStat = entry.key_stat
    ? `${entry.key_stat.number} — ${entry.key_stat.label}`
    : 'none';

  const firstClaim =
    entry._governance &&
    Array.isArray(entry._governance.verified_claims) &&
    entry._governance.verified_claims.length > 0
      ? entry._governance.verified_claims[0]
      : null;

  const prompt = `You are a fact-checking agent for an AI wealth management publication.

Check whether the following claims from a published entry are supported by the source content below.

ENTRY DATE: ${entry.date || 'unknown'}
KEY STAT: ${keyStat}
FIRST VERIFIED CLAIM: ${firstClaim || '(no verified claims listed)'}

SOURCE CONTENT (first 3000 chars from ${entry.source_url || 'unknown URL'}):
---
${sourceContent || '(no content fetched)'}
---

Determine:
1. Is the key stat plausible and present in (or consistent with) the source content?
2. Is the date consistent with the source content?
3. Is the first verified claim supported by the source content?

Return only valid JSON in this exact format:
{
  "verified": true | false,
  "issues": ["specific issue description if any"]
}

Return verified: true if all three checks pass. verified: false if any fails.
Return only valid JSON. No explanation outside the JSON.`;

  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = msg.content[0].text.trim();
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON in Claude response');
  return JSON.parse(jsonMatch[0]);
}

async function verifyCompetitorWithClaude(competitor) {
  const client = new Anthropic();

  const prompt = `You are an AI wealth management industry analyst and data quality reviewer.

Given this competitor entry, check the following:
1. Is the segment classification correct for this company type?
2. Is the overall_maturity consistent with the capabilities listed?
3. Are the metrics in headline_metric plausible and internally consistent?

COMPETITOR ENTRY:
---
${JSON.stringify(competitor, null, 2).slice(0, 4000)}
---

Return only valid JSON in this exact format:
{
  "issues": [
    { "severity": "critical" | "warning", "check": "check_name", "detail": "human readable explanation" }
  ]
}

Return { "issues": [] } if the entry looks clean.
Return only valid JSON. No explanation outside the JSON.`;

  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = msg.content[0].text.trim();
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON in Claude response');
  return JSON.parse(jsonMatch[0]);
}

// ─── runDeepAudit ──────────────────────────────────────────────────────────────

export async function runDeepAudit({ send }) {
  send('status', { message: 'Starting deep audit (rule-based + Claude AI verification)...' });

  // Step 1: Run the full fast audit first
  const fastReport = await runFastAudit({ send });

  send('status', { message: 'Fast audit complete. Starting AI verification pass...' });

  // Step 2: Deep-check intelligence entries that passed fast audit (PASS or WARN)
  const deepIntelligence = [...fastReport.intelligence];

  for (let i = 0; i < deepIntelligence.length; i++) {
    const result = deepIntelligence[i];
    if (result.status === 'FAIL') continue; // Skip already-failed entries

    send('status', { message: `AI verifying intelligence ${i + 1}/${deepIntelligence.length}: ${result.name.slice(0, 60)}...` });
    send('progress', { checked: i + 1, total: deepIntelligence.length, phase: 'deep_intelligence' });

    // Find the original entry data
    const intelligenceDir = join(DATA_DIR, 'intelligence');
    let entry = null;
    try {
      const raw = readFileSync(join(intelligenceDir, result.file), 'utf8');
      entry = JSON.parse(raw);
    } catch {
      continue;
    }

    // Skip entries with no source_url
    if (!entry.source_url) continue;

    try {
      // Fetch source content via Jina
      send('status', { message: `Fetching source: ${entry.source_url.slice(0, 70)}...` });
      const sourceContent = await fetchJinaContent(entry.source_url);

      // Claude verification
      const aiResult = await verifyIntelligenceWithClaude(entry, sourceContent);

      if (!aiResult.verified) {
        const aiIssues = (aiResult.issues || []).map(issueText => ({
          severity: 'critical',
          check: 'ai_claim_verification_failed',
          detail: typeof issueText === 'string' ? issueText : JSON.stringify(issueText),
        }));

        if (aiIssues.length === 0) {
          aiIssues.push({
            severity: 'critical',
            check: 'ai_claim_verification_failed',
            detail: 'AI verification returned verified: false (no specific issue provided)',
          });
        }

        deepIntelligence[i] = {
          ...result,
          status: 'FAIL',
          issues: [...result.issues, ...aiIssues],
        };
      }
    } catch (err) {
      // Non-fatal: if Jina/Claude fails, just note it as a warning
      deepIntelligence[i] = {
        ...result,
        issues: [
          ...result.issues,
          {
            severity: 'warning',
            check: 'ai_verification_error',
            detail: `AI verification failed (network/API error): ${err.message}`,
          },
        ],
      };
      // Recompute status
      const hasCritical = deepIntelligence[i].issues.some(x => x.severity === 'critical');
      deepIntelligence[i].status = hasCritical ? 'FAIL' : 'WARN';
    }

    send('file_result', { type: 'intelligence', result: deepIntelligence[i] });
  }

  // Step 3: Deep-check competitor entries that passed fast audit
  const deepLandscape = [...fastReport.landscape];

  for (let i = 0; i < deepLandscape.length; i++) {
    const result = deepLandscape[i];
    if (result.status === 'FAIL') continue;

    send('status', { message: `AI verifying competitor ${i + 1}/${deepLandscape.length}: ${result.name}...` });
    send('progress', { checked: i + 1, total: deepLandscape.length, phase: 'deep_landscape' });

    const competitorsDir = join(DATA_DIR, 'competitors');
    let competitor = null;
    try {
      const raw = readFileSync(join(competitorsDir, result.file), 'utf8');
      competitor = JSON.parse(raw);
    } catch {
      continue;
    }

    try {
      const aiResult = await verifyCompetitorWithClaude(competitor);

      if (aiResult.issues && aiResult.issues.length > 0) {
        deepLandscape[i] = {
          ...result,
          issues: [...result.issues, ...aiResult.issues],
        };
        // Recompute status
        const hasCritical = deepLandscape[i].issues.some(x => x.severity === 'critical');
        const hasWarning  = deepLandscape[i].issues.some(x => x.severity === 'warning');
        deepLandscape[i].status = hasCritical ? 'FAIL' : hasWarning ? 'WARN' : 'PASS';
      }
    } catch (err) {
      deepLandscape[i] = {
        ...result,
        issues: [
          ...result.issues,
          {
            severity: 'warning',
            check: 'ai_verification_error',
            detail: `AI verification failed (network/API error): ${err.message}`,
          },
        ],
      };
      const hasCritical = deepLandscape[i].issues.some(x => x.severity === 'critical');
      deepLandscape[i].status = hasCritical ? 'FAIL' : 'WARN';
    }

    send('file_result', { type: 'landscape', result: deepLandscape[i] });
  }

  // ── Assemble deep report ──

  const summary = buildSummary({ intelligence: deepIntelligence, landscape: deepLandscape });

  const report = {
    run_at:  new Date().toISOString(),
    mode:    'deep',
    summary,
    intelligence: deepIntelligence,
    landscape:    deepLandscape,
  };

  // Save to disk
  try {
    writeFileSync(join(DATA_DIR, 'audit-report.json'), JSON.stringify(report, null, 2), 'utf8');
  } catch (err) {
    send('status', { message: `Warning: could not save audit report — ${err.message}` });
  }

  send('complete', { report });
  return report;
}
