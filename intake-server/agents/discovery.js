import Parser from 'rss-parser';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Anthropic from '@anthropic-ai/sdk';

const __dirname = dirname(fileURLToPath(import.meta.url));
const parser = new Parser({ timeout: 10000 });
const client = new Anthropic();

// Gate 1: must have at least one AI/tech keyword
const AI_KEYWORDS = [
  'AI', 'artificial intelligence', 'machine learning', 'generative AI', 'GenAI', 'LLM',
  'large language model', 'chatbot', 'OpenAI', 'Anthropic', 'Claude', 'GPT', 'Copilot',
  'automation', 'agentic', 'autonomous agent', 'natural language', 'neural network',
  'predictive analytics', 'algorithm', 'robo-advisor', 'wealthtech',
];

// Gate 2: must have at least one wealth management / financial services keyword
const WEALTH_KEYWORDS = [
  'wealth management', 'financial advisor', 'financial adviser', 'RIA', 'asset management',
  'private banking', 'family office', 'fintech', 'investment management', 'portfolio',
  'advisor', 'adviser', 'brokerage', 'retirement', 'financial planning',
  'Morgan Stanley', 'Goldman Sachs', 'UBS', 'Merrill Lynch', 'Merrill',
  'Schwab', 'Fidelity', 'BlackRock', 'Vanguard', 'LPL Financial', 'LPL',
  'Raymond James', 'Edward Jones', 'DBS', 'HSBC', 'JPMorgan', 'Wells Fargo', 'Citi',
  'Altruist', 'Wealthfront', 'Betterment', 'Robinhood', 'Arta', 'Addepar',
];

function isRelevant(item) {
  const text = `${item.title || ''} ${item.contentSnippet || ''} ${item.content || ''}`.toLowerCase();
  const hasAI = AI_KEYWORDS.some(kw => text.includes(kw.toLowerCase()));
  const hasWealth = WEALTH_KEYWORDS.some(kw => text.includes(kw.toLowerCase()));
  return hasAI && hasWealth;
}

export async function discover({ send }) {
  const feedsPath = join(__dirname, '..', 'rss-feeds.json');
  const feeds = JSON.parse(readFileSync(feedsPath, 'utf-8'));

  send('status', { message: `Scanning ${feeds.length} news feeds...` });

  const candidates = [];
  const errors = [];

  for (const feed of feeds) {
    try {
      send('status', { message: `Fetching ${feed.name}...` });
      const parsed = await parser.parseURL(feed.url);

      const relevant = parsed.items
        .filter(item => {
          // Only items from the last 7 days
          const pubDate = item.pubDate ? new Date(item.pubDate) : null;
          if (pubDate) {
            const ageMs = Date.now() - pubDate.getTime();
            if (ageMs > 7 * 24 * 60 * 60 * 1000) return false;
          }
          return isRelevant(item);
        })
        .slice(0, 5) // max 5 per feed
        .map(item => ({
          id: Buffer.from(item.link || item.title || '').toString('base64').slice(0, 12),
          title: item.title || 'Untitled',
          url: item.link || '',
          source_name: feed.name,
          source_feed: feed.id,
          pub_date: item.pubDate || null,
          snippet: (item.contentSnippet || item.summary || '').slice(0, 300),
          selected: true, // pre-selected for review
        }));

      candidates.push(...relevant);
      send('feed_done', { feed: feed.name, count: relevant.length });
    } catch (err) {
      errors.push({ feed: feed.name, error: err.message });
      send('feed_error', { feed: feed.name, error: err.message });
    }
  }

  // De-duplicate by URL
  const seen = new Set();
  const unique = candidates.filter(c => {
    if (!c.url || seen.has(c.url)) return false;
    seen.add(c.url);
    return true;
  });

  // Sort by pub_date desc
  unique.sort((a, b) => {
    const da = a.pub_date ? new Date(a.pub_date).getTime() : 0;
    const db = b.pub_date ? new Date(b.pub_date).getTime() : 0;
    return db - da;
  });

  send('done', {
    candidates: unique,
    total: unique.length,
    feeds_scanned: feeds.length,
    feeds_errored: errors.length,
  });
}
