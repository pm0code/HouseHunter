'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  address: z.string().min(5, 'Address is required'),
  unitType: z.enum(['studio', '1br', '2br']),
  furnished: z.boolean(),
  availableFrom: z.string().min(1, 'Start date is required'),
  availableTo: z.string().min(1, 'End date is required'),
  pricePerMonth: z.coerce.number().int().min(500).max(20000),
  utilitiesIncluded: z.enum(['yes', 'no', 'partial']),
  brokerFee: z.boolean(),
  securityDeposit: z.coerce.number().int().min(0),
  contactEmail: z.string().email('Valid email required'),
  contactPhone: z.string().optional(),
  landlordName: z.string().min(2, 'Name is required'),
});

type FormValues = z.infer<typeof schema>;

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export default function SubmitPage() {
  const [submitted, setSubmitted] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      furnished: true,
      brokerFee: false,
      utilitiesIncluded: 'no',
      securityDeposit: 0,
    },
  });

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    setServerError(null);

    if (photos.length < 3) {
      setServerError('Please upload at least 3 photos.');
      setSubmitting(false);
      return;
    }

    const fd = new FormData();
    for (const [k, v] of Object.entries(values)) {
      fd.append(k, String(v));
    }
    for (const photo of photos) {
      fd.append('photos', photo);
    }

    const res = await fetch('/api/submit', { method: 'POST', body: fd });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setServerError(body.error ?? 'Submission failed. Please try again.');
      setSubmitting(false);
      return;
    }

    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto mt-24 px-4 text-center">
        <h1 className="text-2xl font-bold mb-3">Listing submitted!</h1>
        <p className="text-muted-foreground text-sm">
          Check your email for a confirmation and a private link to edit or
          remove your listing. Our team will review it shortly.
        </p>
      </div>
    );
  }

  const inputClass =
    'border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring';

  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <h1 className="text-2xl font-bold mb-1">List your Brooklyn rental</h1>
      <p className="text-muted-foreground text-sm mb-8">
        Free to list. Admin-reviewed before going live. You can edit or remove
        anytime via the link in your confirmation email.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <Field label="Full address" error={errors.address?.message}>
          <input
            {...register('address')}
            placeholder="123 Atlantic Ave, Brooklyn, NY 11201"
            className={inputClass}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Unit type" error={errors.unitType?.message}>
            <select {...register('unitType')} className={inputClass}>
              <option value="studio">Studio</option>
              <option value="1br">1 Bedroom</option>
              <option value="2br">2 Bedrooms</option>
            </select>
          </Field>

          <Field label="Monthly price (USD)" error={errors.pricePerMonth?.message}>
            <input
              {...register('pricePerMonth')}
              type="number"
              min={500}
              max={20000}
              placeholder="2500"
              className={inputClass}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Available from" error={errors.availableFrom?.message}>
            <input {...register('availableFrom')} type="date" className={inputClass} />
          </Field>
          <Field label="Available to" error={errors.availableTo?.message}>
            <input {...register('availableTo')} type="date" className={inputClass} />
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Field label="Utilities" error={errors.utilitiesIncluded?.message}>
            <select {...register('utilitiesIncluded')} className={inputClass}>
              <option value="yes">Included</option>
              <option value="partial">Partial</option>
              <option value="no">Not included</option>
            </select>
          </Field>
          <Field label="Security deposit ($)" error={errors.securityDeposit?.message}>
            <input
              {...register('securityDeposit')}
              type="number"
              min={0}
              placeholder="0"
              className={inputClass}
            />
          </Field>
          <Field label="" error={undefined}>
            <div className="flex flex-col gap-3 pt-6">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input {...register('furnished')} type="checkbox" className="h-4 w-4" />
                Furnished
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input {...register('brokerFee')} type="checkbox" className="h-4 w-4" />
                Broker fee
              </label>
            </div>
          </Field>
        </div>

        <Field label="Photos (minimum 3, max 20, 8 MB each)">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={(e) => setPhotos(Array.from(e.target.files ?? []))}
            className={inputClass}
          />
          {photos.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {photos.length} photo{photos.length !== 1 ? 's' : ''} selected
            </p>
          )}
        </Field>

        <hr className="border-border" />

        <Field label="Your name or company" error={errors.landlordName?.message}>
          <input {...register('landlordName')} placeholder="Jane Smith" className={inputClass} />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Contact email" error={errors.contactEmail?.message}>
            <input
              {...register('contactEmail')}
              type="email"
              placeholder="jane@example.com"
              className={inputClass}
            />
          </Field>
          <Field label="Phone (optional)" error={errors.contactPhone?.message}>
            <input
              {...register('contactPhone')}
              type="tel"
              placeholder="+1 (718) 555-0100"
              className={inputClass}
            />
          </Field>
        </div>

        {serverError && (
          <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
            {serverError}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-primary text-primary-foreground font-semibold py-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 text-sm"
        >
          {submitting ? 'Submitting...' : 'Submit listing for review'}
        </button>

        <p className="text-xs text-muted-foreground text-center">
          By submitting, you confirm this is your property and your information is accurate.
        </p>
      </form>
    </div>
  );
}
