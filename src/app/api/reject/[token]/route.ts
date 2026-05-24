import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { listings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { sendRejectionNotice } from '@/lib/email';

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
    return new NextResponse('Invalid or expired link.', { status: 404 });
  }

  if (listing.status !== 'pending') {
    return new NextResponse(
      `Listing is already ${listing.status}. No action taken.`,
      { status: 200 },
    );
  }

  await db
    .update(listings)
    .set({ status: 'rejected', updatedAt: new Date() })
    .where(eq(listings.id, listing.id));

  await sendRejectionNotice({
    to: listing.contactEmail,
    landlordName: listing.landlordName,
    address: listing.address,
  });

  return new NextResponse(`Listing rejected: ${listing.address}`, {
    status: 200,
  });
}
