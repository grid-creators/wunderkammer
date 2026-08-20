import { useTranslation } from 'react-i18next';
import type { POIBase } from '../types';
import { useWikipedia } from '../hooks/useWikipedia';

interface POICardProps {
  poi: POIBase;
  onClick: (poi: POIBase) => void;
  fallbackImage?: string | null;
}

export default function POICard({ poi, onClick, fallbackImage }: POICardProps) {
  const { i18n } = useTranslation();
  const lang = i18n.language as 'de' | 'en';
  const title = lang === 'en' ? poi.title_en : poi.title_de;
  const wikiTitle = lang === 'en' ? poi.wikipedia_en : poi.wikipedia_de;
  const { data: wiki } = useWikipedia(wikiTitle || poi.wikipedia_de, lang === 'en' && !poi.wikipedia_en ? 'de' : lang);

  return (
    <button
      onClick={() => onClick(poi)}
      style={{
        display: 'flex',
        gap: 12,
        padding: 12,
        background: '#fff',
        border: 'none',
        borderBottom: '1px solid #eee',
        width: '100%',
        textAlign: 'left',
        cursor: 'pointer',
        fontFamily: 'var(--font-family)',
      }}
    >
      {(fallbackImage || wiki?.thumbnail?.source) && (
        <img
          src={fallbackImage || wiki?.thumbnail?.source!}
          alt={title}
          style={{
            width: 72,
            height: 72,
            objectFit: 'cover',
            borderRadius: 6,
            flexShrink: 0,
          }}
        />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontWeight: 700,
            fontSize: 15,
            color: 'var(--color-trollingerblau)',
            marginBottom: 4,
          }}
        >
          <span style={{
            color: 'var(--color-gerberarot)',
            marginRight: 6,
            fontWeight: 800,
            fontSize: 13,
          }}>
            {poi.id}
          </span>
          {title}
        </div>
        {wiki?.extract && (
          <div
            style={{
              fontSize: 13,
              color: '#666',
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              lineHeight: 1.3,
            }}
          >
            {wiki.extract}
          </div>
        )}
      </div>
    </button>
  );
}
