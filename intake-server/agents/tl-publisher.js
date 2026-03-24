/**
 * tl-publisher.js
 *
 * Processes a TL candidate URL into a published thought-leadership entry.
 * Called from the Editorial Studio "Approve as TL" button.
 *
 * Flow:
 *   1. Fetch full article via Jina r.jina.ai
 *   2. Claude extracts all thought-leadership schema fields
 *   3. Quality gate: named author + extractable point of view required
 *   4. Write data/thought-leadership/{slug}.json
 *   5. Git commit + push to main → portal rebuilds
 */

import { writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import Anthropic from '@anthropic-ai/sdk';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_ROOT = process.env.DATA_DIR || join(__dirname, '..', '..');
const TL_DIR    = join(DATA_ROOT, 'data', 'thought-leadership');

const client = new Anthropic();

// ── Week start (Monday) ───────────────────────────────────────────────────────

function getWeekStart(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = d.getDay(); // 0 = Sun
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

// ── Slug generation ───────────────────────────────────────────────────────────

function makeSlug(authorName, title) {
  const lastName = (authorName || 'unknown').split(' ').pop().toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  const titleSlug = (title || 'piece').toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 5)
    .join('-');
  return `${lastName}-${titleSlug}`;
}

// ── Fetch via Jina ────────────────────────────────────────────────────────────

async function fetchContent(url) {
  const jinaUrl = `https://r.jina.ai/${encodeURIComponent(url)}`;
  const headers  = { 'Accept': 'text/plain' };
  if (process.env.JINA_API_KEY) headers['Authorization'] = `Bearer ${process.env.JINA_API_KEY}`;

  const res = await fetch(jinaUrl, { headers });
  if (!res.ok) throw new Error(`Jina fetch failed: ${res.status} ${res.statusText}`);
  const text = await res.text();
  if (text.length < 200) throw new Error('Fetched content too short — URL may be inaccessible');
  return text.slice(0, 12000); // cap for Claude context
}

// ── Claude extraction ─────────────────────────────────────────────────────────

const SYSTEM = `You extract structured metadata from thought leadership essays and reports for a premium wealth management intelligence platform.
The audience is C-suite executives. Quality bar is high: this must be a substantial piece with a named author and a genuine point of view.
Return valid JSON only — no markdown fences, no commentary.`;

const EXTRACTION_PROMPT = (url, content) => `URL: ${url}

ARTICLE CONTENT:
${content}

Extract the following fields and return as JSON. If a field cannot be determined from the content, use null.

{
  "title": "exact article title",
  "author_name": "full name of the primary author (null if staff/editorial/unnamed)",
  "author_title": "job title or role of the author",
  "author_organization": "organization the author is affiliated with",
  "publication": "name of the publication or platform where this was published",
  "date_published": "YYYY-MM-DD — publication date",
  "format": "essay | report | speech | interview | research",
  "executive_summary": [
    "insight sentence 1 — complete, standalone sentence conveying a key idea",
    "insight sentence 2",
    "insight sentence 3",
    "insight sentence 4"
  ],
  "the_one_insight": "single sentence — the most provocative, memorable core argument of the piece (not a summary — a provocation)",
  "key_quotes": [
    { "text": "verbatim quote from the article", "context": "one-line context for why this quote matters" }
  ],
  "tags": ["tag1", "tag2"],
  "has_document": false,
  "document_url": null
}

Tags must come from this vocabulary only (pick 2–5 that apply):
leadership, management, future_of_work, org_design, agentic_ai, client_experience, investment_management, wealth_management, regulation, trust, talent, strategy, economics, technology

Key rule: the_one_insight must be the CORE ARGUMENT — something a CEO would quote in a board meeting. Not a summary. If you cannot identify a clear distinctive argument, return null for this field.`;

// ── Main export ───────────────────────────────────────────────────────────────

export async function publishTlEntry({ url, send }) {
  // 1. Fetch
  send('status', { message: 'Fetching article...' });
  let content;
  try {
    content = await fetchContent(url);
  } catch (err) {
    throw new Error(`Could not fetch article: ${err.message}`);
  }

  // 2. Extract
  send('status', { message: 'Extracting metadata...' });
  let extracted;
  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      system: SYSTEM,
      messages: [{ role: 'user', content: EXTRACTION_PROMPT(url, content) }],
    });
    extracted = JSON.parse(response.content[0].text.trim()
      .replace(/^```json\n?/, '').replace(/\n?```$/, ''));
  } catch (err) {
    throw new Error(`Extraction failed: ${err.message}`);
  }

  // 3. Quality gate
  // author_name may be null for institutional/multi-author reports — fall back to organization
  const resolvedAuthor = extracted.author_name || extracted.author_organization || null;
  if (!resolvedAuthor) {
    throw new Error('Quality gate: no author or organization found — review manually');
  }
  if (!extracted.the_one_insight) {
    throw new Error('Quality gate: could not extract a clear point of view — review manually');
  }
  if (!extracted.date_published) {
    throw new Error('Quality gate: could not determine publication date — review manually');
  }

  // 4. Build entry
  const slug = makeSlug(resolvedAuthor, extracted.title);
  const filepath = join(TL_DIR, `${slug}.json`);

  // Prevent overwriting existing entries
  if (existsSync(filepath)) {
    throw new Error(`Entry already exists: ${slug} — may be a duplicate`);
  }

  const entry = {
    id:             slug,
    type:           extracted.format || 'essay',
    title:          extracted.title,
    author: {
      name:         resolvedAuthor,
      title:        extracted.author_title || null,
      organization: extracted.author_organization || null,
      photo_url:    null,
    },
    publication:    extracted.publication || null,
    source_url:     url,
    date_published: extracted.date_published,
    format:         extracted.format || 'essay',
    executive_summary: extracted.executive_summary || [],
    the_one_insight: extracted.the_one_insight,
    key_quotes:     extracted.key_quotes || [],
    tags:           extracted.tags || [],
    week:           getWeekStart(extracted.date_published),
    featured:       false,
    has_document:   extracted.has_document || false,
    document_url:   extracted.document_url || null,
  };

  // 5. Write
  send('status', { message: `Writing: ${slug}.json` });
  writeFileSync(filepath, JSON.stringify(entry, null, 2), 'utf-8');

  // 6. Git commit + push
  send('status', { message: 'Pushing to GitHub...' });
  _commitAndPush({ filepath, slug, send });

  send('published', { id: slug, title: entry.title, author: entry.author.name });
  return slug;
}

