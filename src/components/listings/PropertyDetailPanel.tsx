'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  X,
  House,
  Ruler,
  Armchair,
  CalendarBlank,
  Lightning,
  Receipt,
  Key,
  Train,
  Footprints,
  MapPin,
  ShieldCheck,
  Shield,
  ShieldWarning,
  ArrowSquareOut,
  EnvelopeSimple,
  CaretLeft,
  CaretRight,
  type Icon as PhosphorIcon,
} from '@phosphor-icons/react';
import { useMapStore } from '@/store/map';
import type { PublishedListing } from '@/types';

function Row({ label, icon: Icon, value }: { label: string; icon?: PhosphorIcon; value: React.ReactNode }) {
  return (
    <div className="flex justify-between text-sm py-1.5 border-b border-border/50 last:border-0">
      <span className="text-muted-foreground flex items-center gap-1.5">
        {Icon && <Icon size={13} weight="duotone" className="shrink-0 text-muted-foreground/70" />}
        {label}
      </span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}

function SectionHeader({ icon: Icon, children }: { icon: PhosphorIcon; children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
      <Icon size={13} weight="bold" />
      {children}
    </h3>
  );
}

function PhotoCarousel({ photos }: { photos: string[] }) {
  const [idx, setIdx] = useState(0);
  if (!photos.length) return null;

  const prev = () => setIdx((i) => (i - 1 + photos.length) % photos.length);
  const next = () => setIdx((i) => (i + 1) % photos.length);
  const src = photos[idx].startsWith('http') ? photos[idx] : `/uploads/${photos[idx]}`;

  return (
    <div className="relative w-full overflow-hidden bg-muted">
      <img
        key={idx}
        src={src}
        alt={`Photo ${idx + 1} of ${photos.length}`}
        className="w-full h-52 object-cover"
      />
      {photos.length > 1 && (
        <>
          <button
            onClick={prev}
            aria-label="Previous photo"
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1 transition-colors"
          >
            <CaretLeft size={16} weight="bold" />
          </button>
          <button
            onClick={next}
            aria-label="Next photo"
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1 transition-colors"
          >
            <CaretRight size={16} weight="bold" />
          </button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
            {photos.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                aria-label={`Go to photo ${i + 1}`}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${i === idx ? 'bg-white' : 'bg-white/40'}`}
              />
            ))}
          </div>
          <span className="absolute top-2 right-2 text-xs bg-black/50 text-white rounded px-1.5 py-0.5">
            {idx + 1}/{photos.length}
          </span>
        </>
      )}
    </div>
  );
}

export function PropertyDetailPanel({ listing }: { listing: PublishedListing }) {
  const { setSelectedListing } = useMapStore();

  // Escape key closes panel (WCAG keyboard nav)
  const close = useCallback(() => setSelectedListing(null), [setSelectedListing]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [close]);

  const safetyColor =
    listing.safetyTier === 'low' ? 'text-green-500'
    : listing.safetyTier === 'medium' ? 'text-amber-500'
    : 'text-red-500';

  const SafetyIcon = listing.safetyTier === 'low' ? ShieldCheck : listing.safetyTier === 'medium' ? Shield : ShieldWarning;

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="font-semibold text-sm truncate">{listing.address}</h2>
        <button
          onClick={() => setSelectedListing(null)}
          className="text-muted-foreground hover:text-foreground shrink-0 ml-2 rounded p-1 hover:bg-muted transition-colors"
          aria-label="Close detail panel"
        >
          <X size={16} weight="bold" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Photo carousel */}
        <PhotoCarousel photos={listing.photos} />

        <div className="px-4 py-3 space-y-4">
          {/* Price */}
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-primary">
              ${listing.pricePerMonth.toLocaleString()}
            </span>
            <span className="text-muted-foreground text-sm">/month</span>
          </div>

          {/* Details */}
          <section>
            <SectionHeader icon={House}>Details</SectionHeader>
            <Row icon={House}     label="Unit type"  value={listing.unitType.toUpperCase()} />
            {listing.sqft && <Row icon={Ruler} label="Size" value={`${listing.sqft.toLocaleString()} sqft · $${Math.round(listing.pricePerMonth / listing.sqft)}/sqft`} />}
            <Row icon={Armchair}      label="Furnished"       value={listing.furnished ? 'Yes' : 'No'} />
            <Row icon={CalendarBlank} label="Available from"  value={new Date(listing.availableFrom).toLocaleDateString()} />
            <Row icon={CalendarBlank} label="Available to"    value={new Date(listing.availableTo).toLocaleDateString()} />
            <Row
              icon={Lightning}
              label="Utilities"
              value={
                listing.utilitiesIncluded === 'yes' ? 'Included'
                : listing.utilitiesIncluded === 'partial' ? 'Partial'
                : 'Not included'
              }
            />
            <Row icon={Receipt} label="Broker fee"       value={listing.brokerFee ? 'Yes' : 'No'} />
            <Row
              icon={Key}
              label="Security deposit"
              value={listing.securityDeposit ? `$${listing.securityDeposit.toLocaleString()}` : 'None'}
            />
          </section>

          {/* Transit */}
          <section>
            <SectionHeader icon={Train}>Transit</SectionHeader>
            <Row icon={Train}     label="Nearest station" value={listing.nearestStationName} />
            <Row icon={Train}     label="Lines"           value={listing.nearestStationLines.join(', ')} />
            <Row icon={Footprints} label="Walk time"      value={`${Math.round(listing.walkTimeSeconds / 60)} min`} />
          </section>

          {/* Safety */}
          <section>
            <SectionHeader icon={Shield}>Neighborhood Safety</SectionHeader>
            <Row icon={MapPin}     label="Area"          value={listing.ntaName} />
            <Row
              icon={SafetyIcon}
              label="Incident rate"
              value={
                <span className={`capitalize flex items-center gap-1 ${safetyColor}`}>
                  <SafetyIcon size={12} weight="fill" />
                  {listing.safetyTier}
                </span>
              }
            />
            <p className="text-xs text-muted-foreground mt-1">
              Based on NYPD reported incidents (prior 12 months). Not a guarantee of safety.
            </p>
          </section>
        </div>
      </div>

      {/* CTA */}
      <div className="p-4 border-t border-border space-y-2">
        {listing.sourceUrl && (
          <a
            href={listing.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full border border-primary text-primary font-semibold py-2.5 rounded-lg hover:bg-primary/10 transition-colors text-sm"
          >
            <ArrowSquareOut size={15} weight="bold" />
            View Original Listing
          </a>
        )}
        {!listing.contactEmail.endsWith('@househunter.local') && (
          <a
            href={`mailto:${listing.contactEmail}?subject=Inquiry about ${encodeURIComponent(listing.address)}`}
            className="flex items-center justify-center gap-2 w-full bg-primary text-primary-foreground font-semibold py-2.5 rounded-lg hover:opacity-90 transition-opacity text-sm"
          >
            <EnvelopeSimple size={15} weight="bold" />
            Contact Landlord
          </a>
        )}
      </div>
    </div>
  );
}
