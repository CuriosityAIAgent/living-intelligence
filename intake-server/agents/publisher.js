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

export function publish({ entry, send }) {
  // Ensure target directory exists
  if (!existsSync(PORTAL_DATA_DIR)) {
    mkdirSync(PORTAL_DATA_DIR, { recursive: true });
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

export function commitAndPush({ ids, send, branch = 'dev' }) {
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
