/**
 * Scrapes furnished Brooklyn apartments and sublets from Craigslist.
 * Sources:
 *   https://newyork.craigslist.org/search/brk/apa?furnished=1  (apartments)
 *   https://newyork.craigslist.org/search/brk/sub              (sublets/temp)
 */

import { parse } from 'node-html-parser';
import { insertScrapedListing, sleep, today, sixMonthsFromNow, inferUnitType, type ScrapedListing } from './lib/enrich';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

const SEARCH_URLS = [
  'https://newyork.craigslist.org/search/brk/apa?furnished=1&availabilityMode=0&sort=date',
  'https://newyork.craigslist.org/search/brk/sub?availabilityMode=0&sort=date',
];

// Brooklyn bounding box
const BK = { latMin: 40.57, latMax: 40.74, lonMin: -74.05, lonMax: -73.83 };

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

function parsePrice(text: string): number | null {
  const m = text.match(/\$?\s*([\d,]+)/);
  if (!m) return null;
  const n = parseInt(m[1].replace(/,/g, ''), 10);
  return n;
}

function parseSqft(text: string): number | null {
  const m = text.match(/(\d[\d,]*)\s*(?:ft²|sq\.?\s*ft|sqft)/i);
  if (!m) return null;
  return parseInt(m[1].replace(/,/g, ''), 10);
}

function parseAvailableDate(attrsText: string): string {
  // e.g. "available jun 1" or "available 6/1" or "avail. July 15"
  const m = attrsText.match(/avail(?:able)?\.?\s+([a-z]+ \d{1,2}|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i);
  if (!m) return today();
  try {
    const d = new Date(`${m[1]} 2026`);
    if (isNaN(d.getTime())) return today();
    return d.toISOString().slice(0, 10);
  } catch {
    return today();
  }
}

interface SearchItem {
  url: string;
  lat?: number;
  lon?: number;
  beds?: number;
  name?: string;
}

async function getSearchItems(searchUrl: string): Promise<SearchItem[]> {
  let html: string;
  try {
    html = await fetchHtml(searchUrl);
  } catch (e) {
    console.warn(`  ! Failed to fetch ${searchUrl}: ${e}`);
    return [];
  }

  // Extract listing URLs — Craigslist wraps each in <li class="cl-static-search-result"><a href="...">
  // The href pattern: https://newyork.craigslist.org/brk/{cat}/d/{slug}/{id}.html
  const urlRegex = /href="(https:\/\/newyork\.craigslist\.org\/[a-z]+\/(?:apa|sub)\/d\/[^"]+\.html)"/g;
  const urls: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = urlRegex.exec(html)) !== null) {
    if (!urls.includes(m[1])) urls.push(m[1]);
  }

  // Extract per-position lat/lon from the JSON-LD embedded in the search page
  const coordsByPosition = new Map<number, { lat: number; lon: number; beds?: number; name?: string }>();
  try {
    const root = parse(html);
    const ldScript = root.querySelector('#ld_searchpage_results');
    if (ldScript) {
      const data = JSON.parse(ldScript.text) as { itemListElement: Array<{ position: string; item: { latitude: number; longitude: number; numberOfBedrooms?: number; name?: string } }> };
      for (const el of data.itemListElement) {
        const pos = parseInt(el.position, 10);
        const item = el.item;
        if (item?.latitude && item?.longitude) {
          coordsByPosition.set(pos, { lat: item.latitude, lon: item.longitude, beds: item.numberOfBedrooms, name: item.name });
        }
      }
    }
  } catch { /* ignore JSON parse errors */ }

  return urls.map((url, i) => {
    const coords = coordsByPosition.get(i);
    return { url, ...coords };
  });
}

