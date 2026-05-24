-- Add missing columns (source_url, sqft) if they don't exist yet,
-- then enforce a partial unique index on source_url to prevent
-- re-scraped duplicates at the database level.

ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "source_url" text;
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "sqft" integer;

-- Partial unique index: only enforced when source_url is not null.
-- Scrapers should upsert on this key going forward.
CREATE UNIQUE INDEX IF NOT EXISTS "listings_source_url_unique_idx"
  ON "listings" ("source_url")
  WHERE "source_url" IS NOT NULL;
