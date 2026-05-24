import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { listings } from '@/lib/db/schema';
import { generateToken } from '@/lib/tokens';
import {
  sendSubmissionConfirmation,
  sendAdminApprovalRequest,
} from '@/lib/email';
import { z } from 'zod';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

const MAX_PHOTOS = 20;
const MIN_PHOTOS = 3;
const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8 MB per photo

const submissionSchema = z.object({
  address: z.string().min(5).max(200),
  unitType: z.enum(['studio', '1br', '2br']),
  furnished: z.coerce.boolean(),
  availableFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  availableTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  pricePerMonth: z.coerce.number().int().min(500).max(20000),
  utilitiesIncluded: z.enum(['yes', 'no', 'partial']),
  brokerFee: z.coerce.boolean(),
  securityDeposit: z.coerce.number().int().min(0),
  contactEmail: z.string().email().max(200),
  contactPhone: z.string().max(30).optional(),
  landlordName: z.string().min(2).max(100),
});

export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const raw = Object.fromEntries(
    [...formData.entries()].filter(([, v]) => typeof v === 'string'),
  );

  const parsed = submissionSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }

  // Handle photo uploads
  const photoFiles = formData.getAll('photos') as File[];
  if (photoFiles.length < MIN_PHOTOS) {
    return NextResponse.json(
      { error: `At least ${MIN_PHOTOS} photos required` },
      { status: 422 },
    );
  }
  if (photoFiles.length > MAX_PHOTOS) {
    return NextResponse.json(
      { error: `Maximum ${MAX_PHOTOS} photos allowed` },
      { status: 422 },
    );
  }

  const uploadDir = path.join(process.cwd(), 'public', 'uploads');
  await mkdir(uploadDir, { recursive: true });

  const savedPhotos: string[] = [];
  for (const file of photoFiles) {
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: `Photo exceeds 8 MB limit: ${file.name}` },
        { status: 422 },
      );
    }
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
    if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${ext}` },
        { status: 422 },
      );
    }
    const filename = `${generateToken().slice(0, 16)}.${ext}`;
    await writeFile(path.join(uploadDir, filename), Buffer.from(await file.arrayBuffer()));
    savedPhotos.push(filename);
  }

  const submissionToken = generateToken();
  const approvalToken = generateToken();

  const [inserted] = await db
    .insert(listings)
    .values({
      ...parsed.data,
      photos: savedPhotos,
      submissionToken,
      approvalToken,
      status: 'pending',
    })
    .returning({ id: listings.id });

  await Promise.all([
    sendSubmissionConfirmation({
      to: parsed.data.contactEmail,
      landlordName: parsed.data.landlordName,
      address: parsed.data.address,
      submissionToken,
    }),
    sendAdminApprovalRequest({
      listingId: inserted.id,
      address: parsed.data.address,
      landlordName: parsed.data.landlordName,
      pricePerMonth: parsed.data.pricePerMonth,
      approvalToken,
    }),
  ]);

  return NextResponse.json({ id: inserted.id }, { status: 201 });
}
