import { MapContainer, TileLayer } from 'react-leaflet';
import { useTranslation } from 'react-i18next';
import { useState, useEffect } from 'react';
import type { POIBase, POIPrebuilt } from '../types';
import { useAdmin } from '../admin/useAdmin';
import { useAllPois } from '../admin/useAllPois';
import POIMarkerComp from './POIMarker';
import 'leaflet/dist/leaflet.css';

interface MapViewProps {
  activePOI: POIBase | null;
  onPOIClick: (poi: POIBase) => void;
}

const GOTHA_CENTER: [number, number] = [50.9474, 10.7048];

export default function MapView({ activePOI, onPOIClick }: MapViewProps) {
  const { i18n } = useTranslation();
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
    <MapContainer
      center={GOTHA_CENTER}
      zoom={15}
      style={{ width: '100%', height: '100%' }}
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {pois.filter((poi) => getConfig(poi.id).enabled).map((poi) => (
        <POIMarkerComp
          key={poi.id}
          poi={poi}
          active={activePOI?.id === poi.id}
          lang={i18n.language}
          onClick={onPOIClick}
          markerImage={getConfig(poi.id).heroImage ?? markerImages[poi.id] ?? null}
        />
      ))}
    </MapContainer>
  );
}