// ── Git ───────────────────────────────────────────────────────────────────────

function _commitAndPush({ filepath, slug, send }) {
  const gitToken  = process.env.GIT_TOKEN;
  const repo      = process.env.GITHUB_REPO || 'CuriosityAIAgent/living-intelligence';
  const portalDir = process.env.PORTAL_DIR  || join(__dirname, '..', '..');

  try {
    execSync(`git config --global --add safe.directory "${portalDir}"`, { stdio: 'pipe' });
    execSync(`git -C "${portalDir}" config user.email "intake-bot@portal.ai"`, { stdio: 'pipe' });
    execSync(`git -C "${portalDir}" config user.name "AI Portal Intake"`, { stdio: 'pipe' });

    if (gitToken) {
      execSync(
        `git -C "${portalDir}" remote set-url origin "https://${gitToken}@github.com/${repo}.git"`,
        { stdio: 'pipe' }
      );
    }

    execSync(`git -C "${portalDir}" add "${filepath}"`, { stdio: 'pipe' });
    execSync(
      `git -C "${portalDir}" commit -m "Add thought leadership: ${slug}\n\nCo-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"`,
      { stdio: 'pipe' }
    );
    execSync(`git -C "${portalDir}" push origin main`, { stdio: 'pipe' });
    send('pushed', { message: `Published to portal: ${slug}` });
  } catch (err) {
    send('error', { message: `Published locally but git push failed: ${err.message}` });
  }
}