async function scrapeListingPage(item: SearchItem): Promise<ScrapedListing | null> {
  // Pre-filter by bounding box using coords from search page (saves a fetch)
  if (item.lat && item.lon) {
    if (item.lat < BK.latMin || item.lat > BK.latMax || item.lon < BK.lonMin || item.lon > BK.lonMax) return null;
  }

  let html: string;
  try {
    html = await fetchHtml(item.url);
  } catch (e) {
    console.warn(`    ! Failed to fetch ${item.url}: ${e}`);
    return null;
  }

  const root = parse(html);

  // Coordinates — <div id="map" data-latitude="..." data-longitude="...">
  const mapDiv = root.querySelector('#map');
  const lat = parseFloat(mapDiv?.getAttribute('data-latitude') ?? String(item.lat ?? ''));
  const lon = parseFloat(mapDiv?.getAttribute('data-longitude') ?? String(item.lon ?? ''));
  if (isNaN(lat) || isNaN(lon)) return null;
  if (lat < BK.latMin || lat > BK.latMax || lon < BK.lonMin || lon > BK.lonMax) return null;

  // Price — <span class="price">$1,800</span>
  const priceEl = root.querySelector('span.price');
  const pricePerMonth = parsePrice(priceEl?.text ?? '');
  if (!pricePerMonth || pricePerMonth < 400 || pricePerMonth > 20000) return null;

  // Address — <h2 class="street-address"> has full address with ZIP
  const streetEl = root.querySelector('h2.street-address');
  const mapAddrEl = root.querySelector('.mapaddress');
  let address = (streetEl?.text ?? mapAddrEl?.text ?? item.name ?? 'Brooklyn, NY').trim().replace(/\s+/g, ' ');
  if (!address.toLowerCase().includes('brooklyn') && !address.toLowerCase().includes('ny')) {
    address = `${address}, Brooklyn, NY`;
  }

  // Title for unit type inference
  const titleEl = root.querySelector('#titletextonly');
  const title = (titleEl?.text ?? item.name ?? '').trim();

  // Attributes — <div class="attrgroup"><span class="attr important">2BR / 1Ba</span>
  const attrsText = root.querySelectorAll('.attrgroup .attr')
    .map((el) => el.text.trim())
    .join(' ');
  const sqft = parseSqft(attrsText + ' ' + title);
  const availableFrom = parseAvailableDate(attrsText);

  // Photos — <div id="thumbs"><a class="thumb" href="https://images.craigslist.org/...600x450.jpg">
  const thumbLinks = root.querySelectorAll('#thumbs a.thumb');
  let photos: string[] = thumbLinks
    .map((a) => a.getAttribute('href') ?? '')
    .filter((h) => h.includes('images.craigslist.org'))
    .slice(0, 10);

  if (photos.length === 0) {
    // Fallback: img tags pointing to craigslist images (thumbnail → upgrade to 600x450)
    const imgs = root.querySelectorAll('img[src*="images.craigslist.org"]');
    photos = imgs
      .map((img) => (img.getAttribute('src') ?? '').replace(/_\d+x\d+\.jpg/, '_600x450.jpg'))
      .filter(Boolean)
      .slice(0, 10);
  }

  const furnished = html.toLowerCase().includes('furnished');
  const unitType = inferUnitType(title + ' ' + attrsText + (item.beds ? ` ${item.beds}br` : ''));

  return {
    address,
    unitType,
    furnished,
    availableFrom,
    availableTo: sixMonthsFromNow(),
    pricePerMonth,
    utilitiesIncluded: 'no',
    brokerFee: false,
    securityDeposit: 0,
    photos,
    sourceUrl: item.url,
    sourceName: 'Craigslist',
    lat,
    lon,
    sqft: sqft ?? null,
  };
}

export async function scrapeCraigslist(): Promise<number> {
  console.log('\n[Craigslist] Starting scrape...');
  let inserted = 0;

  for (const searchUrl of SEARCH_URLS) {
    console.log(`  Fetching search: ${searchUrl}`);
    const items = await getSearchItems(searchUrl);
    console.log(`  Found ${items.length} listing URLs`);

    for (const item of items) {
      await sleep(1500 + Math.random() * 1000);
      const scraped = await scrapeListingPage(item);
      if (!scraped) continue;
      const ok = await insertScrapedListing(scraped);
      if (ok) inserted++;
    }

    await sleep(3000);
  }

  console.log(`[Craigslist] Done — ${inserted} new listings inserted.`);
  return inserted;
}
