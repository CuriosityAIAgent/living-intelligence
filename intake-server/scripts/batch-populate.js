#!/usr/bin/env node
/**
 * Batch populate script — processes a list of real article URLs through the intake pipeline
 * and publishes all approved entries to the portal data directory.
 *
 * Usage: node scripts/batch-populate.js
 */

import 'dotenv/config';
import fetch from 'node-fetch';

const INTAKE_SERVER = 'http://localhost:3003';

// ─── Real article URLs to process ────────────────────────────────────────────
const ARTICLES = [
  // BlackRock / Aladdin
  { url: 'https://www.businesswire.com/news/home/20251002577295/en/Aladdin-Wealth-Launches-AI-Enabled-Commentary-Tool-for-Wealth-Advisors-Morgan-Stanleys-Portfolio-Risk-Platform-First-to-Implement', source_name: 'Business Wire' },
  { url: 'https://www.businesswire.com/news/home/20240722553228/en/Franklin-Templeton-Selects-Aladdin-by-BlackRock-to-Unify-Its-Investment-Management-Technology', source_name: 'Business Wire' },

  // Altruist / Hazel
  { url: 'https://www.businesswire.com/news/home/20251118149396/en/Altruist-Debuts-Industry-First-Custodial-Integration-for-its-Transformative-AI-Platform-Hazel-Bringing-Real-Time-Account-Data-Into-Every-Advisor-Conversation', source_name: 'Business Wire' },
  { url: 'https://www.businesswire.com/news/home/20250422747275/en/Altruist-Raises-152M-Series-F-Led-by-GIC-to-Accelerate-Innovation-for-Growth-Oriented-RIAs', source_name: 'Business Wire' },

  // Arta Finance
  { url: 'https://www.prnewswire.com/news-releases/arta-finance-launches-arta-ai-private-wealth-guided-by-ai-302418182.html', source_name: 'PR Newswire' },
  { url: 'https://www.prnewswire.com/news-releases/arta-announces-expansion-of-arta-ai-aiming-to-empower-every-financial-advisor-and-wealth-manager-with-an-ai-sidekick-onboards-new-institutional-customers-302605798.html', source_name: 'PR Newswire' },

  // Savvy Wealth & Farther (AI-native startups)
  { url: 'https://www.businesswire.com/news/home/20250702795194/en/Savvy-Wealth-Raises-72-Million-to-Drive-the-Shift-Toward-AI-Augmented-Human-Centered-Financial-Advice', source_name: 'Business Wire' },
  { url: 'https://www.prnewswire.com/news-releases/farther-secures-72-million-series-c-from-capitalg-and-viewpoint-ventures-to-continue-revolutionizing-wealth-management-302273094.html', source_name: 'PR Newswire' },

  // JPMorgan LLM Suite
  { url: 'https://www.cnbc.com/2024/08/09/jpmorgan-chase-ai-artificial-intelligence-assistant-chatgpt-openai.html', source_name: 'CNBC' },

  // Vanguard
  { url: 'https://www.prnewswire.com/news-releases/vanguard-unveils-generative-ai-client-summaries-for-financial-advisors-302445980.html', source_name: 'PR Newswire' },

  // DBS
  { url: 'https://www.prnewswire.com/apac/news-releases/dbs-named-worlds-best-ai-bank-302584742.html', source_name: 'PR Newswire' },
  { url: 'https://www.cnbc.com/2025/11/14/ceo-southeast-asias-top-bank-dbs-says-ai-adoption-already-paying-off.html', source_name: 'CNBC' },

  // HSBC Wealth Intelligence
  { url: 'https://www.privatebanking.hsbc.com/media-releases-and-news/hsbc-deploys-wealth-intelligence/', source_name: 'HSBC Private Bank' },
  { url: 'https://fintech.global/2025/09/18/hsbc-launches-ai-powered-wealth-intelligence-platform/', source_name: 'Fintech Global' },

  // UBS Chief AI Officer
  { url: 'https://www.ubs.com/global/en/media/display-page-ndp/en-20251016-ai-strategy.html', source_name: 'UBS' },

  // LPL / Anthropic
  { url: 'https://www.globenewswire.com/news-release/2024/11/12/2979276/29579/en/LPL-Financial-Launches-Curated-AI-Solutions-for-Advisors.html', source_name: 'GlobeNewswire' },

  // Betterment AI
  { url: 'https://www.prnewswire.com/news-releases/betterment-launches-ai-enabled-account-recommender-advancing-enterprise-ai-strategy-302707654.html', source_name: 'PR Newswire' },

  // Robinhood Cortex
  { url: 'https://robinhood.com/us/en/newsroom/introducing-strategies-banking-and-cortex/', source_name: 'Robinhood Newsroom' },

  // Morgan Stanley — GenAI suite + AskResearchGPT
  { url: 'https://www.businesswire.com/news/home/20240625048568/en/Morgan-Stanley-Wealth-Management-Announces-Latest-Game-Changing-Addition-to-Suite-of-GenAI-Tools', source_name: 'Business Wire' },
  { url: 'https://www.morganstanley.com/press-releases/morgan-stanley-research-announces-askresearchgpt', source_name: 'Morgan Stanley' },

  // Goldman Sachs AI assistant
  { url: 'https://www.cnbc.com/2025/01/21/goldman-sachs-launches-ai-assistant.html', source_name: 'CNBC' },

  // Robinhood Cortex + Hood Summit
  { url: 'https://robinhood.com/us/en/newsroom/hood-summit-2025-news/', source_name: 'Robinhood Newsroom' },

  // Schwab
  { url: 'https://pressroom.aboutschwab.com/press-releases/press-release/2025/Schwabs-2025-Independent-Advisor-Outlook-Study-Trust-Talent-and-Technology-Shaping-the-Next-Era-of-Independent-Advice/default.aspx', source_name: 'Charles Schwab' },
];

