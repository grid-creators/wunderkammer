import type { AdminConfig, AdminPOIConfig } from '../types';

const TOKEN_KEY = 'wunderkammer_admin_token';

const DEFAULT_POI_CONFIG: AdminPOIConfig = {
  enabled: true,
  previewLength: null,
  wikidataProperties: null,
  factgridProperties: null,
  selectedImages: null,
  heroImage: null,
};

export async function loadAdminConfig(): Promise<AdminConfig> {
  try {
    const res = await fetch('/api/config');
    if (res.ok) return await res.json() as AdminConfig;
  } catch { /* ignore */ }
  return { pois: {} };
}

export async function saveAdminConfig(config: AdminConfig): Promise<void> {
  const token = localStorage.getItem(TOKEN_KEY);
  await fetch('/api/config', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(config),
  });
}

export function getPOIConfig(config: AdminConfig, poiId: number): AdminPOIConfig {
  return config.pois[poiId] ?? DEFAULT_POI_CONFIG;
}

export function isPOIEnabled(config: AdminConfig, poiId: number): boolean {
  return getPOIConfig(config, poiId).enabled;
}

export async function patchPoiFactgrid(poiId: number, factgridId: string | null): Promise<boolean> {
  const token = localStorage.getItem(TOKEN_KEY);
  try {
    const res = await fetch(`/api/pois/${poiId}/factgrid`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ factgridId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error(`patchPoiFactgrid failed (${res.status}):`, err);
      return false;
    }
    return true;
  } catch (e) {
    console.error('patchPoiFactgrid error:', e);
    return false;
  }
}

export { DEFAULT_POI_CONFIG };
