#!/usr/bin/env node
/**
 * audit-all.js — CLI runner for the data quality audit engine
 *
 * Usage:
 *   node --env-file=.env scripts/audit-all.js           # fast audit (rule-based)
 *   node --env-file=.env scripts/audit-all.js --deep    # deep audit (+ Claude AI)
 */

import { runFastAudit, runDeepAudit } from '../agents/auditor.js';

const isDeep = process.argv.includes('--deep');

// ─── Console send function ────────────────────────────────────────────────────

let lastPhase = null;

function send(event, data) {
  if (event === 'status') {
    console.log(`  [status] ${data.message}`);
  } else if (event === 'progress') {
    if (data.phase !== lastPhase) {
      lastPhase = data.phase;
      console.log(`  [phase]  ${data.phase}`);
    }
    process.stdout.write(`\r  [progress] ${data.checked}/${data.total} checked`);
    if (data.checked === data.total) process.stdout.write('\n');
  } else if (event === 'file_result') {
    // Suppress per-file output during scan — summary below is enough
  } else if (event === 'complete') {
    // handled after await
  } else if (event === 'error') {
    console.error(`  [error] ${data.message}`);
  }
}

// ─── Status badge formatter ───────────────────────────────────────────────────

const RESET  = '\x1b[0m';
const RED    = '\x1b[31m';
const YELLOW = '\x1b[33m';
const GREEN  = '\x1b[32m';
const BOLD   = '\x1b[1m';
const DIM    = '\x1b[2m';

function statusBadge(status) {
  if (status === 'FAIL') return `${RED}${BOLD}FAIL${RESET}`;
  if (status === 'WARN') return `${YELLOW}${BOLD}WARN${RESET}`;
  return `${GREEN}PASS${RESET}`;
}

function printSummaryTable(report) {
  const { summary } = report;

  console.log('');
  console.log(`${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}`);
  console.log(`${BOLD}  DATA QUALITY AUDIT REPORT — ${report.mode.toUpperCase()} mode${RESET}`);
  console.log(`${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}`);
  console.log(`  Run at:    ${report.run_at}`);
  console.log(`  Score:     ${BOLD}${summary.score}/100${RESET}`);
  console.log('');
  console.log(`  Files checked:   ${summary.total_intelligence} intelligence + ${summary.total_competitors} landscape`);
  console.log(`  ${GREEN}PASS${RESET}: ${summary.pass_count}   ${YELLOW}WARN${RESET}: ${summary.warn_count}   ${RED}FAIL${RESET}: ${summary.fail_count}`);
  console.log(`  Critical issues: ${summary.issues_critical}   Warnings: ${summary.issues_warning}`);
  console.log('');

  // Intelligence section
  const failOrWarnIntel = report.intelligence.filter(r => r.status !== 'PASS');
  if (failOrWarnIntel.length > 0) {
    console.log(`${BOLD}  INTELLIGENCE — Issues (${failOrWarnIntel.length} files)${RESET}`);
    console.log(`  ${'─'.repeat(60)}`);
    for (const r of failOrWarnIntel) {
      console.log(`  ${statusBadge(r.status).padEnd(20)} ${DIM}${r.file}${RESET}`);
      console.log(`  ${' '.repeat(4)}${r.name.slice(0, 72)}`);
      for (const issue of r.issues) {
        const icon = issue.severity === 'critical' ? `${RED}✕${RESET}` : `${YELLOW}⚠${RESET}`;
        console.log(`  ${' '.repeat(6)}${icon} [${issue.check}] ${issue.detail.slice(0, 90)}`);
      }
      console.log('');
    }
  } else {
    console.log(`  ${GREEN}INTELLIGENCE: All ${report.intelligence.length} entries PASS${RESET}`);
    console.log('');
  }

  // Landscape section
  const failOrWarnLandscape = report.landscape.filter(r => r.status !== 'PASS');
  if (failOrWarnLandscape.length > 0) {
    console.log(`${BOLD}  LANDSCAPE — Issues (${failOrWarnLandscape.length} files)${RESET}`);
    console.log(`  ${'─'.repeat(60)}`);
    for (const r of failOrWarnLandscape) {
      console.log(`  ${statusBadge(r.status).padEnd(20)} ${DIM}${r.file}${RESET}`);
      console.log(`  ${' '.repeat(4)}${r.name}`);
      for (const issue of r.issues) {
        const icon = issue.severity === 'critical' ? `${RED}✕${RESET}` : `${YELLOW}⚠${RESET}`;
        console.log(`  ${' '.repeat(6)}${icon} [${issue.check}] ${issue.detail.slice(0, 90)}`);
      }
      console.log('');
    }
  } else {
    console.log(`  ${GREEN}LANDSCAPE: All ${report.landscape.length} entries PASS${RESET}`);
    console.log('');
  }

  console.log(`${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}`);

  if (summary.issues_critical === 0) {
    console.log(`${GREEN}${BOLD}  ✓ Audit passed — no critical issues found.${RESET}`);
  } else {
    console.log(`${RED}${BOLD}  ✕ Audit failed — ${summary.issues_critical} critical issue(s) require attention.${RESET}`);
  }
  console.log(`  Report saved to: data/audit-report.json`);
  console.log('');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const mode = isDeep ? 'DEEP' : 'FAST';
  console.log('');
  console.log(`${BOLD}Living Intelligence — Data Quality Audit${RESET}`);
  console.log(`Mode: ${mode}${isDeep ? ' (rule-based + Claude AI verification)' : ' (rule-based only)'}`);
  console.log('');

  let report;
  try {
    if (isDeep) {
      report = await runDeepAudit({ send });
    } else {
      report = await runFastAudit({ send });
    }
  } catch (err) {
    console.error(`${RED}${BOLD}Fatal error:${RESET} ${err.message}`);
    console.error(err.stack);
    process.exit(1);
  }

  printSummaryTable(report);

  // Exit code: 0 = clean, 1 = critical issues
  process.exit(report.summary.issues_critical === 0 ? 0 : 1);
}

main();
