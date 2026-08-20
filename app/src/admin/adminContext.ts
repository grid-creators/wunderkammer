import { createContext } from 'react';
import type { AdminConfig, AdminPOIConfig, POIBase } from '../types';

export interface AdminContextValue {
  config: AdminConfig;
  getConfig: (poiId: number) => AdminPOIConfig;
  updatePOI: (poiId: number, updates: Partial<AdminPOIConfig>) => void;
  updatePOIBase: (poiId: number, updates: Partial<POIBase>) => void;
  addPOI: (poi: POIBase) => void;
  removePOI: (poiId: number) => void;
  loading: boolean;
  reloadConfig: () => Promise<void>;
}

export const AdminContext = createContext<AdminContextValue | null>(null);
