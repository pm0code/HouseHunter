/**
 * Orchestrates all rental scrapers.
 * Usage: npm run scrape
 *        npm run scrape:craigslist   (single source)
 */

import 'dotenv/config';
import { scrapeCraigslist } from './craigslist';
import { scrapeSpareRoom } from './spareroom';
import { scrapeCozyCozy } from './cozycozy';
import { scrapeLeaseBreak } from './leasebreak';
import { scrapeRentHop } from './renthop';

const SOURCE_ARG = process.argv[2]; // e.g. "craigslist"

const ALL_SCRAPERS: Array<{ name: string; fn: () => Promise<number> }> = [
  { name: 'craigslist', fn: scrapeCraigslist },
  { name: 'spareroom',  fn: scrapeSpareRoom },
  { name: 'cozycozy',   fn: scrapeCozyCozy },
  { name: 'leasebreak', fn: scrapeLeaseBreak },
  { name: 'renthop',    fn: scrapeRentHop },
];

async function main() {
  const scrapers = SOURCE_ARG
    ? ALL_SCRAPERS.filter((s) => s.name === SOURCE_ARG.toLowerCase())
    : ALL_SCRAPERS;

  if (scrapers.length === 0) {
    console.error(`Unknown source: ${SOURCE_ARG}. Valid: ${ALL_SCRAPERS.map((s) => s.name).join(', ')}`);
    process.exit(1);
  }

  console.log(`HouseHunter Scraper — running ${scrapers.length} source(s)`);
  console.log('='.repeat(60));

  const results: Record<string, number> = {};

  for (const { name, fn } of scrapers) {
    try {
      results[name] = await fn();
    } catch (err) {
      console.error(`\n[${name}] Fatal error:`, err);
      results[name] = 0;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('Summary:');
  let total = 0;
  for (const [name, count] of Object.entries(results)) {
    console.log(`  ${name.padEnd(14)} ${count} new listings`);
    total += count;
  }
  console.log(`  ${'TOTAL'.padEnd(14)} ${total} new listings`);
  console.log('='.repeat(60));

  process.exit(0);
}

main().catch((err) => {
  console.error('Orchestrator error:', err);
  process.exit(1);
});
