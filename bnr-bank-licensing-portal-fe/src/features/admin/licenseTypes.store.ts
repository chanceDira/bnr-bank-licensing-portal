import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const DEFAULTS = [
  'Commercial Bank License',
  'Microfinance Institution License',
  'Savings and Credit Cooperative License',
  'Foreign Bank Branch License',
  'Payment Service Provider License',
  'Development Finance Institution License',
];

interface LicenseTypesState {
  types: string[];
  add:    (label: string) => void;
  update: (old: string, next: string) => void;
  remove: (label: string) => void;
}

export const useLicenseTypesStore = create<LicenseTypesState>()(
  persist(
    (set, get) => ({
      types: DEFAULTS,

      add: (label) => {
        const trimmed = label.trim();
        if (!trimmed || get().types.includes(trimmed)) return;
        set(s => ({ types: [...s.types, trimmed] }));
      },

      update: (old, next) => {
        const trimmed = next.trim();
        if (!trimmed || (trimmed !== old && get().types.includes(trimmed))) return;
        set(s => ({ types: s.types.map(t => (t === old ? trimmed : t)) }));
      },

      remove: (label) => {
        set(s => ({ types: s.types.filter(t => t !== label) }));
      },
    }),
    { name: 'bnr-license-types' },
  ),
);
