/**
 * Scrapes short-term furnished rentals from CozyCozy.
 * CozyCozy embeds full listing data in JSON-LD on the search page — no per-listing fetches needed.
 * Prices are nightly; multiplied by 30 for monthly equivalent.
 * Target: https://www.cozycozy.com/us/brooklyn-short-term-rentals
 */

import { insertScrapedListing, sleep, today, sixMonthsFromNow, inferUnitType, type ScrapedListing } from './lib/enrich';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

const SEARCH_URLS = [
  'https://www.cozycozy.com/us/brooklyn-short-term-rentals',
];

// Tight Brooklyn bounding box — excludes lower Manhattan and Jersey City
const BK = { latMin: 40.570, latMax: 40.739, lonMin: -74.042, lonMax: -73.850 };

// Brooklyn ZIP prefixes
const BK_ZIPS = /^1120[1-9]|^112[1-4]\d|^11201$/;

interface LodgingBusiness {
  '@type': string;
  name: string;
  address?: {
    postalCode?: string;
    streetAddress?: string;
    addressLocality?: string;
  };
  geo?: {
    latitude: number | string;
    longitude: number | string;
  };
  image?: string | string[];
  makesOffer?: {
    price?: number | string;
    priceCurrency?: string;
  };
  description?: string;
}

function isBrooklyn(item: LodgingBusiness, lat: number, lon: number): boolean {
  const zip = (item.address?.postalCode ?? '').replace(/\D/g, '').slice(0, 5);
  // Exclude known non-Brooklyn ZIP prefixes
  if (/^10/.test(zip) || /^07/.test(zip)) return false;
  if (zip.length === 5 && !zip.startsWith('11')) return false;
  // Bounding box filter
  return lat >= BK.latMin && lat <= BK.latMax && lon >= BK.lonMin && lon <= BK.lonMax;
}

async function extractListings(searchUrl: string): Promise<ScrapedListing[]> {
  let html: string;
  try {
    const res = await fetch(searchUrl, { headers: HEADERS });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    html = await res.text();
  } catch (e) {
    console.warn(`  ! Failed to fetch ${searchUrl}: ${e}`);
    return [];
  }

  // Extract all JSON-LD scripts and find the large lodging array
  const ldPattern = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
  let lodgings: LodgingBusiness[] = [];
  let m: RegExpExecArray | null;

  while ((m = ldPattern.exec(html)) !== null) {
    const content = m[1].trim();
    if (!content.startsWith('[')) continue;
    try {
      const parsed = JSON.parse(content) as LodgingBusiness[];
      if (parsed[0]?.['@type'] === 'LodgingBusiness') {
        lodgings = parsed;
        break;
      }
    } catch { /* ignore */ }
  }

  if (lodgings.length === 0) {
    console.warn(`  ! No lodging JSON-LD found at ${searchUrl}`);
    return [];
  }

  const results: ScrapedListing[] = [];

  for (const item of lodgings) {
    if (!item.geo?.latitude || !item.geo?.longitude) continue;
    const lat = parseFloat(String(item.geo.latitude));
    const lon = parseFloat(String(item.geo.longitude));
    if (isNaN(lat) || isNaN(lon)) continue;
    if (!isBrooklyn(item, lat, lon)) continue;

    const nightlyPrice = parseFloat(String(item.makesOffer?.price ?? '0'));
    if (!nightlyPrice || nightlyPrice <= 0) continue;
    const pricePerMonth = Math.round(nightlyPrice * 30);
    if (pricePerMonth < 500 || pricePerMonth > 30000) continue;

    // Photos — single or array of Booking.com/Airbnb CDN URLs
    const rawImg = item.image ?? '';
    const photos: string[] = (Array.isArray(rawImg) ? rawImg : [rawImg]).filter(Boolean).slice(0, 8);

    // Address — CozyCozy uses vague locality descriptions; use name + ZIP when street is not a real address
    const zip = (item.address?.postalCode ?? '').replace(/[^0-9]/g, '').slice(0, 5);
    const rawStreet = (item.address?.streetAddress ?? '').trim();
    const name = (item.name ?? '').trim();
    // Filter out non-address street fields (country names, "New York, États-Unis", etc.)
    const isRealStreet = rawStreet.length > 3 && /\d/.test(rawStreet) && !rawStreet.includes(',');
    const address = isRealStreet
      ? `${rawStreet}${zip ? ', Brooklyn, NY ' + zip : ', Brooklyn, NY'}`
      : name.toLowerCase().includes('brooklyn')
      ? name
      : `${name}, Brooklyn, NY${zip ? ' ' + zip : ''}`;

    // Build a stable per-listing URL using name slug + coordinates — CozyCozy has no individual SSR pages
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
    const sourceUrl = `${searchUrl}#${slug}-${Math.round(lat * 1000)}-${Math.round(Math.abs(lon) * 1000)}`;

    results.push({
      address,
      unitType: inferUnitType(name + ' ' + (item.description ?? '')),
      furnished: true, // all CozyCozy listings are furnished short-term rentals
      availableFrom: today(),
      availableTo: sixMonthsFromNow(),
      pricePerMonth,
      utilitiesIncluded: 'yes', // short-term rentals include utilities
      brokerFee: false,
      securityDeposit: 0,
      photos,
      sourceUrl,
      sourceName: 'CozyCozy',
      lat,
      lon,
      sqft: null,
    });
  }

  return results;
}

export async function scrapeCozyCozy(): Promise<number> {
  console.log('\n[CozyCozy] Starting scrape...');
  let inserted = 0;

  for (const url of SEARCH_URLS) {
    console.log(`  Fetching: ${url}`);
    const listings = await extractListings(url);
    console.log(`  Found ${listings.length} Brooklyn listings`);

    for (const listing of listings) {
      await sleep(500); // No per-listing fetches — just DB inserts
      const ok = await insertScrapedListing(listing);
      if (ok) inserted++;
    }

    await sleep(3000);
  }

  console.log(`[CozyCozy] Done — ${inserted} new listings inserted.`);
  return inserted;
}
