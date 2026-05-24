/**
 * Scrapes NYC lease breaks and short-term sublets from LeaseBreak.
 * Target: https://www.leasebreak.com/short-term-rentals/Brooklyn
 */

import { parse } from 'node-html-parser';
import { insertScrapedListing, sleep, today, sixMonthsFromNow, inferUnitType, type ScrapedListing } from './lib/enrich';

const BASE = 'https://www.leasebreak.com';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://www.leasebreak.com/',
};

const SEARCH_PATHS = [
  '/short-term-rentals/Brooklyn',
  '/furnished-apartments/Brooklyn',
  '/sublets/Brooklyn',
];

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

function parsePrice(text: string): number | null {
  const m = text.match(/\$\s*([\d,]+)\s*\/?\s*(mo|month|monthly)?/i);
  if (!m) return null;
  return parseInt(m[1].replace(/,/g, ''), 10);
}

function parseSqft(text: string): number | null {
  const m = text.match(/(\d[\d,]*)\s*(?:ft²|sq\.?\s*ft|sqft)/i);
  if (!m) return null;
  return parseInt(m[1].replace(/,/g, ''), 10);
}

async function scrapeListingPage(url: string): Promise<ScrapedListing | null> {
  let html: string;
  try {
    html = await fetchHtml(url);
  } catch (e) {
    console.warn(`    ! Failed to fetch ${url}: ${e}`);
    return null;
  }

  const root = parse(html);

  // Coordinates from JSON-LD
  let lat: number | undefined;
  let lon: number | undefined;

  for (const script of root.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const data = JSON.parse(script.text);
      const objs = Array.isArray(data) ? data : [data];
      for (const obj of objs) {
        const geo = obj?.geo ?? obj?.location?.geo ?? obj?.address?.geo;
        if (geo?.latitude) {
          lat = parseFloat(String(geo.latitude));
          lon = parseFloat(String(geo.longitude));
          break;
        }
      }
    } catch { /* ignore */ }
    if (lat) break;
  }

  // Fallback: data attributes on map container
  if (!lat) {
    const mapEl = root.querySelector('[data-lat], [data-latitude], [data-lng], [id*="map"]');
    if (mapEl) {
      lat = parseFloat(mapEl.getAttribute('data-lat') ?? mapEl.getAttribute('data-latitude') ?? '');
      lon = parseFloat(mapEl.getAttribute('data-lng') ?? mapEl.getAttribute('data-longitude') ?? '');
    }
  }

  if (!lat || isNaN(lat)) return null;

  // Brooklyn bounding box
  if (lat < 40.57 || lat > 40.74 || lon! < -74.05 || lon! > -73.83) return null;

  // Price
  const priceEl = root.querySelector('.price, .listing-price, [class*="price"]');
  const pricePerMonth = parsePrice(priceEl?.text ?? html.match(/\$\s*[\d,]+\s*\/\s*mo/i)?.[0] ?? '');
  if (!pricePerMonth || pricePerMonth < 400 || pricePerMonth > 20000) return null;

  // Address
  const addrEl = root.querySelector('.address, .location, [class*="address"], [itemprop="streetAddress"]');
  const rawAddr = (addrEl?.text ?? '').trim();
  const address = rawAddr.includes('Brooklyn') ? rawAddr : rawAddr ? `${rawAddr}, Brooklyn, NY` : 'Brooklyn, NY';

  // Title
  const titleEl = root.querySelector('h1, [class*="title"]');
  const title = (titleEl?.text ?? '').trim();

  // sqft
  const bodyText = root.querySelector('body')?.text ?? '';
  const sqft = parseSqft(bodyText);

  // Photos
  const imgs = root.querySelectorAll('[class*="gallery"] img, [class*="photo"] img, [class*="slider"] img, .images img');
  const photos = imgs
    .map((img) => img.getAttribute('src') ?? img.getAttribute('data-src') ?? '')
    .filter((s) => s.startsWith('http'))
    .slice(0, 8);

  return {
    address,
    unitType: inferUnitType(title + ' ' + bodyText.slice(0, 500)),
    furnished: html.toLowerCase().includes('furnished'),
    availableFrom: today(),
    availableTo: sixMonthsFromNow(),
    pricePerMonth,
    utilitiesIncluded: 'no',
    brokerFee: false,
    securityDeposit: 0,
    photos,
    sourceUrl: url,
    sourceName: 'LeaseBreak',
    lat,
    lon: lon!,
    sqft: sqft ?? null,
  };
}

async function getListingUrls(path: string): Promise<string[]> {
  let html: string;
  try {
    html = await fetchHtml(`${BASE}${path}`);
  } catch (e) {
    console.warn(`  ! Failed to fetch ${BASE}${path}: ${e}`);
    return [];
  }

  const root = parse(html);
  const urls: string[] = [];

  // LeaseBreak listing links — typically /listing/... or /apartments/...
  root.querySelectorAll('a[href*="/listing/"], a[href*="/apartment/"], a[href*="/sublet/"]').forEach((a) => {
    const href = a.getAttribute('href') ?? '';
    if (!href) return;
    const full = href.startsWith('http') ? href : `${BASE}${href}`;
    urls.push(full);
  });

  // Generic fallback: any internal link that looks like a listing detail
  if (urls.length === 0) {
    root.querySelectorAll('a[href]').forEach((a) => {
      const href = a.getAttribute('href') ?? '';
      if (href.startsWith('/') && href.split('/').length >= 3 && !href.includes('#')) {
        const full = `${BASE}${href}`;
        if (!SEARCH_PATHS.some((p) => href.startsWith(p))) urls.push(full);
      }
    });
  }

  return [...new Set(urls)].filter((u) => u.startsWith(BASE));
}

export async function scrapeLeaseBreak(): Promise<number> {
  console.log('\n[LeaseBreak] Starting scrape...');
  let inserted = 0;

  for (const path of SEARCH_PATHS) {
    console.log(`  Fetching search: ${BASE}${path}`);
    const urls = await getListingUrls(path);
    console.log(`  Found ${urls.length} listing URLs`);

    for (const url of urls) {
      await sleep(2000 + Math.random() * 1000);
      const scraped = await scrapeListingPage(url);
      if (!scraped) continue;
      const ok = await insertScrapedListing(scraped);
      if (ok) inserted++;
    }

    await sleep(3000);
  }

  console.log(`[LeaseBreak] Done — ${inserted} new listings inserted.`);
  return inserted;
}
