import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { listings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { enrichListing } from '@/lib/enrichment';
import { sendListingLive } from '@/lib/email';
import { valkey } from '@/lib/valkey';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const [listing] = await db
    .select()
    .from(listings)
    .where(eq(listings.approvalToken, token))
    .limit(1);

  if (!listing) {
    return new NextResponse('Invalid or expired approval link.', { status: 404 });
  }

  if (listing.status !== 'pending') {
    return new NextResponse(
      `Listing is already ${listing.status}. No action taken.`,
      { status: 200 },
    );
  }

  try {
    // Run enrichment: geocode → OSRM → NTA → safety score → publish
    await enrichListing(listing.id);

    // Clear any cached listings queries
    const keys = await valkey.keys('listings:*').catch(() => []);
    if (keys.length) await valkey.del(...keys).catch(() => {});

    await sendListingLive({
      to: listing.contactEmail,
      landlordName: listing.landlordName,
      address: listing.address,
      listingId: listing.id,
      submissionToken: listing.submissionToken,
    });

    return new NextResponse(
      `Listing approved and published: ${listing.address}`,
      { status: 200 },
    );
  } catch (err) {
    console.error('Enrichment failed for listing', listing.id, err);
    return new NextResponse(
      `Enrichment failed: ${err instanceof Error ? err.message : 'Unknown error'}. Listing remains pending.`,
      { status: 500 },
    );
  }
}
