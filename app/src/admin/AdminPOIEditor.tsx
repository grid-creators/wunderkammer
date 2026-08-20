import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { POIBase, WikidataClaim } from '../types';
import { useAdmin } from './useAdmin';
import { pois as staticPois } from '../data/pois';
import { patchPoiFactgrid } from './adminStore';
import { fetchWikidataEntity } from '../api/wikidata';
import { fetchFactGridEntity } from '../api/factgrid';
import { fetchWikipediaSummary } from '../api/wikipedia';
import { fetchCommonsImages } from '../api/commons';
import { fetchWikidataLabels, fetchFactGridLabels } from '../api/wikidata';

interface AdminPOIEditorProps {
  poi: POIBase;
  onBack: () => void;
}

interface PropertyInfo {
  id: string;
  label: string;
  valueCount: number;
}

function extractPropertyIds(claims: Record<string, WikidataClaim[]>): string[] {
  return Object.keys(claims).filter((propId) => {
    const list = claims[propId];
    return list && list.length > 0;
  });
}

// Custom hooks to avoid setState-in-effect lint warnings
function useAsyncData<T>(fetcher: () => Promise<T | null>, deps: unknown[]): { data: T | null; loading: boolean } {
  const [state, setState] = useState<{ data: T | null; loading: boolean }>({ data: null, loading: false });
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    setState({ data: null, loading: true });
    fetcher().then((result) => {
      if (mountedRef.current) {
        setState({ data: result, loading: false });
      }
    });
    return () => { mountedRef.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}

export default function AdminPOIEditor({ poi, onBack }: AdminPOIEditorProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as 'de' | 'en';
  const title = lang === 'en' ? poi.title_en : poi.title_de;
  const { getConfig, updatePOI, updatePOIBase } = useAdmin();
  const isStaticPOI = staticPois.some((p) => p.id === poi.id);
  const cfg = getConfig(poi.id);

  // Local editor state
  const [previewLength, setPreviewLength] = useState<number | null>(cfg.previewLength);
  const [wdSelected, setWdSelected] = useState<string[] | null>(cfg.wikidataProperties);
  const [fgSelected, setFgSelected] = useState<string[] | null>(cfg.factgridProperties);
  const [imgSelected, setImgSelected] = useState<string[] | null>(cfg.selectedImages);
  const [heroImage, setHeroImage] = useState<string | null>(cfg.heroImage ?? null);
  const effectiveFactgridId = cfg.factgridIdOverride !== undefined ? cfg.factgridIdOverride : poi.factgrid_id;
  const [factgridId, setFactgridId] = useState<string>(effectiveFactgridId ?? '');

  // Fetch Wikipedia preview text
  const wikiTitle = lang === 'en' && poi.wikipedia_en ? poi.wikipedia_en : poi.wikipedia_de;
  const wikiLang = lang === 'en' && poi.wikipedia_en ? 'en' : 'de';
  const { data: previewText, loading: previewLoading } = useAsyncData(
    () => wikiTitle
      ? fetchWikipediaSummary(wikiTitle, wikiLang).then((d) => d?.extract ?? '')
      : Promise.resolve(''),
    [wikiTitle, wikiLang]
  );

  // Fetch Wikipedia thumbnails (both languages) for hero image picker
  const { data: wikiDeThumb } = useAsyncData(
    () => poi.wikipedia_de
      ? fetchWikipediaSummary(poi.wikipedia_de, 'de').then((d) => d?.thumbnail?.source ?? null)
      : Promise.resolve(null),
    [poi.wikipedia_de]
  );
  const { data: wikiEnThumb } = useAsyncData(
    () => poi.wikipedia_en
      ? fetchWikipediaSummary(poi.wikipedia_en, 'en').then((d) => d?.thumbnail?.source ?? null)
      : Promise.resolve(null),
    [poi.wikipedia_en]
  );

  // Fetch Wikidata properties
  const { data: wdProperties, loading: wdLoading } = useAsyncData(
    async () => {
      if (!poi.wikidata_id) return [];
      const entity = await fetchWikidataEntity(poi.wikidata_id);
      if (!entity) return [];
      const propIds = extractPropertyIds(entity.claims);
      const labels = await fetchWikidataLabels(propIds, lang);
      return propIds.map((id) => ({
        id,
        label: labels[id] || id,
        valueCount: entity.claims[id].length,
      }));
    },
    [poi.wikidata_id, lang]
  );

  // Fetch FactGrid properties
  const { data: fgProperties, loading: fgLoading } = useAsyncData(
    async () => {
      if (!poi.factgrid_id) return [];
      const entity = await fetchFactGridEntity(poi.factgrid_id);
      if (!entity) return [];
      const propIds = extractPropertyIds(entity.claims);
      const labels = await fetchFactGridLabels(propIds, lang);
      return propIds.map((id) => ({
        id,
        label: labels[id] || id,
        valueCount: entity.claims[id].length,
      }));
    },
    [poi.factgrid_id, lang]
  );

  // Fetch Commons images
  const { data: images, loading: imgLoading } = useAsyncData(
    () => poi.commons_category
      ? fetchCommonsImages(poi.commons_category)
      : Promise.resolve([]),
    [poi.commons_category]
  );

  const handleSave = useCallback(async () => {
    const trimmed = factgridId.trim();
    const factgridChanged = trimmed !== (poi.factgrid_id ?? '');
    updatePOI(poi.id, {
      previewLength,
      wikidataProperties: wdSelected,
      factgridProperties: fgSelected,
      selectedImages: imgSelected,
      heroImage,
      factgridIdOverride: factgridChanged ? (trimmed || null) : undefined,
    });
    if (factgridChanged) {
      if (isStaticPOI) {
        const ok = await patchPoiFactgrid(poi.id, trimmed || null);
        if (ok) updatePOI(poi.id, { factgridIdOverride: undefined });
      } else {
        updatePOIBase(poi.id, { factgrid_id: trimmed || null });
        updatePOI(poi.id, { factgridIdOverride: undefined });
      }
    }
    onBack();
  }, [poi.id, poi.factgrid_id, previewLength, wdSelected, fgSelected, imgSelected, heroImage, factgridId, isStaticPOI, updatePOI, updatePOIBase, onBack]);

  const toggleProperty = (
    current: string[] | null,
    setter: (v: string[] | null) => void,
    allIds: string[],
    propId: string
  ) => {
    const selected = current ?? allIds;
    if (selected.includes(propId)) {
      const next = selected.filter((id) => id !== propId);
      setter(next.length === allIds.length ? null : next);
    } else {
      const next = [...selected, propId];
      setter(next.length === allIds.length ? null : next);
    }
  };

  const toggleImage = (filename: string) => {
    const allFilenames = (images ?? []).map((img) => img.title);
    const selected = imgSelected ?? allFilenames;
    if (selected.includes(filename)) {
      const next = selected.filter((f) => f !== filename);
      applyImgSelection(next, allFilenames);
    } else {
      const next = [...selected, filename];
      applyImgSelection(next, allFilenames);
    }
  };

  const applyImgSelection = (next: string[], all: string[]) => {
    setImgSelected(next.length === all.length ? null : next);
  };

  const sectionStyle = {
    background: '#fff',
    borderRadius: 8,
    padding: '14px',
    marginBottom: 12,
  };

  const labelStyle = {
    fontSize: 13,
    fontWeight: 700 as const,
    color: 'var(--color-trollingerblau)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
    marginBottom: 8,
    display: 'block' as const,
  };

  const actualPreviewText = previewText ?? '';

  return (
    <div style={{ background: '#f5f5f5', minHeight: '100%' }}>
      {/* Header */}
      <div style={{
        padding: '12px 12px 8px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <button
          onClick={onBack}
          style={{
            background: 'transparent',
            border: 'none',
            fontSize: 20,
            cursor: 'pointer',
            padding: '4px 8px',
            color: 'var(--color-trollingerblau)',
          }}
        >
          ←
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{
            margin: 0,
            fontSize: 16,
            fontWeight: 700,
            color: 'var(--color-trollingerblau)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            <span style={{ color: 'var(--color-gerberarot)', marginRight: 6 }}>
              #{poi.id}
            </span>
            {title}
          </h2>
        </div>
      </div>

      <div style={{ padding: '0 12px 16px' }}>
        {/* FactGrid ID */}
        <div style={sectionStyle}>
          <span style={labelStyle}>FactGrid ID</span>
          <input
            type="text"
            value={factgridId}
            onChange={(e) => setFactgridId(e.target.value)}
            placeholder="Q12345"
            style={{
              width: '100%',
              padding: '8px 10px',
              fontSize: 14,
              border: '1px solid #ddd',
              borderRadius: 6,
              outline: 'none',
              fontFamily: 'var(--font-family)',
              boxSizing: 'border-box' as const,
            }}
          />
          {poi.factgrid_id && factgridId.trim() !== poi.factgrid_id && (
            <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
              {t('admin_factgrid_original')}: {poi.factgrid_id}
            </div>
          )}
        </div>

        {/* Preview text length */}
        {(poi.wikipedia_de || poi.wikipedia_en) && (
          <div style={sectionStyle}>
            <span style={labelStyle}>{t('admin_preview_length')}</span>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="checkbox"
                  checked={previewLength === null}
                  onChange={() => setPreviewLength(previewLength === null ? 200 : null)}
                />
                {t('admin_full_text')}
              </label>
            </div>

            {previewLength !== null && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <input
                    type="range"
                    min={50}
                    max={Math.max(actualPreviewText.length, 500)}
                    value={previewLength}
                    onChange={(e) => setPreviewLength(Number(e.target.value))}
                    style={{ flex: 1 }}
                  />
                  <span style={{ fontSize: 13, color: '#666', minWidth: 60, textAlign: 'right' }}>
                    {previewLength} {t('admin_chars')}
                  </span>
                </div>

                {/* Preview */}
                <div style={{
                  background: '#f8f8f8',
                  borderRadius: 6,
                  padding: 10,
                  fontSize: 13,
                  lineHeight: 1.5,
                  color: '#444',
                  maxHeight: 150,
                  overflow: 'auto',
                }}>
                  {previewLoading ? t('loading') : (
                    actualPreviewText.length > previewLength
                      ? actualPreviewText.slice(0, previewLength) + '\u2026'
                      : actualPreviewText
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Wikidata statements */}
        {poi.wikidata_id && (
          <div style={sectionStyle}>
            <span style={labelStyle}>{t('wikidata_statements')}</span>
            {wdLoading ? (
              <div style={{ fontSize: 13, color: '#999' }}>{t('loading')}</div>
            ) : !wdProperties || wdProperties.length === 0 ? (
              <div style={{ fontSize: 13, color: '#999' }}>{t('admin_no_properties')}</div>
            ) : (
              <PropertyCheckboxList
                properties={wdProperties}
                selected={wdSelected}
                onToggle={(propId) => toggleProperty(wdSelected, setWdSelected, wdProperties.map((p) => p.id), propId)}
                onSelectAll={() => setWdSelected(null)}
                onSelectNone={() => setWdSelected([])}
                t={t}
              />
            )}
          </div>
        )}

        {/* FactGrid statements */}
        {poi.factgrid_id && (
          <div style={sectionStyle}>
            <span style={labelStyle}>{t('factgrid_statements')}</span>
            {fgLoading ? (
              <div style={{ fontSize: 13, color: '#999' }}>{t('loading')}</div>
            ) : !fgProperties || fgProperties.length === 0 ? (
              <div style={{ fontSize: 13, color: '#999' }}>{t('admin_no_properties')}</div>
            ) : (
              <PropertyCheckboxList
                properties={fgProperties}
                selected={fgSelected}
                onToggle={(propId) => toggleProperty(fgSelected, setFgSelected, fgProperties.map((p) => p.id), propId)}
                onSelectAll={() => setFgSelected(null)}
                onSelectNone={() => setFgSelected([])}
                t={t}
              />
            )}
          </div>
        )}

        {/* Hero image picker */}
        {(poi.wikipedia_de || poi.wikipedia_en || poi.commons_category) && (() => {
          const heroOptions: { url: string; label: string }[] = [];
          if (wikiDeThumb) heroOptions.push({ url: wikiDeThumb, label: 'Wikipedia DE' });
          if (wikiEnThumb && wikiEnThumb !== wikiDeThumb) heroOptions.push({ url: wikiEnThumb, label: 'Wikipedia EN' });
          (images ?? []).forEach((img) => heroOptions.push({ url: img.url, label: img.title }));
          return heroOptions.length > 0 ? (
            <div style={sectionStyle}>
              <span style={labelStyle}>{t('admin_hero_image')}</span>
              <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 8 }}>
                <div
                  onClick={() => setHeroImage(null)}
                  style={{
                    cursor: 'pointer',
                    borderRadius: 6,
                    border: heroImage === null ? '3px solid var(--color-gerberarot)' : '3px solid #ddd',
                    padding: '6px 12px',
                    fontSize: 12,
                    fontWeight: 600,
                    color: heroImage === null ? 'var(--color-gerberarot)' : '#666',
                    background: heroImage === null ? '#fff5f5' : '#fafafa',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  {t('admin_hero_image_default')}
                </div>
                {heroOptions.map((opt) => (
                  <div
                    key={opt.url}
                    onClick={() => setHeroImage(heroImage === opt.url ? null : opt.url)}
                    title={opt.label}
                    style={{
                      position: 'relative',
                      cursor: 'pointer',
                      borderRadius: 6,
                      overflow: 'hidden',
                      border: heroImage === opt.url ? '3px solid var(--color-gerberarot)' : '3px solid transparent',
                      opacity: heroImage !== null && heroImage !== opt.url ? 0.45 : 1,
                      transition: 'opacity 0.2s, border-color 0.2s',
                      width: 100,
                      flexShrink: 0,
                    }}
                  >
                    <img
                      src={opt.url}
                      alt={opt.label}
                      style={{ width: '100%', height: 70, objectFit: 'cover', display: 'block' }}
                    />
                    {heroImage === opt.url && (
                      <div style={{
                        position: 'absolute',
                        top: 4,
                        right: 4,
                        width: 18,
                        height: 18,
                        borderRadius: 9,
                        background: 'var(--color-gerberarot)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 11,
                        color: '#fff',
                        fontWeight: 700,
                      }}>★</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : null;
        })()}

        {/* Commons images */}
        {poi.commons_category && (
          <div style={sectionStyle}>
            <span style={labelStyle}>{t('images')}</span>
            {imgLoading ? (
              <div style={{ fontSize: 13, color: '#999' }}>{t('loading')}</div>
            ) : !images || images.length === 0 ? (
              <div style={{ fontSize: 13, color: '#999' }}>{t('admin_no_images')}</div>
            ) : (
              <div>
                <div style={{ marginBottom: 8, display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => setImgSelected(null)}
                    style={miniButtonStyle(imgSelected === null)}
                  >
                    {t('admin_all')} ({images.length})
                  </button>
                  <button
                    onClick={() => setImgSelected([])}
                    style={miniButtonStyle(imgSelected !== null && imgSelected.length === 0)}
                  >
                    {t('admin_none')}
                  </button>
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
                  gap: 6,
                  maxHeight: 350,
                  overflow: 'auto',
                }}>
                  {images.map((img) => {
                    const checked = imgSelected === null || imgSelected.includes(img.title);
                    return (
                      <div
                        key={img.title}
                        onClick={() => toggleImage(img.title)}
                        style={{
                          position: 'relative',
                          cursor: 'pointer',
                          borderRadius: 6,
                          overflow: 'hidden',
                          border: checked ? '3px solid var(--color-seidengruen)' : '3px solid transparent',
                          opacity: checked ? 1 : 0.4,
                          transition: 'opacity 0.2s, border-color 0.2s',
                        }}
                      >
                        <img
                          src={img.thumbUrl}
                          alt={img.title}
                          style={{
                            width: '100%',
                            height: 80,
                            objectFit: 'cover',
                            display: 'block',
                          }}
                        />
                        <div style={{
                          position: 'absolute',
                          top: 4,
                          right: 4,
                          width: 18,
                          height: 18,
                          borderRadius: 4,
                          background: checked ? 'var(--color-seidengruen)' : 'rgba(255,255,255,0.8)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 12,
                          color: '#fff',
                          fontWeight: 700,
                        }}>
                          {checked ? '\u2713' : ''}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Save button */}
        <button
          onClick={handleSave}
          style={{
            width: '100%',
            padding: '14px',
            background: 'var(--color-seidengruen)',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontSize: 15,
            fontWeight: 700,
            cursor: 'pointer',
            marginTop: 4,
          }}
        >
          {t('admin_save')}
        </button>
      </div>
    </div>
  );
}

function PropertyCheckboxList({
  properties,
  selected,
  onToggle,
  onSelectAll,
  onSelectNone,
  t,
}: {
  properties: PropertyInfo[];
  selected: string[] | null;
  onToggle: (propId: string) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
  t: (key: string) => string;
}) {
  return (
    <div>
      <div style={{ marginBottom: 8, display: 'flex', gap: 8 }}>
        <button onClick={onSelectAll} style={miniButtonStyle(selected === null)}>
          {t('admin_all')}
        </button>
        <button onClick={onSelectNone} style={miniButtonStyle(selected !== null && selected.length === 0)}>
          {t('admin_none')}
        </button>
      </div>
      <div style={{ maxHeight: 250, overflow: 'auto' }}>
        {properties.map((prop) => {
          const checked = selected === null || selected.includes(prop.id);
          return (
            <label
              key={prop.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '4px 0',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(prop.id)}
              />
              <span style={{ flex: 1 }}>
                {prop.label}
                <span style={{ color: '#999', marginLeft: 4 }}>({prop.id})</span>
              </span>
              <span style={{ fontSize: 11, color: '#999' }}>
                {prop.valueCount}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function miniButtonStyle(active: boolean) {
  return {
    padding: '4px 10px',
    fontSize: 12,
    fontWeight: 600 as const,
    border: active ? '1px solid var(--color-trollingerblau)' : '1px solid #ddd',
    borderRadius: 4,
    background: active ? 'var(--color-trollingerblau)' : '#fff',
    color: active ? '#fff' : '#666',
    cursor: 'pointer' as const,
  };
}
