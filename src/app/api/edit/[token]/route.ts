import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { listings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { valkey } from '@/lib/valkey';
import { z } from 'zod';

const editSchema = z.object({
  pricePerMonth: z.coerce.number().int().min(500).max(20000).optional(),
  availableFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  availableTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  utilitiesIncluded: z.enum(['yes', 'no', 'partial']).optional(),
  brokerFee: z.coerce.boolean().optional(),
  securityDeposit: z.coerce.number().int().min(0).optional(),
  contactPhone: z.string().max(30).optional(),
  status: z.literal('removed').optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const [listing] = await db
    .select({
      id: listings.id,
      address: listings.address,
      status: listings.status,
      pricePerMonth: listings.pricePerMonth,
      availableFrom: listings.availableFrom,
      availableTo: listings.availableTo,
      utilitiesIncluded: listings.utilitiesIncluded,
      brokerFee: listings.brokerFee,
      securityDeposit: listings.securityDeposit,
      contactPhone: listings.contactPhone,
    })
    .from(listings)
    .where(eq(listings.submissionToken, token))
    .limit(1);

  if (!listing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(listing);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const [listing] = await db
    .select({ id: listings.id, address: listings.address, status: listings.status })
    .from(listings)
    .where(eq(listings.submissionToken, token))
    .limit(1);

  if (!listing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (listing.status === 'removed') {
    return NextResponse.json({ error: 'Listing already removed' }, { status: 410 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = editSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }

  await db
    .update(listings)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(listings.id, listing.id));

  // Bust cache
  const keys = await valkey.keys('listings:*').catch(() => []);
  if (keys.length) await valkey.del(...keys).catch(() => {});
  await valkey.del(`listing:${listing.id}`).catch(() => {});

  return NextResponse.json({ ok: true });
}
