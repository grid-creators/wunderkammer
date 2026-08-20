import { useState, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { AdminConfig, AdminPOIConfig, POIBase } from '../types';
import { AdminContext } from './adminContext';
import { loadAdminConfig, saveAdminConfig, getPOIConfig } from './adminStore';

export default function AdminProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AdminConfig>({ pois: {} });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAdminConfig().then((cfg) => {
      setConfig(cfg);
      setLoading(false);
    });
  }, []);

  const getConfig = useCallback(
    (poiId: number) => getPOIConfig(config, poiId),
    [config]
  );

  const updatePOI = useCallback((poiId: number, updates: Partial<AdminPOIConfig>) => {
    setConfig((prev) => {
      const current = getPOIConfig(prev, poiId);
      const next: AdminConfig = {
        ...prev,
        pois: { ...prev.pois, [poiId]: { ...current, ...updates } },
      };
      saveAdminConfig(next);
      return next;
    });
  }, []);

  const updatePOIBase = useCallback((poiId: number, updates: Partial<POIBase>) => {
    setConfig((prev) => {
      const existing = prev.customPois ?? [];
      const next: AdminConfig = {
        ...prev,
        customPois: existing.map((p) => p.id === poiId ? { ...p, ...updates } : p),
      };
      saveAdminConfig(next);
      return next;
    });
  }, []);

  const addPOI = useCallback((poi: POIBase) => {
    setConfig((prev) => {
      const existing = prev.customPois ?? [];
      const next: AdminConfig = {
        ...prev,
        customPois: [...existing, poi],
      };
      saveAdminConfig(next);
      return next;
    });
  }, []);

  const removePOI = useCallback((poiId: number) => {
    setConfig((prev) => {
      const existing = prev.customPois ?? [];
      const next: AdminConfig = {
        ...prev,
        customPois: existing.filter((p) => p.id !== poiId),
      };
      // Also remove any per-POI config
      const { [poiId]: _, ...restPois } = prev.pois;
      next.pois = restPois;
      saveAdminConfig(next);
      return next;
    });
  }, []);

  const reloadConfig = useCallback(async () => {
    const cfg = await loadAdminConfig();
    setConfig(cfg);
  }, []);

  return (
    <AdminContext.Provider value={{ config, getConfig, updatePOI, updatePOIBase, addPOI, removePOI, loading, reloadConfig }}>
      {children}
    </AdminContext.Provider>
  );
}
