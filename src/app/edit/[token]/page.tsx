'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const schema = z.object({
  pricePerMonth: z.coerce.number().int().min(500).max(20000),
  availableFrom: z.string().min(1),
  availableTo: z.string().min(1),
  utilitiesIncluded: z.enum(['yes', 'no', 'partial']),
  brokerFee: z.coerce.boolean(),
  securityDeposit: z.coerce.number().int().min(0),
  contactPhone: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

type ListingState =
  | { phase: 'loading' }
  | { phase: 'not-found' }
  | { phase: 'removed' }
  | { phase: 'loaded'; listing: FormValues & { address: string; status: string } }
  | { phase: 'saved' }
  | { phase: 'removed-success' };

export default function EditPage({ params }: { params: { token: string } }) {
  const { token } = params;
  const [state, setState] = useState<ListingState>({ phase: 'loading' });

  useEffect(() => {
    fetch(`/api/edit/${token}`)
      .then((r) => {
        if (r.status === 404) return setState({ phase: 'not-found' });
        return r.json().then((data) => {
          if (data.status === 'removed') return setState({ phase: 'removed' });
          setState({ phase: 'loaded', listing: data });
        });
      })
      .catch(() => setState({ phase: 'not-found' }));
  }, [token]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (state.phase === 'loaded') reset(state.listing);
  }, [state, reset]);

  async function onSave(values: FormValues) {
    const res = await fetch(`/api/edit/${token}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });
    if (res.ok) setState({ phase: 'saved' });
  }

  async function onRemove() {
    if (!confirm('Remove this listing? This cannot be undone.')) return;
    const res = await fetch(`/api/edit/${token}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'removed' }),
    });
    if (res.ok) setState({ phase: 'removed-success' });
  }

  const inputClass =
    'border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring w-full';

  if (state.phase === 'loading')
    return <div className="text-center mt-24 text-muted-foreground">Loading...</div>;
  if (state.phase === 'not-found')
    return <div className="text-center mt-24">Invalid or expired link.</div>;
  if (state.phase === 'removed')
    return <div className="text-center mt-24">This listing has been removed.</div>;
  if (state.phase === 'saved')
    return (
      <div className="text-center mt-24">
        <h1 className="text-xl font-bold mb-2">Changes saved</h1>
        <p className="text-muted-foreground text-sm">Your listing has been updated.</p>
      </div>
    );
  if (state.phase === 'removed-success')
    return (
      <div className="text-center mt-24">
        <h1 className="text-xl font-bold mb-2">Listing removed</h1>
        <p className="text-muted-foreground text-sm">Your listing has been taken down.</p>
      </div>
    );

  const { listing } = state;

  return (
    <div className="max-w-xl mx-auto py-12 px-4">
      <h1 className="text-2xl font-bold mb-1">Edit your listing</h1>
      <p className="text-muted-foreground text-sm mb-6">{listing.address}</p>

      <form onSubmit={handleSubmit(onSave)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Monthly price ($)</label>
            <input {...register('pricePerMonth')} type="number" className={inputClass} />
            {errors.pricePerMonth && (
              <p className="text-xs text-destructive mt-1">{errors.pricePerMonth.message}</p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium">Security deposit ($)</label>
            <input {...register('securityDeposit')} type="number" className={inputClass} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Available from</label>
            <input {...register('availableFrom')} type="date" className={inputClass} />
          </div>
          <div>
            <label className="text-sm font-medium">Available to</label>
            <input {...register('availableTo')} type="date" className={inputClass} />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium">Utilities</label>
          <select {...register('utilitiesIncluded')} className={inputClass}>
            <option value="yes">Included</option>
            <option value="partial">Partial</option>
            <option value="no">Not included</option>
          </select>
        </div>

        <div>
          <label className="text-sm font-medium">Phone (optional)</label>
          <input {...register('contactPhone')} type="tel" className={inputClass} />
        </div>

        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input {...register('brokerFee')} type="checkbox" className="h-4 w-4" />
          Broker fee applies
        </label>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 bg-primary text-primary-foreground font-semibold py-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 text-sm"
          >
            {isSubmitting ? 'Saving...' : 'Save changes'}
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="px-4 py-2.5 border border-destructive text-destructive rounded-lg hover:bg-destructive/10 text-sm font-medium"
          >
            Remove listing
          </button>
        </div>
      </form>
    </div>
  );
}
