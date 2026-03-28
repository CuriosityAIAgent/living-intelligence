import { writeFileSync, existsSync, mkdirSync, copyFileSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Local mode: data/ is two levels up (living-intelligence/data/).
// Railway mode: overridden by DATA_DIR env var, or falls back to /app/data/
//   (ephemeral write target — files are then cloned+pushed via GIT_TOKEN).
const DATA_ROOT = process.env.DATA_DIR || join(__dirname, '..', '..');
const PORTAL_DATA_DIR = join(DATA_ROOT, 'data', 'intelligence');

// ── Date integrity ─────────────────────────────────────────────────────────────

function validateAndFixDate(entry, candidatePubDate) {
  const now = new Date();

  if (!entry.date) return; // no date — let it through undated

  const eventDate = new Date(entry.date);
  if (isNaN(eventDate.getTime())) {
    // Unparseable date — use candidatePubDate or today
    entry.date = candidatePubDate
      ? new Date(candidatePubDate).toISOString().split('T')[0]
      : now.toISOString().split('T')[0];
    return;
  }

  // Hard gate: event must be < 90 days old
  const ageDays = (now - eventDate) / 86400000;
  if (ageDays > 90) {
    throw new Error(`Entry date ${entry.date} is ${Math.round(ageDays)} days old — exceeds 90-day limit`);
  }

  // Future date: cap at today
  if (eventDate > now) {
    entry.date = now.toISOString().split('T')[0];
    return;
  }

  // Divergence check: if Claude's date diverges > 30 days from source pub_date, use source date
  if (candidatePubDate) {
    const sourcePubDate = new Date(candidatePubDate);
    if (!isNaN(sourcePubDate.getTime())) {
      const divergenceDays = Math.abs(eventDate - sourcePubDate) / 86400000;
      if (divergenceDays > 30) {
        console.warn(`[publisher] Date divergence ${Math.round(divergenceDays)}d: Claude says ${entry.date}, source says ${candidatePubDate}. Using source date.`);
        entry.date = sourcePubDate.toISOString().split('T')[0];
      }
    }
  }
}

export function publish({ entry, candidatePubDate, send }) {
  // Ensure target directory exists
  if (!existsSync(PORTAL_DATA_DIR)) {
    mkdirSync(PORTAL_DATA_DIR, { recursive: true });
  }

  // Date validation — throws if entry is too old, fixes divergence issues
  validateAndFixDate(entry, candidatePubDate);

  // Use the article's original date for published_at so it appears at the correct
  // point in the feed. Approval timestamp is captured in _governance.approved_at.
  entry.published_at = entry.date
    ? new Date(entry.date).toISOString()
    : new Date().toISOString();

  // Auto-resolve logo if image_url is null and a local logo exists
  if (!entry.image_url && entry.company) {
    const logoDir = join(PORTAL_DATA_DIR, '..', 'public', 'logos');
    const slug = entry.company.toLowerCase();
    for (const ext of ['svg', 'png']) {
      if (existsSync(join(logoDir, `${slug}.${ext}`))) {
        entry.image_url = `/logos/${slug}.${ext}`;
        break;
      }
    }
  }

  const { _governance, ...publicFields } = entry;
  const entryToWrite = {
    ...publicFields,
    source_verified: _governance
      ? (_governance.verdict === 'PASS' || _governance.human_approved === true)
      : false,
    _governance: _governance
      ? {
          verdict: _governance.verdict,
          confidence: _governance.confidence,
          verified_claims: _governance.verified_claims || [],
          unverified_claims: _governance.unverified_claims || [],
          notes: _governance.notes || '',
          paywall_caveat: _governance.paywall_caveat || false,
          verified_at: _governance.verified_at,
          human_approved: _governance.human_approved || false,
          approved_at: _governance.approved_at || null,
        }
      : null,
  };

  const filename = `${entryToWrite.id}.json`;
  const filepath = join(PORTAL_DATA_DIR, filename);

  // Check for ID collision
  if (existsSync(filepath)) {
    const ts = Date.now().toString().slice(-6);
    entryToWrite.id = `${entryToWrite.id}-${ts}`;
    const newPath = join(PORTAL_DATA_DIR, `${entryToWrite.id}.json`);
    writeFileSync(newPath, JSON.stringify(entryToWrite, null, 2), 'utf-8');
    send('published', {
      filepath: newPath,
      id: entryToWrite.id,
      renamed: true,
      governance_verdict: _governance?.verdict,
    });
  } else {
    writeFileSync(filepath, JSON.stringify(entryToWrite, null, 2), 'utf-8');
    send('published', {
      filepath,
      id: entryToWrite.id,
      renamed: false,
      governance_verdict: _governance?.verdict,
    });
  }

  return entryToWrite.id;
}

// ── commitInboxState ──────────────────────────────────────────────────────────
// Commits .governance-pending.json + .governance-blocked.json + .pipeline-status.json
// to the intake branch so the inbox survives Railway redeployments.
// Non-fatal — a failure here does not affect the pipeline result.
export function commitInboxState() {
  const gitToken = process.env.GIT_TOKEN;
  const repo     = process.env.GITHUB_REPO || 'CuriosityAIAgent/living-intelligence';
  const branch   = 'intake';

  const defaultPortalDir  = join(__dirname, '..', '..');
  const portalDir         = process.env.PORTAL_DIR || defaultPortalDir;
  const hasGitRepo        = existsSync(join(portalDir, '.git'));

  // Relative paths (for git commands run with -C portalDir)
  const STATE_FILES_REL = [
    'data/.governance-pending.json',
    'data/.governance-blocked.json',
    'data/.pipeline-status.json',
  ];

  function _commit(repoDir) {
    execSync(`git config --global --add safe.directory "${repoDir}"`, { stdio: 'pipe' });
    execSync(`git -C "${repoDir}" config user.email "intake-bot@portal.ai"`, { stdio: 'pipe' });
    execSync(`git -C "${repoDir}" config user.name "AI Portal Intake"`, { stdio: 'pipe' });

    const existing = STATE_FILES_REL.filter(f => existsSync(join(repoDir, f)));
    if (!existing.length) return false;

    execSync(`git -C "${repoDir}" add ${existing.map(f => `"${f}"`).join(' ')}`, { stdio: 'pipe' });

    // Exit if nothing staged
    try { execSync(`git -C "${repoDir}" diff --cached --quiet`, { stdio: 'pipe' }); return false; }
    catch (_) { /* changes present — proceed */ }

    execSync(
      `git -C "${repoDir}" commit -m "Update inbox state after pipeline run"`,
      { stdio: 'pipe' }
    );
    execSync(`git -C "${repoDir}" push origin ${branch}`, { stdio: 'pipe' });
    return true;
  }

  if (hasGitRepo) {
    try {
      if (gitToken) {
        execSync(
          `git -C "${portalDir}" remote set-url origin "https://${gitToken}@github.com/${repo}.git"`,
          { stdio: 'pipe' }
        );
      }
      const pushed = _commit(portalDir);
      if (pushed) console.log('[publisher] Inbox state committed to git (dev)');
    } catch (err) {
      console.warn('[publisher] commitInboxState failed (non-fatal):', err.message);
    }
    return;
  }

  // Railway mode: no local .git — clone dev, copy state files, commit, push
  if (!gitToken) {
    console.warn('[publisher] commitInboxState: GIT_TOKEN not set, skipping');
    return;
  }

  const tempDir = join(tmpdir(), `inbox-state-${Date.now()}`);
  try {
    execSync(`git clone --depth=1 -b ${branch} "https://${gitToken}@github.com/${repo}.git" "${tempDir}"`, { stdio: 'pipe' });

    for (const f of STATE_FILES_REL) {
      const src = join(portalDir, f);
      const dst = join(tempDir, f);
      if (existsSync(src)) copyFileSync(src, dst);
    }

    const pushed = _commit(tempDir);
    if (pushed) console.log('[publisher] Inbox state committed to git (dev) via Railway clone');
  } catch (err) {
    console.warn('[publisher] commitInboxState Railway mode failed (non-fatal):', err.message);
  } finally {
    try { execSync(`rm -rf "${tempDir}"`, { stdio: 'pipe' }); } catch (_) {}
  }
}

export function commitAndPush({ ids, send, branch = 'main' }) {
  const gitToken = process.env.GIT_TOKEN;
  const repo    = process.env.GITHUB_REPO || 'CuriosityAIAgent/living-intelligence';

  // ── Local mode: PORTAL_DIR is set or a .git repo exists two levels up ────────
  const defaultPortalDir = join(__dirname, '..', '..');
  const explicitPortalDir = process.env.PORTAL_DIR;
  const portalDir = explicitPortalDir || defaultPortalDir;
  const hasGitRepo = existsSync(join(portalDir, '.git'));

  if (hasGitRepo) {
    // Standard local git workflow (also runs on Railway — .git dir is present in deployed container)
    try {
      // safe.directory: newer git (2.35.2+) rejects repos owned by a different user (common in Docker)
      execSync(`git config --global --add safe.directory "${portalDir}"`, { stdio: 'pipe' });
      // Configure identity — required on Railway where no global git user is set
      execSync(`git -C "${portalDir}" config user.email "intake-bot@portal.ai"`, { stdio: 'pipe' });
      execSync(`git -C "${portalDir}" config user.name "AI Portal Intake"`, { stdio: 'pipe' });

      if (gitToken) {
        const remoteUrl = `https://${gitToken}@github.com/${repo}.git`;
        execSync(`git -C "${portalDir}" remote set-url origin "${remoteUrl}"`, { stdio: 'pipe' });
      }

      send('status', { message: 'Staging files...' });
      execSync(`git -C "${portalDir}" add data/intelligence/`, { stdio: 'pipe' });

      const msg = ids.length === 1
        ? `Add intelligence entry: ${ids[0]}`
        : `Add ${ids.length} intelligence entries via intake pipeline`;

      send('status', { message: 'Committing...' });
      execSync(
        `git -C "${portalDir}" commit -m "${msg}\n\nCo-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"`,
        { stdio: 'pipe' }
      );

      send('status', { message: `Pushing to GitHub (${branch})...` });
      execSync(`git -C "${portalDir}" push origin ${branch}`, { stdio: 'pipe' });
      send('pushed', { message: `Pushed ${ids.length} entries to GitHub (${branch} branch)` });
    } catch (err) {
      send('error', { message: `Git operation failed: ${err.message}` });
    }
    return;
  }

  // ── Railway mode: no local git repo — clone, copy files, commit, push ────────
  if (!gitToken) {
    send('error', { message: 'GIT_TOKEN is required on Railway to push entries to GitHub' });
    return;
  }

  const tempDir = join(tmpdir(), `portal-push-${Date.now()}`);
  try {
    const cloneUrl = `https://${gitToken}@github.com/${repo}.git`;

    send('status', { message: 'Cloning portal repo...' });
    execSync(`git clone --depth=1 -b ${branch} "${cloneUrl}" "${tempDir}"`, { stdio: 'pipe' });

    // Configure git identity for the commit
    execSync(`git -C "${tempDir}" config user.email "intake-bot@portal.ai"`, { stdio: 'pipe' });
    execSync(`git -C "${tempDir}" config user.name "AI Portal Intake"`, { stdio: 'pipe' });

    // Copy the published entry files into the cloned repo
    const targetDir = join(tempDir, 'data', 'intelligence');
    mkdirSync(targetDir, { recursive: true });

    for (const id of ids) {
      const src = join(PORTAL_DATA_DIR, `${id}.json`);
      const dst = join(targetDir, `${id}.json`);
      if (existsSync(src)) {
        copyFileSync(src, dst);
      }
    }

    send('status', { message: 'Staging files...' });
    execSync(`git -C "${tempDir}" add data/intelligence/`, { stdio: 'pipe' });

    const msg = ids.length === 1
      ? `Add intelligence entry: ${ids[0]}`
      : `Add ${ids.length} intelligence entries via intake pipeline`;

    send('status', { message: 'Committing...' });
    execSync(
      `git -C "${tempDir}" commit -m "${msg}\n\nCo-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"`,
      { stdio: 'pipe' }
    );

    send('status', { message: `Pushing to GitHub (${branch})...` });
    execSync(`git -C "${tempDir}" push origin ${branch}`, { stdio: 'pipe' });

    send('pushed', { message: `Pushed ${ids.length} entries to GitHub (${branch} branch)` });
  } catch (err) {
    send('error', { message: `Git operation failed: ${err.message}` });
  } finally {
    // Clean up temp clone
    try { execSync(`rm -rf "${tempDir}"`, { stdio: 'pipe' }); } catch (_) {}
  }
}
