'use client';

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

export function PropertyDetailPanel({ listing }: { listing: PublishedListing }) {
  const { setSelectedListing } = useMapStore();

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
        {listing.photos.length > 0 && (
          <div className="flex gap-2 p-3 overflow-x-auto">
            {listing.photos.map((photo, i) => (
              <img
                key={photo}
                src={photo.startsWith('http') ? photo : `/uploads/${photo}`}
                alt={`Photo ${i + 1}`}
                className="h-48 w-72 object-cover rounded-md shrink-0"
              />
            ))}
          </div>
        )}

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
            {listing.sqft && <Row icon={Ruler} label="Size" value={`${listing.sqft.toLocaleString()} sqft`} />}
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
