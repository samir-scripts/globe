import { create } from 'zustand';

export type MetricType = 'homicide_rate' | 'homicide_count';

interface FilterState {
  continent: string | null;
  country: string | null;
  metric: MetricType;
  year: number;
  selectedCountryIso3: string | null;
  selectedCountryName: string | null;
  isChartPanelOpen: boolean;
  activeMetric: string;
  setContinent: (continent: string | null) => void;
  setCountry: (country: string | null) => void;
  setMetric: (metric: MetricType) => void;
  setYear: (year: number) => void;
  setActiveMetric: (metricId: string) => void;
  resetFilters: () => void;
  selectCountry: (iso3: string, name: string) => void;
  closeChartPanel: () => void;
}

export const useFilterStore = create<FilterState>((set) => ({
  continent: 'All',
  country: 'All',
  metric: 'homicide_rate',
  year: 2021,
  selectedCountryIso3: null,
  selectedCountryName: null,
  isChartPanelOpen: false,
  activeMetric: 'homicide',
  setContinent: (continent) => set({ continent, country: 'All' }),
  setCountry: (country) => set({ country }),
  setMetric: (metric) => set({ metric }),
  setYear: (year) => set({ year }),
  setActiveMetric: (activeMetric) => set({ activeMetric }),
  resetFilters: () => set({ continent: 'All', country: 'All', metric: 'homicide_rate', year: 2021, activeMetric: 'homicide' }),
  selectCountry: (iso3, name) => set({ selectedCountryIso3: iso3, selectedCountryName: name, isChartPanelOpen: true }),
  closeChartPanel: () => set({ isChartPanelOpen: false, selectedCountryIso3: null, selectedCountryName: null }),
}));
