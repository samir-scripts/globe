"use client";

import React, {
  useEffect,
  useState,
  useRef,
  useMemo,
  useCallback,
} from "react";
import dynamic from "next/dynamic";
import { useFilterStore } from "@/store/useFilterStore";
import { fetchGraphQL } from "@/lib/hasura";
import {
  GET_HOMICIDE_DATA,
  GET_HOMICIDE_DATA_BY_CONTINENT,
} from "@/queries/crime";
import type { GlobeMethods } from "react-globe.gl";
import * as THREE from "three";

// Dynamically import Globe to avoid SSR issues with Three.js
const Globe = dynamic(() => import("react-globe.gl"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full text-muted-foreground font-mono text-sm tracking-wider uppercase">
      Loading Globe...
    </div>
  ),
});

// --- Types ---
interface HomicideRecord {
  country_name: string;
  iso3: string;
  continent: string;
  reporting_year: number;
  data_year: number;
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
  data_year?: number;
  reporting_year?: number;
  admin?: string;
  iso_a3?: string;
  ADMIN?: string;
  LABEL_Y?: number;
  LABEL_X?: number;
  ISO_A3?: string;
}

interface EnrichedFeature extends GeoJsonFeature {
  properties: EnrichedProperties;
}

// Color interpolation for homicide rate heat map
function getHeatColor(rate: number): string {
  // Normalize rate: 0 = low, 1 = high (cap at 30 per 100k)
  const t = Math.min(rate / 30, 1);

  // Original light mode heat colors: light gray → dim red → vivid red
  const r = Math.round(220 + t * 20);
  const g = Math.round(220 - t * 185);
  const b = Math.round(220 - t * 185);
  const a = 0.4 + t * 0.55;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

export default function GlobeVisualization() {
  const { continent, year, selectCountry } = useFilterStore();
  const [countriesData, setCountriesData] = useState<HomicideRecord[]>([]);
  const [geoJson, setGeoJson] = useState<GeoJsonCollection | null>(null);
  const [loadingGeoJson, setLoadingGeoJson] = useState(true);
  const [loadingHasura, setLoadingHasura] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasuraCount, setHasuraCount] = useState(0);

  const globeEl = useRef<GlobeMethods | undefined>(undefined);

  // Load GeoJSON from local bundle
  useEffect(() => {
    setLoadingGeoJson(true);
    fetch("/countries.geojson")
      .then((res) => {
        if (!res.ok)
          throw new Error("Failed to load geographical boundaries file.");
        return res.json();
      })
      .then((data: GeoJsonCollection) => {
        setGeoJson(data);
        setLoadingGeoJson(false);
      })
      .catch((err) => {
        console.error("GeoJSON loading error:", err);
        setError(
          "Failed to fetch geography boundaries. Please verify public/countries.geojson.",
        );
        setLoadingGeoJson(false);
      });
  }, []);

  // Fetch data from Hasura based on filters
  useEffect(() => {
    const fetchData = async () => {
      setLoadingHasura(true);
      setError(null);
      try {
        const query =
          continent === "All"
            ? GET_HOMICIDE_DATA
            : GET_HOMICIDE_DATA_BY_CONTINENT;
        const variables = continent === "All" ? { year } : { year, continent };
        const response = (await fetchGraphQL(query, variables)) as {
          mart_complete_countries: HomicideRecord[];
        };
        const records = response.mart_complete_countries || [];
        setCountriesData(records);
        setHasuraCount(records.length);
      } catch (err: any) {
        console.error("Error fetching homicide data:", err);
        setError(
          err?.message ||
            "Error connecting to Hasura database. Please check your connection.",
        );
      } finally {
        setLoadingHasura(false);
      }
    };
    fetchData();
  }, [continent, year]);

  // Globe material
  const globeMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: "#F9F6EF",
      transparent: false,
    });
  }, []);

  // Map Hasura data to GeoJSON polygons
  const polygonData: EnrichedFeature[] = useMemo(() => {
    if (!geoJson || !countriesData.length) return [];

    return geoJson.features.map((feat) => {
      const props = feat.properties as Record<string, string>;

      const rawIso_a3 = String(props.iso_a3 || "")
        .trim()
        .toUpperCase();
      const rawAdm0_a3 = String(props.adm0_a3 || "")
        .trim()
        .toUpperCase();

      // Prefer iso_a3 if it is a valid ISO3 code (not empty and not -99), otherwise fall back to adm0_a3
      const resolvedIso3 =
        rawIso_a3 && rawIso_a3 !== "-99"
          ? rawIso_a3
          : rawAdm0_a3 && rawAdm0_a3 !== "-99"
            ? rawAdm0_a3
            : "";

      const countryStats = countriesData.find(
        (d) => d.iso3?.trim().toUpperCase() === resolvedIso3,
      );
      return {
        ...feat,
        properties: {
          ...feat.properties,
          homicide_rate: countryStats?.homicide_rate || 0,
          country_name:
            countryStats?.country_name || (props.admin as string) || "",
          iso3: resolvedIso3,
          hasData: !!countryStats,
          data_year: countryStats?.data_year,
          reporting_year: countryStats?.reporting_year,
        } as EnrichedProperties,
      };
    });
  }, [geoJson, countriesData]);

  // Callbacks for polygon styling
  const getPolygonCapColor = useCallback((d: object) => {
    const feat = d as EnrichedFeature;
    if (!feat.properties.hasData) {
      return "rgba(0, 0, 0, 0.03)";
    }
    return getHeatColor(feat.properties.homicide_rate);
  }, []);

  const getPolygonStrokeColor = useCallback(() => {
    return "rgba(0, 0, 0, 0.3)";
  }, []);

  const getPolygonSideColor = useCallback(() => {
    return "rgba(0, 0, 0, 0.05)";
  }, []);

  const getPolygonAltitude = useCallback((d: object) => {
    const feat = d as EnrichedFeature;
    return feat.properties.hasData
      ? 0.006 + feat.properties.homicide_rate / 500
      : 0.004;
  }, []);

  const getPolygonLabel = useCallback(
    (d: object) => {
      const feat = d as EnrichedFeature;
      const bg = "#FFFFFF";
      const border = "#1A1A1A";
      const text = "#0A0A0A";
      const muted = "#737373";

      const rateText = feat.properties.hasData
        ? feat.properties.homicide_rate.toFixed(2)
        : "0.00";

      let yearSuffix = "";
      if (
        feat.properties.hasData &&
        feat.properties.data_year &&
        feat.properties.data_year !== year
      ) {
        yearSuffix = ` <span style="font-size:10px; opacity:0.8;">(${feat.properties.data_year} data)</span>`;
      }

      return `
      <div style="background:${bg}; padding:10px 14px; border-radius:6px; border:1px solid ${border}; font-family:'JetBrains Mono',monospace; font-size:12px;">
        <div style="color:${text}; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:4px;">${feat.properties.country_name || feat.properties.admin}</div>
        <div style="color:${muted};">Rate: ${rateText} per 100k${yearSuffix}</div>
      </div>
    `;
    },
    [year],
  );

  const handlePolygonClick = useCallback(
    (d: object, event: any, coords: { lat: number; lng: number }) => {
      const feat = d as EnrichedFeature;
      const rawIso3 =
        feat.properties.iso3 ||
        feat.properties.adm0_a3 ||
        feat.properties.iso_a3 ||
        "";
      const iso3 =
        rawIso3 === "-99" ? "" : String(rawIso3).trim().toUpperCase();
      const name = feat.properties.country_name || feat.properties.admin || "";

      if (iso3) {
        selectCountry(iso3, name);
      }

      if (globeEl.current && coords) {
        globeEl.current.pointOfView(
          { lat: coords.lat, lng: coords.lng, altitude: 2 },
          1000,
        );
      }
    },
    [selectCountry],
  );

  const isLoading = loadingGeoJson || loadingHasura;

  if (error) {
    return (
      <div className="w-full h-screen bg-background flex flex-col items-center justify-center p-6 text-center font-mono">
        <div className="max-w-md p-6 rounded-lg border border-red-500/30 bg-red-500/5 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-300">
          <div className="h-12 w-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto text-red-500 animate-pulse font-bold text-lg">
            ✕
          </div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-red-500">
            System Connection Failed
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed break-words">
            {error}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="text-xs bg-foreground text-background px-4 py-2 rounded border border-border hover:opacity-90 transition-opacity font-bold uppercase tracking-wider cursor-pointer"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="w-full h-screen bg-background flex flex-col items-center justify-center p-6 font-mono text-xs">
        <div className="max-w-md w-full p-6 rounded-xl border border-border bg-card shadow-2xl space-y-6 relative overflow-hidden">
          {/* Decorative glowing gradient backdrop */}
          <div className="absolute -top-24 -left-24 w-48 h-48 rounded-full bg-red-500/5 blur-3xl" />
          <div className="absolute -bottom-24 -right-24 w-48 h-48 rounded-full bg-primary/5 blur-3xl" />

          {/* Header */}
          <div className="flex items-center justify-between border-b border-border pb-3 relative">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              <span className="font-semibold uppercase tracking-wider text-card-foreground">
                Hasura Data Streamer
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground/60 uppercase">
              Init...
            </span>
          </div>

          {/* Console / Status Logs */}
          <div className="space-y-3 relative text-card-foreground">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground uppercase">
                1. Geography Index
              </span>
              {loadingGeoJson ? (
                <span className="text-amber-500 animate-pulse uppercase">
                  Fetching boundaries...
                </span>
              ) : (
                <span className="text-emerald-500 uppercase">
                  Loaded (673KB)
                </span>
              )}
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground uppercase">
                2. Database Stream
              </span>
              {loadingHasura ? (
                <span className="text-amber-500 animate-pulse uppercase">
                  Connecting to Hasura...
                </span>
              ) : (
                <span className="text-emerald-500 uppercase">Connected</span>
              )}
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground uppercase">
                3. Stream Validation
              </span>
              {loadingHasura ? (
                <span className="text-muted-foreground/40 uppercase">
                  Awaiting stream...
                </span>
              ) : hasuraCount > 0 ? (
                <span className="text-emerald-500 uppercase">
                  Validated ({hasuraCount} records)
                </span>
              ) : (
                <span className="text-red-500 uppercase">
                  Empty Stream (0 records)
                </span>
              )}
            </div>
          </div>

          {/* Loading Indicator */}
          <div className="flex flex-col items-center justify-center pt-2 space-y-3 relative">
            <div className="h-6 w-6 border-2 border-muted-foreground/20 border-t-red-500 rounded-full animate-spin" />
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest animate-pulse">
              Synchronizing 3D Canvas...
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="w-full h-screen flex items-center justify-center relative font-mono transition-colors duration-300"
      style={{
        background:
          "radial-gradient(circle at center, rgba(255,255,255,0.03) 0%, #0C0C0C 70%)",
      }}
    >
      <Globe
        ref={globeEl}
        backgroundColor="rgba(0,0,0,0)"
        globeMaterial={globeMaterial}
        showAtmosphere={true}
        atmosphereColor="#CBD5E1"
        atmosphereAltitude={0.15}
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
