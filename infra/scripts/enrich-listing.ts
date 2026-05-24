/**
 * Manually enrich a listing by ID. Useful if OSRM/Nominatim were down at approval time.
 * The normal flow triggers enrichment automatically via GET /api/approve/[token].
 * Usage: npm run enrich -- <listing-id>
 */

import 'dotenv/config';
import { enrichListing } from '@/lib/enrichment';

const listingId = process.argv[2];
if (!listingId) {
  console.error('Usage: npm run enrich -- <listing-id>');
  process.exit(1);
}

enrichListing(listingId)
  .then(() => {
    console.log(`Enriched listing ${listingId}`);
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
