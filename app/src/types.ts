export interface POIBase {
  id: number;
  slug: string;
  title_de: string;
  title_en: string;
  lat: number;
  lng: number;
  uuid: string;
  factgrid_id: string | null;
  wikipedia_de: string | null;
  wikipedia_en: string | null;
  wikidata_id: string | null;
  commons_category: string | null;
}

export interface WikipediaSummary {
  title: string;
  extract: string;
  thumbnail?: {
    source: string;
    width: number;
    height: number;
  };
  content_urls?: {
    desktop: { page: string };
    mobile: { page: string };
  };
}

export interface WikidataEntity {
  id: string;
  labels: Record<string, { value: string }>;
  descriptions: Record<string, { value: string }>;
  claims: Record<string, WikidataClaim[]>;
}

export interface WikidataClaim {
  mainsnak: {
    snaktype: string;
    property: string;
    datatype?: string;
    datavalue?: {
      value: unknown;
      type: string;
    };
  };
  rank?: string;
}

export interface FactGridEntity {
  id: string;
  labels: Record<string, { value: string }>;
  descriptions: Record<string, { value: string }>;
  claims: Record<string, WikidataClaim[]>;
}

export interface CommonsImage {
  title: string;
  url: string;
  thumbUrl: string;
  width: number;
  height: number;
}

export interface POIPrebuilt {
  id: number;
  summary_de: string;
  summary_en: string;
  thumbnail: string | null;
  marker_image: string | null;
  wikidata_label: string | null;
  wikidata_description_de: string | null;
  wikidata_description_en: string | null;
  factgrid_label: string | null;
  factgrid_description: string | null;
  images: string[];
  fetched_at: string;
}

export type ViewMode = 'map' | 'list';

export interface AdminPOIConfig {
  enabled: boolean;
  previewLength: number | null; // max chars for Wikipedia extract, null = full
  wikidataProperties: string[] | null; // property IDs to show, null = all
  factgridProperties: string[] | null; // property IDs to show, null = all
  selectedImages: string[] | null; // image filenames to show, null = all
  heroImage: string | null; // override hero image URL, null = use Wikipedia default
  factgridIdOverride?: string | null; // override factgrid_id, undefined = use POI default
}

export interface AdminConfig {
  pois: Record<number, AdminPOIConfig>;
  customPois?: POIBase[];
}
