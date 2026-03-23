#!/usr/bin/env node
/**
 * fetch-logos.js
 * Downloads official company logos via DataForSEO image search.
 * Saves to living-intelligence/public/logos/[slug].[ext]
 * Updates all matching data/intelligence/*.json with image_url = /logos/[slug].[ext]
 */

import 'dotenv/config';
import fetch from 'node-fetch';
import { readdirSync, readFileSync, writeFileSync, createWriteStream, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { pipeline } from 'stream/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR   = join(__dirname, '..', '..', 'living-intelligence', 'data', 'intelligence');
const LOGOS_DIR  = join(__dirname, '..', '..', 'living-intelligence', 'public', 'logos');

const AUTH = Buffer.from(
  `${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`
).toString('base64');

// ─── Company list ─────────────────────────────────────────────────────────────
const COMPANIES = [
  { slug: 'altruist',           query: 'Altruist RIA custodian logo transparent PNG' },
  { slug: 'arta-finance',       query: 'Arta Finance logo transparent PNG' },
  { slug: 'betterment',         query: 'Betterment investing logo transparent PNG' },
  { slug: 'blackrock',          query: 'BlackRock asset management logo transparent PNG' },
  { slug: 'bofa-merrill',       query: 'Bank of America Merrill Lynch logo PNG' },
  { slug: 'charles-schwab',     query: 'Charles Schwab logo transparent PNG' },
  { slug: 'dbs',                query: 'DBS Bank Singapore logo transparent PNG' },
  { slug: 'farther',            query: 'Farther wealth management logo transparent PNG' },
  { slug: 'franklin-templeton', query: 'Franklin Templeton investments logo transparent PNG' },
  { slug: 'goldman-sachs',      query: 'Goldman Sachs logo transparent PNG' },
  { slug: 'hsbc',               query: 'HSBC bank logo transparent PNG' },
  { slug: 'lpl-financial',      query: 'LPL Financial logo transparent PNG' },
  { slug: 'morgan-stanley',     query: 'Morgan Stanley logo transparent PNG' },
  { slug: 'robinhood',          query: 'Robinhood app logo transparent PNG' },
  { slug: 'savvy-wealth',       query: 'Savvy Wealth advisor logo transparent PNG' },
  { slug: 'ubs',                query: 'UBS bank logo transparent PNG' },
  { slug: 'vanguard',           query: 'Vanguard investments logo transparent PNG' },
  { slug: 'wealthfront',        query: 'Wealthfront robo advisor logo transparent PNG' },
  { slug: 'public-com',         query: 'Public.com investing app logo transparent PNG' },
  { slug: 'etoro',              query: 'eToro trading platform logo transparent PNG' },
  { slug: 'webull',             query: 'Webull trading app logo transparent PNG' },
  { slug: 'citigroup',          query: 'Citigroup Citi bank logo transparent PNG' },
  { slug: 'fnz',                query: 'FNZ wealthtech platform logo transparent PNG' },
  { slug: 'fidelity',           query: 'Fidelity Investments logo transparent PNG' },
];

// Entries that use a different company slug but map to a canonical one
const ALIAS = {
  'arta-ai': 'arta-finance',
};

const BLOCKLIST = ['shutterstock', 'getty', 'istockphoto', 'alamy', 'dreamstime', 'pinterest', 'adobe'];

// ─── DataForSEO image search ──────────────────────────────────────────────────
async function findLogoUrl(query) {
  const res = await fetch('https://api.dataforseo.com/v3/serp/google/images/live/advanced', {
    method: 'POST',
    headers: { 'Authorization': `Basic ${AUTH}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([{ keyword: query, language_code: 'en', location_code: 2840, depth: 10 }]),
  });
  const data = await res.json();
  const items = (data?.tasks?.[0]?.result?.[0]?.items || [])
    .filter(i => i.type === 'images_search' && i.source_url)
    .filter(i => !BLOCKLIST.some(b => (i.source_url || '').includes(b)));

  // Prefer SVG or PNG with "logo" in URL, from known logo CDNs or official domains
  const PREFER = ['logo', 'brand', 'press', 'media', 'corporate'];
  const scored = items.map(i => {
    const url = (i.source_url || '').toLowerCase();
    let score = 0;
    if (url.endsWith('.svg')) score += 10;
    if (url.endsWith('.png')) score += 5;
    if (PREFER.some(p => url.includes(p))) score += 3;
    if (url.includes('1000logos') || url.includes('seeklogo') || url.includes('brandslogos')) score += 2;
    return { url: i.source_url, score };
  }).sort((a, b) => b.score - a.score);

  return scored[0]?.url || null;
}

// ─── Download ─────────────────────────────────────────────────────────────────
async function download(url, basePath) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(15000),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const ct = res.headers.get('content-type') || '';
  const ext = ct.includes('svg') ? '.svg'
    : ct.includes('jpeg') || ct.includes('jpg') ? '.jpg'
    : ct.includes('webp') ? '.webp'
    : '.png';

  const dest = basePath + ext;
  await pipeline(res.body, createWriteStream(dest));
  return dest;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🖼  Fetching logos for ${COMPANIES.length} companies\n`);

  const slugToWebPath = {};

  for (const co of COMPANIES) {
    const base = join(LOGOS_DIR, co.slug);
    const existing = ['.svg', '.png', '.jpg', '.webp'].map(e => base + e).find(existsSync);

    if (existing) {
      const webPath = '/logos/' + existing.split('/logos/')[1];
      slugToWebPath[co.slug] = webPath;
      console.log(`  ✓ ${co.slug} — cached ${existing.split('/').pop()}`);
      continue;
    }

    process.stdout.write(`  ↓ ${co.slug}... `);
    try {
      const url = await findLogoUrl(co.query);
      if (!url) { console.log('no result'); continue; }

      const dest = await download(url, base);
      const webPath = '/logos/' + dest.split('/logos/')[1];
      slugToWebPath[co.slug] = webPath;
      console.log(`✅ ${dest.split('/').pop()} ← ${new URL(url).hostname}`);
    } catch (e) {
      console.log(`❌ ${e.message}`);
    }

    await new Promise(r => setTimeout(r, 600));
  }

  // ─── Update JSON entries ────────────────────────────────────────────────────
  console.log('\n📝 Updating JSON entries...\n');
  const files = readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));
  let updated = 0;

  for (const fname of files) {
    const fpath = join(DATA_DIR, fname);
    const entry = JSON.parse(readFileSync(fpath, 'utf-8'));
    const canonSlug = ALIAS[entry.company] || entry.company;
    const webPath = slugToWebPath[canonSlug];
    if (webPath) {
      entry.image_url = webPath;
      writeFileSync(fpath, JSON.stringify(entry, null, 2), 'utf-8');
      updated++;
      console.log(`  ✓ ${fname} → ${webPath}`);
    }
  }

  console.log(`\n✅ ${updated} entries updated. Logos in public/logos/\n`);
}

main().catch(console.error);
