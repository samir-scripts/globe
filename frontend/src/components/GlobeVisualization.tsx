'use client';

import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useFilterStore } from '@/store/useFilterStore';
import { fetchGraphQL } from '@/lib/hasura';
import { GET_HOMICIDE_DATA, GET_HOMICIDE_DATA_BY_CONTINENT } from '@/queries/crime';
import type { GlobeMethods } from 'react-globe.gl';
import * as THREE from 'three';

// Dynamically import Globe to avoid SSR issues with Three.js
const Globe = dynamic(() => import('react-globe.gl'), { 
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full text-muted-foreground font-mono text-sm tracking-wider uppercase">Loading Globe...</div>
});

// --- Types ---
interface HomicideRecord {
  country_name: string;
  iso3: string;
  continent: string;
  reporting_year: number;
  homicide_rate: number;
  geom: unknown;
}

interface GeoJsonFeature {
  type: string;
  properties: Record<string, unknown>;
  geometry: unknown;
}

interface GeoJsonCollection {
  type: string;
  features: GeoJsonFeature[];
}

interface EnrichedProperties extends Record<string, unknown> {
  homicide_rate: number;
  country_name: string;
  iso3: string;
  hasData: boolean;
  ADMIN?: string;
  LABEL_Y?: number;
  LABEL_X?: number;
  ISO_A3?: string;
}

interface EnrichedFeature extends GeoJsonFeature {
  properties: EnrichedProperties;
}

// Color interpolation for homicide rate heat map
function getHeatColor(rate: number, isDark: boolean): string {
  // Normalize rate: 0 = low, 1 = high (cap at 30 per 100k)
  const t = Math.min(rate / 30, 1);
  
  if (isDark) {
    // Dark mode: transparent → dim red → bright red
    const r = Math.round(40 + t * 199);
    const g = Math.round(40 - t * 30);
    const b = Math.round(40 - t * 30);
    const a = 0.15 + t * 0.7;
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  } else {
    // Light mode: light gray → dim red → vivid red
    const r = Math.round(220 + t * 20);
    const g = Math.round(220 - t * 185);
    const b = Math.round(220 - t * 185);
    const a = 0.4 + t * 0.55;
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }
}

export default function GlobeVisualization() {
  const { continent, year, selectCountry } = useFilterStore();
  const [countriesData, setCountriesData] = useState<HomicideRecord[]>([]);
  const [geoJson, setGeoJson] = useState<GeoJsonCollection | null>(null);
  const [isDark, setIsDark] = useState(false);
  const globeEl = useRef<GlobeMethods | undefined>(undefined);

  // Track dark mode changes
  useEffect(() => {
    const checkDark = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };
    checkDark();

    const observer = new MutationObserver(checkDark);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // Load GeoJSON from local bundle
  useEffect(() => {
    fetch('/countries.geojson')
      .then(res => res.json())
      .then((data: GeoJsonCollection) => setGeoJson(data));
  }, []);

  // Fetch data from Hasura based on filters
  useEffect(() => {
    const fetchData = async () => {
      try {
        const query = continent === 'All' ? GET_HOMICIDE_DATA : GET_HOMICIDE_DATA_BY_CONTINENT;
        const variables = continent === 'All' ? { year } : { year, continent };
        const response = await fetchGraphQL(query, variables) as { fct_homicides: HomicideRecord[] };
        setCountriesData(response.fct_homicides || []);
      } catch (error) {
        console.error('Error fetching homicide data:', error);
      }
    };
    fetchData();
  }, [continent, year]);

  // Globe material — blends with the page background
  const globeMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: isDark ? '#000000' : '#F5F5F5',
      transparent: false,
    });
  }, [isDark]);

  // Map Hasura data to GeoJSON polygons
  const polygonData: EnrichedFeature[] = useMemo(() => {
    if (!geoJson || !countriesData.length) return [];
    
    return geoJson.features.map((feat) => {
      const props = feat.properties as Record<string, string>;
      const countryStats = countriesData.find((d) => d.iso3 === props.ISO_A3);
      return {
        ...feat,
        properties: {
          ...feat.properties,
          homicide_rate: countryStats?.homicide_rate || 0,
          country_name: countryStats?.country_name || (props.ADMIN as string) || '',
          iso3: (props.ISO_A3 as string) || '',
          hasData: !!countryStats,
        } as EnrichedProperties,
      };
    });
  }, [geoJson, countriesData]);

  // Callbacks for polygon styling
  const getPolygonCapColor = useCallback((d: object) => {
    const feat = d as EnrichedFeature;
    if (!feat.properties.hasData) {
      return isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)';
    }
    return getHeatColor(feat.properties.homicide_rate, isDark);
  }, [isDark]);

  const getPolygonStrokeColor = useCallback(() => {
    return isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.3)';
  }, [isDark]);

  const getPolygonSideColor = useCallback(() => {
    return isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';
  }, [isDark]);

  const getPolygonAltitude = useCallback((d: object) => {
    const feat = d as EnrichedFeature;
    return feat.properties.hasData ? 0.006 + (feat.properties.homicide_rate / 500) : 0.004;
  }, []);

  const getPolygonLabel = useCallback((d: object) => {
    const feat = d as EnrichedFeature;
    const bg = isDark ? '#0A0A0A' : '#FFFFFF';
    const border = isDark ? '#E5E5E5' : '#1A1A1A';
    const text = isDark ? '#FAFAFA' : '#0A0A0A';
    const muted = isDark ? '#A3A3A3' : '#737373';
    return `
      <div style="background:${bg}; padding:10px 14px; border-radius:6px; border:1px solid ${border}; font-family:'JetBrains Mono',monospace; font-size:12px;">
        <div style="color:${text}; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:4px;">${feat.properties.country_name || feat.properties.ADMIN}</div>
        <div style="color:${muted};">Rate: ${feat.properties.homicide_rate.toFixed(2)} per 100k</div>
      </div>
    `;
  }, [isDark]);

  const handlePolygonClick = useCallback((d: object) => {
    const feat = d as EnrichedFeature;
    const iso3 = feat.properties.iso3 || feat.properties.ISO_A3 || '';
    const name = feat.properties.country_name || feat.properties.ADMIN || '';
    
    if (iso3) {
      selectCountry(iso3, name);
    }

    if (globeEl.current && feat.properties.LABEL_Y != null && feat.properties.LABEL_X != null) {
      globeEl.current.pointOfView(
        { lat: feat.properties.LABEL_Y, lng: feat.properties.LABEL_X, altitude: 2 },
        1000
      );
    }
  }, [selectCountry]);

  return (
    <div className="w-full h-screen bg-background flex items-center justify-center relative font-mono">
      <Globe
        ref={globeEl}
        backgroundColor="rgba(0,0,0,0)"
        globeMaterial={globeMaterial}
        showAtmosphere={false}
        polygonsData={polygonData}
        polygonAltitude={getPolygonAltitude}
        polygonCapColor={getPolygonCapColor}
        polygonSideColor={getPolygonSideColor}
        polygonStrokeColor={getPolygonStrokeColor}
        polygonLabel={getPolygonLabel}
        onPolygonClick={handlePolygonClick}
      />
    </div>
  );
}