// ─── SSE parser ───────────────────────────────────────────────────────────────

async function processUrl(url, source_name) {
  return new Promise((resolve, reject) => {
    fetch(`${INTAKE_SERVER}/api/process-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, source_name }),
    }).then(res => {
      let result = null;
      let buffer = '';

      res.body.on('data', chunk => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep incomplete line

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            // skip
          } else if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.entry && data.governance) {
                result = data; // 'complete' event
              }
              if (data.message && !data.entry) {
                process.stdout.write('  · ' + (data.message || data.verdict || '') + '\n');
              }
            } catch {}
          }
        }
      });

      res.body.on('end', () => resolve(result));
      res.body.on('error', reject);
    }).catch(reject);
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🔄 Batch populate — processing ${ARTICLES.length} articles\n`);
  console.log('='.repeat(60));

  const approved = [];
  const skipped = [];
  const failed = [];

  for (let i = 0; i < ARTICLES.length; i++) {
    const { url, source_name } = ARTICLES[i];
    const shortUrl = url.replace(/^https?:\/\//, '').slice(0, 70);

    console.log(`\n[${i + 1}/${ARTICLES.length}] ${shortUrl}`);

    try {
      const result = await processUrl(url, source_name);

      if (!result) {
        console.log(`  ⊘ Skipped (no AI/wealth management content)`);
        skipped.push(url);
        continue;
      }

      const { entry, governance, can_publish } = result;
      const verdict = governance?.verdict || 'UNKNOWN';
      const icon = verdict === 'PASS' ? '✅' : verdict === 'REVIEW' ? '⚠️' : '❌';

      console.log(`  ${icon} ${verdict} — "${entry.headline?.slice(0, 70)}"`);

      if (can_publish) {
        approved.push(entry);
      } else {
        console.log(`  ❌ BLOCKED — fabricated claims detected`);
        failed.push({ url, entry, governance });
      }
    } catch (err) {
      console.log(`  ✗ Error: ${err.message}`);
      skipped.push(url);
    }

    // Small delay between requests to avoid rate limiting
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log('\n' + '='.repeat(60));
  console.log(`\n📊 Results: ${approved.length} approved, ${skipped.length} skipped, ${failed.length} blocked\n`);

  if (approved.length === 0) {
    console.log('Nothing to publish.');
    return;
  }

  // Publish all approved entries
  console.log(`📤 Publishing ${approved.length} entries to portal...\n`);

  const publishRes = await fetch(`${INTAKE_SERVER}/api/publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entries: approved }),
  });

  let publishBuffer = '';
  publishRes.body.on('data', chunk => {
    publishBuffer += chunk.toString();
    const lines = publishBuffer.split('\n');
    publishBuffer = lines.pop();
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6));
          if (data.message) console.log('  · ' + data.message);
          if (data.id) console.log(`  ✓ Published: ${data.id}`);
        } catch {}
      }
    }
  });

  await new Promise(resolve => publishRes.body.on('end', resolve));

  console.log('\n✅ Done!\n');
}

main().catch(console.error);
