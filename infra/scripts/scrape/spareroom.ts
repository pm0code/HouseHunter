/**
 * Scrapes furnished/short-term room listings from SpareRoom.
 * Target: https://www.spareroom.com/rooms-for-rent/new_york/brooklyn
 * 750+ listings; paginates at 10/page.
 */

import { parse } from 'node-html-parser';
import { insertScrapedListing, sleep, today, sixMonthsFromNow, inferUnitType, type ScrapedListing } from './lib/enrich';

const BASE = 'https://www.spareroom.com';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://www.spareroom.com/',
};

// Brooklyn bounding box
const BK = { latMin: 40.57, latMax: 40.74, lonMin: -74.05, lonMax: -73.83 };

// Scrape up to MAX_PAGES search result pages (10 listings each)
const MAX_PAGES = 5;

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

async function getListingUrlsFromPage(pageUrl: string): Promise<string[]> {
  let html: string;
  try {
    html = await fetchHtml(pageUrl);
  } catch (e) {
    console.warn(`  ! Failed to fetch ${pageUrl}: ${e}`);
    return [];
  }

  // Listing links: /rooms-for-rent/brooklyn/{neighborhood}/{id}?listing_click=1
  const regex = /href="(\/rooms-for-rent\/brooklyn\/[^"/]+\/\d+)[^"]*"/g;
  const urls: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(html)) !== null) {
    const full = `${BASE}${m[1]}`;
    if (!urls.includes(full)) urls.push(full);
  }
  return urls;
}

async function scrapeListingPage(url: string): Promise<ScrapedListing | null> {
  let html: string;
  try {
    html = await fetchHtml(url);
  } catch (e) {
    console.warn(`    ! Failed to fetch ${url}: ${e}`);
    return null;
  }

  // Coordinates — embedded in JS: location: {latitude: "40.xxx", longitude: "-73.xxx"}
  const latMatch = html.match(/latitude['":\s]+"?(-?\d+\.\d+)/i);
  const lonMatch = html.match(/longitude['":\s]+"?(-?\d+\.\d+)/i);
  if (!latMatch || !lonMatch) return null;
  const lat = parseFloat(latMatch[1]);
  const lon = parseFloat(lonMatch[1]);
  if (isNaN(lat) || isNaN(lon)) return null;
  if (lat < BK.latMin || lat > BK.latMax || lon < BK.lonMin || lon > BK.lonMax) return null;

  // Price — appears as "&#36;995 monthly" in meta og:description and body text
  const priceMatch = html.match(/&#36;([\d,]+)\s*(?:monthly|\/month|\/mo)/i)
    ?? html.match(/\$\s*([\d,]+)\s*(?:monthly|\/month|\/mo)/i);
  if (!priceMatch) return null;
  const pricePerMonth = parseInt(priceMatch[1].replace(/,/g, ''), 10);
  if (pricePerMonth < 200 || pricePerMonth > 15000) return null;

  // Title — <h1>Furnished Room on Macdonald Avenue Brooklyn</h1>
  const root = parse(html);
  const titleEl = root.querySelector('h1');
  const title = (titleEl?.text ?? '').trim();

  // Address — use title + neighborhood from URL
  const neighborhoodMatch = url.match(/\/rooms-for-rent\/brooklyn\/([^/]+)\//);
  const neighborhood = (neighborhoodMatch?.[1] ?? 'brooklyn').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const address = title ? `${title}, ${neighborhood}, Brooklyn, NY` : `${neighborhood}, Brooklyn, NY`;

  // Photos — <a href="https://photos.spareroom.com/images/flatshare/listings/large/...">
  const photoLinks = html.match(/href="(https:\/\/photos\.spareroom\.com\/images\/flatshare\/listings\/large\/[^"]+)"/g) ?? [];
  const photos = [...new Set(photoLinks
    .map((h) => h.slice(6, -1)) // strip href=" and "
    .filter((u) => !u.includes('assets.spareroom'))
  )].slice(0, 8);

  // Utilities included? body mentions "inc utilities" or "bills included"
  const utilitiesIncluded: 'yes' | 'no' | 'partial' =
    html.toLowerCase().includes('inc util') || html.toLowerCase().includes('bills included') ? 'yes'
    : html.toLowerCase().includes('bills not') ? 'no'
    : 'partial';

  return {
    address,
    unitType: inferUnitType(title),
    furnished: true, // SpareRoom furnished filter
    availableFrom: today(),
    availableTo: sixMonthsFromNow(),
    pricePerMonth,
    utilitiesIncluded,
    brokerFee: false,
    securityDeposit: 0,
    photos,
    sourceUrl: url,
    sourceName: 'SpareRoom',
    lat,
    lon,
    sqft: null,
  };
}

export async function scrapeSpareRoom(): Promise<number> {
  console.log('\n[SpareRoom] Starting scrape...');
  let inserted = 0;

  for (let page = 1; page <= MAX_PAGES; page++) {
    const pageUrl = page === 1
      ? `${BASE}/rooms-for-rent/new_york/brooklyn`
      : `${BASE}/rooms-for-rent/new_york/brooklyn/page${page}`;

    console.log(`  Fetching page ${page}: ${pageUrl}`);
    const urls = await getListingUrlsFromPage(pageUrl);
    console.log(`  Found ${urls.length} listings`);

    if (urls.length === 0) break;

    for (const url of urls) {
      await sleep(2000 + Math.random() * 1000);
      const scraped = await scrapeListingPage(url);
      if (!scraped) continue;
      const ok = await insertScrapedListing(scraped);
      if (ok) inserted++;
    }

    await sleep(3000);
  }

  console.log(`[SpareRoom] Done — ${inserted} new listings inserted.`);
  return inserted;
}
