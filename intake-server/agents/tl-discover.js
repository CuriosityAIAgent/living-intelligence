import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { TL_DIR, STATE_DIR } from './config.js';

const TL_CANDIDATES_FILE = join(STATE_DIR, '.tl-candidates.json');

const JINA_KEY = process.env.JINA_API_KEY;

const TL_QUERIES = [
  'AI wealth management thought leadership essay 2026',
  'AI financial advisor future of work implications',
  'generative AI investment management strategy 2026',
  'artificial intelligence finance executive perspective 2026',
  'AI agentic wealth management white paper report 2026',
];

function loadPublishedUrls() {
  try {
    const files = readdirSync(TL_DIR).filter(f => f.endsWith('.json'));
    const urls = new Set();
    files.forEach(f => {
      try {
        const e = JSON.parse(readFileSync(join(TL_DIR, f), 'utf8'));
        if (e.source_url) urls.add(e.source_url);
      } catch {}
    });
    return urls;
  } catch { return new Set(); }
}

export function loadCandidates() {
  if (!existsSync(TL_CANDIDATES_FILE)) return [];
  try { return JSON.parse(readFileSync(TL_CANDIDATES_FILE, 'utf8')); } catch { return []; }
}

function saveCandidates(candidates) {
  writeFileSync(TL_CANDIDATES_FILE, JSON.stringify(candidates, null, 2));
}

function getKnownAuthors() {
  try {
    const files = readdirSync(TL_DIR).filter(f => f.endsWith('.json'));
    const authors = [];
    files.forEach(f => {
      try {
        const e = JSON.parse(readFileSync(join(TL_DIR, f), 'utf8'));
        if (e.author?.name) authors.push(e.author.name);
      } catch {}
    });
    return [...new Set(authors)];
  } catch { return []; }
}

async function jinaSearch(query) {
  const res = await fetch(`https://s.jina.ai/${encodeURIComponent(query)}`, {
    headers: {
      'Authorization': `Bearer ${JINA_KEY}`,
      'Accept': 'application/json',
      'X-Return-Format': 'json',
    }
  });
  if (!res.ok) return [];
  try {
    const json = await res.json();
    // Jina search JSON returns { data: [{ url, title, ... }] }
    return (json.data || []).slice(0, 5).map(r => ({
      url: r.url,
      title: r.title,
      date: r.publishedTime || null,
    }));
  } catch {
    // Fallback: parse markdown for URLs
    const text = await res.text().catch(() => '');
    const results = [];
    const urlMatches = text.matchAll(/URL: (https?:\/\/[^\s]+)/g);
    for (const m of urlMatches) results.push({ url: m[1] });
    return results.slice(0, 5);
  }
}

export async function runTLDiscover({ send }) {
  send('status', { message: 'Starting TL discovery…' });

  const publishedUrls = loadPublishedUrls();
  const existingCandidates = loadCandidates();
  const existingUrls = new Set(existingCandidates.map(c => c.url));

  const newCandidates = [];

  // L1: broad TL queries
  for (const query of TL_QUERIES) {
    send('status', { message: `Searching: ${query}` });
    try {
      const results = await jinaSearch(query);
      for (const r of results) {
        if (!publishedUrls.has(r.url) && !existingUrls.has(r.url)) {
          newCandidates.push({
            url: r.url,
            title: r.title || null,
            date: r.date || null,
            discovered_at: new Date().toISOString(),
            via: 'l1_tl',
          });
          existingUrls.add(r.url);
        }
      }
    } catch(e) {
      send('status', { message: `Error: ${e.message}` });
    }
  }

  // L2: known authors
  const authors = getKnownAuthors();
  for (const author of authors) {
    const query = `${author} essay AI 2026`;
    send('status', { message: `Searching author: ${author}` });
    try {
      const results = await jinaSearch(query);
      for (const r of results) {
        if (!publishedUrls.has(r.url) && !existingUrls.has(r.url)) {
          newCandidates.push({
            url: r.url,
            title: r.title || null,
            date: r.date || null,
            author: author,
            discovered_at: new Date().toISOString(),
            via: 'l2_authors',
          });
          existingUrls.add(r.url);
        }
      }
    } catch {}
  }

  // Merge: new first, then existing, cap at 50
  const merged = [...newCandidates, ...existingCandidates].slice(0, 50);
  saveCandidates(merged);

  send('done', { found: newCandidates.length });
}

export function getTLCandidates() {
  return loadCandidates();
}

export function dismissTLCandidate(url) {
  const candidates = loadCandidates();
  saveCandidates(candidates.filter(c => c.url !== url));
}
