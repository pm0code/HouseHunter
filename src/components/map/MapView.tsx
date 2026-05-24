'use client';

import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import { layers as pmLayers, DARK } from '@protomaps/basemaps';
import { useMapStore, BROOKLYN_CENTER } from '@/store/map';
import { useSearchStore } from '@/store/search';
import { useListings } from '@/hooks/useListings';
import { useListingFilters } from '@/hooks/useListingFilters';

const PMTILES_SOURCE = 'protomaps';

const GLYPHS =
  'https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf';
const SPRITE =
  'https://protomaps.github.io/basemaps-assets/sprites/v4/dark';

const TIER_COLORS: Record<string, string> = {
  low: '#22c55e',
  medium: '#f59e0b',
  high: '#ef4444',
};

export function MapView() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [styleReady, setStyleReady] = useState(false);

  const {
    viewport,
    setViewport,
    hoveredListingId,
    selectedListing,
    setSelectedListing,
    setHoveredListingId,
    safetyOverlayVisible,
    subwayMarkersVisible,
    mapResetSignal,
  } = useMapStore();

  const { rankedListingIds } = useSearchStore();

  const [filters] = useListingFilters();
  const { data: listings } = useListings(filters);

  // ── Map init ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const protocol = new Protocol();
    maplibregl.addProtocol('pmtiles', protocol.tile);

    if (!mapContainer.current || map.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        glyphs: GLYPHS,
        sprite: SPRITE,
        sources: {
          [PMTILES_SOURCE]: {
            type: 'vector',
            url: 'pmtiles:///tiles/new-york-city.pmtiles',
            attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
          },
        },
        layers: pmLayers(PMTILES_SOURCE, DARK),
      },
      center: [viewport.longitude, viewport.latitude],
      zoom: viewport.zoom,
    });

    map.current.addControl(new maplibregl.NavigationControl(), 'top-right');

    map.current.on('move', () => {
      if (!map.current) return;
      const c = map.current.getCenter();
      setViewport({ longitude: c.lng, latitude: c.lat, zoom: map.current.getZoom() });
    });

    map.current.once('style.load', () => setStyleReady(true));

    return () => {
      map.current?.remove();
      map.current = null;
      setStyleReady(false);
      maplibregl.removeProtocol('pmtiles');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Listing pins (clustered) ──────────────────────────────────────────────
  useEffect(() => {
    if (!map.current || !styleReady || !listings) return;
    const m = map.current;

    const rankMap = new Map(rankedListingIds.map((id, i) => [id, i + 1]));

    const geojson: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: listings.map((l) => ({
        type: 'Feature',
        id: l.id,
        geometry: { type: 'Point', coordinates: [l.lon, l.lat] },
        properties: {
          id: l.id,
          price: l.pricePerMonth,
          rank: rankMap.get(l.id) ?? 0,
          walkTimeSeconds: l.walkTimeSeconds,
          safetyTier: l.safetyTier,
        },
      })),
    };

    if (m.getSource('listings')) {
      (m.getSource('listings') as maplibregl.GeoJSONSource).setData(geojson);
      return;
    }

    m.addSource('listings', {
      type: 'geojson',
      data: geojson,
      cluster: true,
      clusterMaxZoom: 13,
      clusterRadius: 50,
    });

    // Cluster bubble
    m.addLayer({
      id: 'listings-cluster',
      type: 'circle',
      source: 'listings',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': '#3b82f6',
        'circle-radius': ['step', ['get', 'point_count'], 18, 10, 22, 30, 26],
        'circle-stroke-color': '#1e3a6e',
        'circle-stroke-width': 2,
        'circle-opacity': 0.9,
      },
    });

    // Cluster count label
    m.addLayer({
      id: 'listings-cluster-count',
      type: 'symbol',
      source: 'listings',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': ['get', 'point_count_abbreviated'],
        'text-font': ['Open Sans Bold'],
        'text-size': 12,
        'text-allow-overlap': true,
      },
      paint: { 'text-color': '#ffffff' },
    });

    // Unclustered pins
    m.addLayer({
      id: 'listings-circle',
      type: 'circle',
      source: 'listings',
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-color': '#3b82f6',
        'circle-radius': 14,
        'circle-stroke-color': '#1e3a6e',
        'circle-stroke-width': 2,
        'circle-opacity': 0.9,
      },
    });

    m.addLayer({
      id: 'listings-unclustered',
      type: 'symbol',
      source: 'listings',
      filter: ['!', ['has', 'point_count']],
      layout: {
        'text-field': [
          'case',
          ['>', ['get', 'rank'], 0],
          ['to-string', ['get', 'rank']],
          ['concat', '$', ['to-string', ['get', 'price']]],
        ],
        'text-font': ['Open Sans Bold'],
        'text-size': 12,
        'text-anchor': 'center',
        'icon-allow-overlap': true,
        'text-allow-overlap': true,
      },
      paint: {
        'text-color': '#ffffff',
        'text-halo-color': '#1e3a6e',
        'text-halo-width': 1,
      },
    });

    // Zoom in on cluster click
    m.on('click', 'listings-cluster', (e) => {
      const features = m.queryRenderedFeatures(e.point, { layers: ['listings-cluster'] });
      const clusterId = features[0]?.properties?.cluster_id as number | undefined;
      if (!clusterId) return;
      (m.getSource('listings') as maplibregl.GeoJSONSource)
        .getClusterExpansionZoom(clusterId)
        .then((zoom) => {
          m.easeTo({ center: (features[0].geometry as GeoJSON.Point).coordinates as [number, number], zoom });
        })
        .catch(() => {});
    });
    m.on('mouseenter', 'listings-cluster', () => { m.getCanvas().style.cursor = 'pointer'; });
    m.on('mouseleave', 'listings-cluster', () => { m.getCanvas().style.cursor = ''; });

    m.on('click', 'listings-unclustered', (e) => {
      const feature = e.features?.[0];
      if (!feature || !listings) return;
      const id = feature.properties?.id as string;
      const listing = listings.find((l) => l.id === id) ?? null;
      setSelectedListing(listing);
    });

    m.on('mouseenter', 'listings-unclustered', (e) => {
      m.getCanvas().style.cursor = 'pointer';
      const id = e.features?.[0]?.properties?.id as string | undefined;
      if (id) setHoveredListingId(id);
    });

    m.on('mouseleave', 'listings-unclustered', () => {
      m.getCanvas().style.cursor = '';
      setHoveredListingId(null);
    });
  }, [listings, styleReady, rankedListingIds, setSelectedListing, setHoveredListingId]);

  // ── Hover / selection highlight ──────────────────────────────────────────────
  useEffect(() => {
    if (!map.current || !map.current.getLayer('listings-circle')) return;
    // hover takes priority; selection is the persistent fallback
    const activeId = hoveredListingId ?? selectedListing?.id ?? '';
    map.current.setPaintProperty('listings-circle', 'circle-color', [
      'case',
      ['==', ['get', 'id'], activeId],
      '#f59e0b',  /* amber highlight */
      '#3b82f6',  /* blue default    */
    ]);
    map.current.setPaintProperty('listings-circle', 'circle-stroke-color', [
      'case',
      ['==', ['get', 'id'], activeId],
      '#92400e',
      '#1e3a6e',
    ]);
  }, [hoveredListingId, selectedListing]);

  // ── Route line to nearest subway (FR-2.5) ────────────────────────────────────
  useEffect(() => {
    if (!map.current || !styleReady) return;
    const m = map.current;

    const routeGeojson: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: selectedListing?.routeGeoJson ? [selectedListing.routeGeoJson] : [],
    };

    if (m.getSource('route-line')) {
      (m.getSource('route-line') as maplibregl.GeoJSONSource).setData(routeGeojson);
    } else {
      m.addSource('route-line', { type: 'geojson', data: routeGeojson });
      m.addLayer({
        id: 'route-line-casing',
        type: 'line',
        source: 'route-line',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#0a1628', 'line-width': 5, 'line-opacity': 0.8 },
      }, 'listings-circle');
      m.addLayer({
        id: 'route-line-fill',
        type: 'line',
        source: 'route-line',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#f59e0b',
          'line-width': 3,
          'line-opacity': 0.95,
          'line-dasharray': [2, 1.5],
        },
      }, 'listings-circle');
    }
  }, [selectedListing, styleReady]);

  // ── Pan to selected listing ───────────────────────────────────────────────────
  useEffect(() => {
    if (!map.current || !selectedListing) return;
    map.current.flyTo({
      center: [selectedListing.lon, selectedListing.lat],
      zoom: Math.max(map.current.getZoom(), 14),
      duration: 600,
    });
  }, [selectedListing]);

  // ── Reset to Brooklyn overview ────────────────────────────────────────────────
  useEffect(() => {
    if (!map.current || mapResetSignal === 0) return;
    map.current.flyTo({
      center: [BROOKLYN_CENTER.longitude, BROOKLYN_CENTER.latitude],
      zoom: BROOKLYN_CENTER.zoom,
      duration: 800,
    });
  }, [mapResetSignal]);

  // ── Safety overlay ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!map.current || !styleReady) return;
    const m = map.current;

    if (safetyOverlayVisible) {
      if (!m.getSource('nta-safety')) {
        fetch('/api/nta-safety')
          .then((r) => r.json())
          .then((geojson) => {
            if (!m.getSource('nta-safety')) {
              m.addSource('nta-safety', { type: 'geojson', data: geojson });
            }
            if (!m.getLayer('nta-safety-fill')) {
              m.addLayer(
                {
                  id: 'nta-safety-fill',
                  type: 'fill',
                  source: 'nta-safety',
                  paint: {
                    'fill-color': [
                      'match',
                      ['get', 'tier'],
                      'low', TIER_COLORS.low,
                      'medium', TIER_COLORS.medium,
                      'high', TIER_COLORS.high,
                      '#94a3b8',
                    ],
                    'fill-opacity': 0.25,
                  },
                },
                'listings-circle', // insert below listing pins
              );
              m.addLayer(
                {
                  id: 'nta-safety-outline',
                  type: 'line',
                  source: 'nta-safety',
                  paint: {
                    'line-color': [
                      'match',
                      ['get', 'tier'],
                      'low', TIER_COLORS.low,
                      'medium', TIER_COLORS.medium,
                      'high', TIER_COLORS.high,
                      '#94a3b8',
                    ],
                    'line-width': 1,
                    'line-opacity': 0.5,
                  },
                },
                'listings-circle',
              );
              m.addLayer(
                {
                  id: 'nta-safety-label',
                  type: 'symbol',
                  source: 'nta-safety',
                  minzoom: 13,
                  layout: {
                    'text-field': ['upcase', ['get', 'tier']],
                    'text-font': ['Open Sans Bold'],
                    'text-size': 9,
                    'text-allow-overlap': false,
                  },
                  paint: {
                    'text-color': '#ffffff',
                    'text-halo-color': '#000000',
                    'text-halo-width': 1.5,
                    'text-opacity': 0.8,
                  },
                },
                'listings-circle',
              );
            }
          })
          .catch(console.error);
      } else {
        if (m.getLayer('nta-safety-fill')) m.setLayoutProperty('nta-safety-fill', 'visibility', 'visible');
        if (m.getLayer('nta-safety-outline')) m.setLayoutProperty('nta-safety-outline', 'visibility', 'visible');
        if (m.getLayer('nta-safety-label')) m.setLayoutProperty('nta-safety-label', 'visibility', 'visible');
      }
    } else {
      if (m.getLayer('nta-safety-fill')) m.setLayoutProperty('nta-safety-fill', 'visibility', 'none');
      if (m.getLayer('nta-safety-outline')) m.setLayoutProperty('nta-safety-outline', 'visibility', 'none');
      if (m.getLayer('nta-safety-label')) m.setLayoutProperty('nta-safety-label', 'visibility', 'none');
    }
  }, [safetyOverlayVisible, styleReady]);

  // ── Subway markers ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!map.current || !styleReady) return;
    const m = map.current;

    if (subwayMarkersVisible) {
      if (!m.getSource('subway-stations')) {
        fetch('/api/subway-stations')
          .then((r) => r.json())
          .then((geojson) => {
            if (!m.getSource('subway-stations')) {
              m.addSource('subway-stations', { type: 'geojson', data: geojson });
            }
            if (!m.getLayer('subway-circles')) {
              // Insert below listing pins so listings always render on top
              const beforeListing = m.getLayer('listings-circle') ? 'listings-circle' : undefined;
              m.addLayer({
                id: 'subway-circles',
                type: 'circle',
                source: 'subway-stations',
                paint: {
                  'circle-color': '#60a5fa',
                  'circle-radius': 5,
                  'circle-stroke-color': '#0a1628',
                  'circle-stroke-width': 1.5,
                  'circle-opacity': 0.9,
                },
              }, beforeListing);
              m.addLayer({
                id: 'subway-labels',
                type: 'symbol',
                source: 'subway-stations',
                minzoom: 14,
                layout: {
                  'text-field': ['get', 'name'],
                  'text-font': ['Open Sans Regular'],
                  'text-size': 10,
                  'text-offset': [0, 1.2],
                  'text-anchor': 'top',
                },
                paint: {
                  'text-color': '#bfdbfe',
                  'text-halo-color': '#0a1628',
                  'text-halo-width': 1.5,
                },
              }, beforeListing);
            }
          })
          .catch(console.error);
      } else {
        if (m.getLayer('subway-circles')) m.setLayoutProperty('subway-circles', 'visibility', 'visible');
        if (m.getLayer('subway-labels')) m.setLayoutProperty('subway-labels', 'visibility', 'visible');
      }
    } else {
      if (m.getLayer('subway-circles')) m.setLayoutProperty('subway-circles', 'visibility', 'none');
      if (m.getLayer('subway-labels')) m.setLayoutProperty('subway-labels', 'visibility', 'none');
    }
  }, [subwayMarkersVisible, styleReady]);

  return <div ref={mapContainer} className="h-full w-full" />;
}
