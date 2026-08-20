import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { POIBase } from '../types';
import { useWikipedia } from '../hooks/useWikipedia';
import { useWikidata } from '../hooks/useWikidata';
import { useFactGrid } from '../hooks/useFactGrid';
import { useAdmin } from '../admin/useAdmin';
import { fetchWikidataLabels, fetchFactGridLabels } from '../api/wikidata';
import ImageGallery from './ImageGallery';
import StatementsPanel from './StatementsPanel';
import PageviewChart from './PageviewChart';

interface POIDetailProps {
  poi: POIBase;
}

export default function POIDetail({ poi }: POIDetailProps) {
  const { t, i18n } = useTranslation();
  const { getConfig } = useAdmin();
  const adminCfg = getConfig(poi.id);
  const lang = i18n.language as 'de' | 'en';
  const title = lang === 'en' ? poi.title_en : poi.title_de;

  const wikiTitle = lang === 'en' && poi.wikipedia_en
    ? poi.wikipedia_en
    : poi.wikipedia_de;
  const wikiLang = lang === 'en' && poi.wikipedia_en ? 'en' : 'de';
  const { data: wiki, loading } = useWikipedia(wikiTitle, wikiLang);
  const { data: wikidata } = useWikidata(poi.wikidata_id);
  const effectiveFactgridId = adminCfg.factgridIdOverride !== undefined
    ? adminCfg.factgridIdOverride
    : poi.factgrid_id;
  const { data: factgrid } = useFactGrid(effectiveFactgridId);

  const fetchWdLabels = useCallback(
    (ids: string[], l: string) => fetchWikidataLabels(ids, l),
    []
  );
  const fetchFgLabels = useCallback(
    (ids: string[], l: string) => fetchFactGridLabels(ids, l),
    []
  );

  return (
    <div style={{ padding: 16, maxWidth: 600, margin: '0 auto' }}>
      {/* Hero image */}
      {(adminCfg.heroImage || wiki?.thumbnail) && (
        <img
          src={adminCfg.heroImage ?? wiki!.thumbnail!.source}
          alt={title}
          style={{
            width: '100%',
            height: 200,
            objectFit: 'cover',
            borderRadius: 8,
            marginBottom: 12,
          }}
        />
      )}

      {/* Title */}
      <h1
        style={{
          fontSize: 22,
          fontWeight: 800,
          color: 'var(--color-trollingerblau)',
          margin: '0 0 4px',
          lineHeight: 1.2,
        }}
      >
        <span
          style={{
            color: 'var(--color-gerberarot)',
            fontSize: 16,
            marginRight: 8,
          }}
        >
          #{poi.id}
        </span>
        {title}
      </h1>

      {/* Wikipedia extract */}
      {loading ? (
        <p style={{ color: '#999' }}>{t('loading')}</p>
      ) : wiki?.extract ? (
        <p style={{ fontSize: 15, lineHeight: 1.5, color: '#333', marginTop: 12 }}>
          {adminCfg.previewLength !== null && wiki.extract.length > adminCfg.previewLength
            ? wiki.extract.slice(0, adminCfg.previewLength) + '…'
            : wiki.extract}
        </p>
      ) : (
        <p style={{ color: '#999', marginTop: 12 }}>{t('no_description')}</p>
      )}

      {/* Wikipedia link */}
      {wiki?.content_urls && (
        <a
          href={wiki.content_urls.mobile.page}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-block',
            marginTop: 8,
            color: 'var(--color-seidengruen)',
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          {t('read_more_wikipedia')} →
        </a>
      )}

      {/* Wikipedia pageview stats */}
      <PageviewChart articleDe={poi.wikipedia_de} articleEn={poi.wikipedia_en} />

      {/* Wikidata statements */}
      {poi.wikidata_id && wikidata && (
        <StatementsPanel
          claims={wikidata.claims}
          entityId={poi.wikidata_id}
          source="wikidata"
          accentColor="var(--color-trollingerblau)"
          bgColor="#f0f4ff"
          title={t('wikidata_statements')}
          fetchLabels={fetchWdLabels}
          allowedProperties={adminCfg.wikidataProperties}
        />
      )}

      {/* FactGrid statements */}
      {effectiveFactgridId && factgrid && (
        <StatementsPanel
          claims={factgrid.claims}
          entityId={effectiveFactgridId}
          source="factgrid"
          accentColor="var(--color-loungeviolett)"
          bgColor="#f8f6ff"
          title={t('factgrid_statements')}
          fetchLabels={fetchFgLabels}
          allowedProperties={adminCfg.factgridProperties}
        />
      )}

      {/* Image gallery */}
      <ImageGallery category={poi.commons_category} allowedImages={adminCfg.selectedImages} />
    </div>
  );
}
