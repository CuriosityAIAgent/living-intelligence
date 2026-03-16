import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
// When running inside the living-intelligence repo (locally or on Railway),
// data/ is two levels up from agents/. Override with DATA_DIR env var if needed.
const DATA_ROOT = process.env.DATA_DIR || join(__dirname, '..', '..');
const PORTAL_DATA_DIR = join(DATA_ROOT, 'data', 'intelligence');

export function publish({ entry, send }) {
  // Ensure target directory exists
  if (!existsSync(PORTAL_DATA_DIR)) {
    mkdirSync(PORTAL_DATA_DIR, { recursive: true });
  }

  // Fix 2: Ensure governance audit is stored inside the JSON file for full provenance.
  // Strip _governance from the top-level before writing — store it under a
  // dedicated key so portal rendering code never accidentally surfaces it.
  const { _governance, ...publicFields } = entry;
  const entryToWrite = {
    ...publicFields,
    // source_verified reflects actual governance outcome, not hardcoded true
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
  const portalDir = process.env.PORTAL_DIR || join(__dirname, '..', '..');

  try {
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

    // On Railway, configure remote with GITHUB_TOKEN for push access
    if (process.env.GITHUB_TOKEN) {
      const repo = process.env.GITHUB_REPO || 'CuriosityAIAgent/living-intelligence';
      const remoteUrl = `https://${process.env.GITHUB_TOKEN}@github.com/${repo}.git`;
      execSync(`git -C "${portalDir}" remote set-url origin "${remoteUrl}"`, { stdio: 'pipe' });
    }

    send('status', { message: `Pushing to GitHub (${branch})...` });
    execSync(`git -C "${portalDir}" push origin ${branch}`, { stdio: 'pipe' });

    send('pushed', { message: `Pushed ${ids.length} entries to GitHub (${branch} branch)` });
  } catch (err) {
    send('error', { message: `Git operation failed: ${err.message}` });
  }
}
