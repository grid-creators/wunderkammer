import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { POIBase, POIPrebuilt } from '../types';
import { useAdmin } from '../admin/useAdmin';
import { useAllPois } from '../admin/useAllPois';
import POICard from './POICard';

interface POIListProps {
  onPOIClick: (poi: POIBase) => void;
}

export default function POIList({ onPOIClick }: POIListProps) {
  const { t } = useTranslation();
  const { getConfig } = useAdmin();
  const pois = useAllPois();
  const [markerImages, setMarkerImages] = useState<Record<number, string | null>>({});

  useEffect(() => {
    fetch('/data/pois-prebuilt.json')
      .then((r) => r.json())
      .then((data: POIPrebuilt[]) => {
        const map: Record<number, string | null> = {};
        data.forEach((p) => { map[p.id] = p.marker_image; });
        setMarkerImages(map);
      })
      .catch(() => {});
  }, []);

  // Fetch thumbnails for custom POIs not in prebuilt data
  useEffect(() => {
    const missing = pois.filter((p) => !(p.id in markerImages) && (p.wikipedia_de || p.wikipedia_en));
    if (missing.length === 0) return;
    let cancelled = false;
    Promise.all(
      missing.map(async (poi) => {
        const wikiTitle = poi.wikipedia_de || poi.wikipedia_en;
        const lang = poi.wikipedia_de ? 'de' : 'en';
        if (!wikiTitle) return null;
        try {
          const res = await fetch(
            `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiTitle)}`
          );
          if (!res.ok) return null;
          const data = await res.json() as { thumbnail?: { source: string } };
          return { id: poi.id, url: data.thumbnail?.source ?? null };
        } catch {
          return null;
        }
      })
    ).then((results) => {
      if (cancelled) return;
      const updates: Record<number, string | null> = {};
      for (const r of results) {
        if (r) updates[r.id] = r.url;
      }
      if (Object.keys(updates).length > 0) {
        setMarkerImages((prev) => ({ ...prev, ...updates }));
      }
    });
    return () => { cancelled = true; };
  }, [pois, markerImages]);

  return (
    <div style={{ background: '#f5f5f5', minHeight: '100%' }}>
      <h2
        style={{
          padding: '16px 12px 8px',
          margin: 0,
          fontSize: 18,
          fontWeight: 700,
          color: 'var(--color-trollingerblau)',
        }}
      >
        {t('pois_title')}
      </h2>
      <div>
        {pois.filter((poi) => getConfig(poi.id).enabled).map((poi) => (
          <POICard key={poi.id} poi={poi} onClick={onPOIClick} fallbackImage={getConfig(poi.id).heroImage ?? markerImages[poi.id] ?? null} />
        ))}
      </div>
    </div>
  );
}
