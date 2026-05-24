import { Suspense } from 'react';
import { MapLayout } from '@/components/map/MapLayout';

export default function HomePage() {
  return (
    <main className="flex h-full w-full">
      <Suspense
        fallback={
          <div className="flex h-full w-full items-center justify-center bg-muted">
            <span className="text-muted-foreground">Loading map...</span>
          </div>
        }
      >
        <MapLayout />
      </Suspense>
    </main>
  );
}
