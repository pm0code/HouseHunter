import Redis from 'ioredis';

const url = process.env.VALKEY_URL ?? 'redis://localhost:6380';

// Singleton — safe in Next.js dev with hot reload via global
declare global {
  // eslint-disable-next-line no-var
  var valkey: Redis | undefined;
}

function makeClient() {
  const client = new Redis(url, {
    maxRetriesPerRequest: 0,
    lazyConnect: true,
    enableOfflineQueue: false,
  });
  // Prevent "Unhandled error event" noise when Valkey isn't running in dev
  client.on('error', () => {});
  return client;
}

export const valkey = globalThis.valkey ?? makeClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.valkey = valkey;
}

export const CACHE_TTL = {
  listingsQuery: 60,      // 1 minute — listings change rarely
  listingDetail: 300,     // 5 minutes
  ntaScores: 3600,        // 1 hour — safety scores are quarterly
} as const;
