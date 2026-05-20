'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useFilterStore, MetricType } from '@/store/useFilterStore';
import { fetchGraphQL } from '@/lib/hasura';
import { GET_HOMICIDE_TIME_SERIES } from '@/queries/crime';
import { METRICS, MetricId } from '@/types/metrics';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';

const CONTINENTS = ['All', 'Africa', 'Americas', 'Asia', 'Europe', 'Oceania'];

interface HomicideDataPoint {
  reporting_year: number;
  homicide_rate: number;
  country_name: string;
}

export default function CountryChart() {
  const { 
    selectedCountryIso3, 
    selectedCountryName, 
    isChartPanelOpen, 
    closeChartPanel,
    continent,
    setContinent,
    year,
    setYear,
    metric,
    setMetric,
    activeMetric,
    setActiveMetric
  } = useFilterStore();

  const [data, setData] = useState<HomicideDataPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastFetchedIso3 = useRef<string | null>(null);

  const fetchData = useCallback(async (iso3: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchGraphQL(GET_HOMICIDE_TIME_SERIES, { iso3 }) as { fct_homicides: HomicideDataPoint[] };
      setData(result.fct_homicides ?? []);
    } catch (err) {
      console.error('Failed to fetch homicide time series:', err);
      setError('Failed to load data.');
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedCountryIso3 || !isChartPanelOpen) return;
    if (lastFetchedIso3.current === selectedCountryIso3) return;
    lastFetchedIso3.current = selectedCountryIso3;
    fetchData(selectedCountryIso3);
  });

  useEffect(() => {
    if (!isChartPanelOpen) {
      lastFetchedIso3.current = null;
    }
  }, [isChartPanelOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isChartPanelOpen) {
        closeChartPanel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isChartPanelOpen, closeChartPanel]);

  const currentMetricConfig = METRICS.find(m => m.id === activeMetric) || METRICS[0];

  return (
    <div
      className="fixed right-0 top-0 h-full w-[400px] z-20 border-l border-border bg-card text-card-foreground shadow-2xl flex flex-col transition-transform duration-300 ease-out"
      style={{
        transform: isChartPanelOpen ? 'translateX(0)' : 'translateX(100%)',
      }}
      aria-hidden={!isChartPanelOpen}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <h2 className="text-sm font-semibold uppercase tracking-wider font-mono">
          {selectedCountryName ?? 'Country Data'}
        </h2>
        <button
          onClick={closeChartPanel}
          className="text-card-foreground/60 hover:text-card-foreground transition-colors text-xl leading-none cursor-pointer"
          aria-label="Close panel"
        >
          ×
        </button>
      </div>

      {/* Filters Section */}
      <div className="px-5 py-6 space-y-6 border-b border-border bg-muted/30">
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground uppercase tracking-wide font-mono">Dataset</label>
          <Select value={activeMetric} onValueChange={(val) => setActiveMetric(val as MetricId)}>
            <SelectTrigger className="bg-background border-border text-foreground">
              <SelectValue placeholder="Select Dataset" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border text-card-foreground">
              {METRICS.map(m => (
                <SelectItem key={m.id} value={m.id} className="focus:bg-primary focus:text-primary-foreground">
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground uppercase tracking-wide font-mono">Continent</label>
            <Select value={continent || 'All'} onValueChange={(val) => setContinent(val)}>
              <SelectTrigger className="bg-background border-border text-foreground">
                <SelectValue placeholder="Continent" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border text-card-foreground">
                {CONTINENTS.map(c => (
                  <SelectItem key={c} value={c} className="focus:bg-primary focus:text-primary-foreground">
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-muted-foreground uppercase tracking-wide font-mono">Metric Type</label>
            <Select value={metric} onValueChange={(val) => setMetric(val as MetricType)}>
              <SelectTrigger className="bg-background border-border text-foreground">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border text-card-foreground">
                <SelectItem value="homicide_rate">Rate</SelectItem>
                <SelectItem value="homicide_count">Count</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2 pt-2">
          <div className="flex justify-between items-center">
            <label className="text-xs text-muted-foreground uppercase tracking-wide font-mono">Year: {year}</label>
          </div>
          <Slider
            value={[year]}
            min={2000}
            max={2022}
            step={1}
            onValueChange={(vals) => {
              if (Array.isArray(vals)) setYear(vals[0]);
            }}
            className="py-2"
          />
        </div>
      </div>

      {/* Chart Section */}
      <div className="flex-1 flex flex-col px-5 py-6 overflow-y-auto">
        <h3 className="text-xs uppercase tracking-wider text-card-foreground/50 mb-6 font-mono">
          {currentMetricConfig.label} {metric === 'homicide_rate' ? 'Rate' : 'Count'} Over Time
        </h3>

        {loading && (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 border-2 border-card-foreground/20 border-t-red-500 rounded-full animate-spin" />
              <span className="text-xs text-card-foreground/50">Loading data…</span>
            </div>
          </div>
        )}

        {error && !loading && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {!loading && !error && data.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-center">
            <p className="text-sm text-card-foreground/40 max-w-[200px]">
              {selectedCountryIso3 ? 'No time-series data available for this selection.' : 'Select a country on the globe to view details.'}
            </p>
          </div>
        )}

        {!loading && !error && data.length > 0 && (
          <div className="flex-1 min-h-[300px] min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <LineChart
                data={data}
                margin={{ top: 8, right: 12, left: -4, bottom: 8 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="currentColor"
                  strokeOpacity={0.1}
                />
                <XAxis
                  dataKey="reporting_year"
                  tick={{ fontSize: 11, fill: 'currentColor', fillOpacity: 0.6 }}
                  tickLine={false}
                  axisLine={{ stroke: 'currentColor', strokeOpacity: 0.15 }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'currentColor', fillOpacity: 0.6 }}
                  tickLine={false}
                  axisLine={{ stroke: 'currentColor', strokeOpacity: 0.15 }}
                  width={40}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: 'var(--card-foreground)',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                  }}
                  labelFormatter={(label) => `Year: ${label}`}
                  formatter={(value) => [Number(value).toFixed(2), currentMetricConfig.label]}
                />
                <Line
                  type="monotone"
                  dataKey={metric}
                  stroke={currentMetricConfig.color}
                  strokeWidth={2}
                  dot={{ r: 3, fill: currentMetricConfig.color, strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: currentMetricConfig.color, strokeWidth: 2, stroke: '#fff' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
