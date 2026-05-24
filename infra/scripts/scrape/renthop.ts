/**
 * Scrapes furnished Brooklyn apartments from RentHop.
 * Target: https://www.renthop.com/apartments-for-rent/brooklyn-new-york-ny/furnished
 */

import { parse } from 'node-html-parser';
import { insertScrapedListing, sleep, today, sixMonthsFromNow, inferUnitType, type ScrapedListing } from './lib/enrich';

const BASE = 'https://www.renthop.com';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://www.renthop.com/',
};

const SEARCH_PATHS = [
  '/apartments-for-rent/brooklyn-new-york-ny/furnished',
  '/apartments-for-rent/brooklyn-new-york-ny/short-term',
  '/apartments-for-rent/williamsburg-brooklyn-new-york-ny/furnished',
  '/apartments-for-rent/park-slope-brooklyn-new-york-ny/furnished',
];

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

function parsePrice(text: string): number | null {
  const m = text.match(/\$\s*([\d,]+)/);
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

  // Coordinates from JSON-LD (RentHop publishes structured data)
  let lat: number | undefined;
  let lon: number | undefined;

  for (const script of root.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const data = JSON.parse(script.text);
      const objs = Array.isArray(data) ? data : [data];
      for (const obj of objs) {
        const geo = obj?.geo ?? obj?.location?.geo;
        if (geo?.latitude) {
          lat = parseFloat(String(geo.latitude));
          lon = parseFloat(String(geo.longitude));
          break;
        }
      }
    } catch { /* ignore */ }
    if (lat) break;
  }

  // Meta og tags fallback
  if (!lat) {
    const latMeta = root.querySelector('meta[name="geo.position"]');
    if (latMeta) {
      const [latStr, lonStr] = (latMeta.getAttribute('content') ?? '').split(';');
      lat = parseFloat(latStr);
      lon = parseFloat(lonStr);
    }
  }

  // data-lat attributes on map div
  if (!lat) {
    const mapDiv = root.querySelector('[data-lat], [data-latitude]');
    if (mapDiv) {
      lat = parseFloat(mapDiv.getAttribute('data-lat') ?? mapDiv.getAttribute('data-latitude') ?? '');
      lon = parseFloat(mapDiv.getAttribute('data-lng') ?? mapDiv.getAttribute('data-longitude') ?? '');
    }
  }

  if (!lat || isNaN(lat)) return null;

  // Brooklyn bounding box
  if (lat < 40.57 || lat > 40.74 || lon! < -74.05 || lon! > -73.83) return null;

  // Price — RentHop shows price prominently
  const priceEl = root.querySelector('.price, [class*="price"], [itemprop="price"]');
  const pricePerMonth = parsePrice(priceEl?.text ?? '');
  if (!pricePerMonth || pricePerMonth < 400 || pricePerMonth > 20000) return null;

  // Address
  const addrEl = root.querySelector('[itemprop="streetAddress"], .address, [class*="address"]');
  const rawAddr = (addrEl?.text ?? '').trim();
  const address = rawAddr.includes('Brooklyn') ? rawAddr : rawAddr ? `${rawAddr}, Brooklyn, NY` : 'Brooklyn, NY';

  // Title
  const titleEl = root.querySelector('h1, [class*="listing-title"]');
  const title = (titleEl?.text ?? '').trim();

  // sqft
  const bodyText = root.querySelector('body')?.text ?? '';
  const sqft = parseSqft(bodyText);

  // Photos
  const imgs = root.querySelectorAll('[class*="photo"] img, [class*="gallery"] img, [class*="carousel"] img, [class*="slider"] img');
  let photos = imgs
    .map((img) => img.getAttribute('src') ?? img.getAttribute('data-src') ?? '')
    .filter((s) => s.startsWith('http'))
    .slice(0, 10);

  if (photos.length === 0) {
    // Try background-style image containers
    const divs = root.querySelectorAll('[style*="background-image"]');
    photos = divs
      .map((d) => (d.getAttribute('style') ?? '').match(/url\(['"]?([^'"()]+)['"]?\)/)?.[1] ?? '')
      .filter((s) => s.startsWith('http'))
      .slice(0, 10);
  }

  return {
    address,
    unitType: inferUnitType(title + ' ' + bodyText.slice(0, 500)),
    furnished: html.toLowerCase().includes('furnished'),
    availableFrom: today(),
    availableTo: sixMonthsFromNow(),
    pricePerMonth,
    utilitiesIncluded: 'no',
    brokerFee: html.toLowerCase().includes('broker fee') || html.toLowerCase().includes('no fee') === false,
    securityDeposit: 0,
    photos,
    sourceUrl: url,
    sourceName: 'RentHop',
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

  // RentHop listing URLs typically: /listings/apartment/123-main-st/12345
  root.querySelectorAll('a[href*="/listings/"]').forEach((a) => {
    const href = a.getAttribute('href') ?? '';
    if (!href) return;
    const full = href.startsWith('http') ? href : `${BASE}${href}`;
    urls.push(full);
  });

  // Fallback: any anchor pointing to apartment detail pages
  if (urls.length === 0) {
    root.querySelectorAll('a[href*="/apartment/"]').forEach((a) => {
      const href = a.getAttribute('href') ?? '';
      const full = href.startsWith('http') ? href : `${BASE}${href}`;
      urls.push(full);
    });
  }

  return [...new Set(urls)].filter((u) => u.includes('renthop.com'));
}

export async function scrapeRentHop(): Promise<number> {
  console.log('\n[RentHop] Starting scrape...');
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

  console.log(`[RentHop] Done — ${inserted} new listings inserted.`);
  return inserted;
}
