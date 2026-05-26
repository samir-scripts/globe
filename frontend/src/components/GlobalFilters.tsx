"use client";

import React from "react";
import { useFilterStore } from "@/store/useFilterStore";
import { MetricId, METRICS } from "@/types/metrics";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";

const CONTINENTS = ["All", "Africa", "Americas", "Asia", "Europe", "Oceania"];

export default function GlobalFilters() {
  const {
    continent,
    setContinent,
    year,
    setYear,
    activeMetric,
    setActiveMetric,
  } = useFilterStore();

  const currentMetric = METRICS.find((m) => m.id === activeMetric) || METRICS[0];

  return (
    <div className="absolute top-6 right-6 z-30 w-80 bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl p-5 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] transition-all duration-300 hover:border-white/20 select-none font-mono">
      {/* Glow effect matching current metric */}
      <div 
        className="absolute -top-12 -right-12 w-32 h-32 rounded-full blur-3xl opacity-20 transition-all duration-500 pointer-events-none"
        style={{ backgroundColor: currentMetric.color }}
      />
      
      {/* Title */}
      <div className="flex items-center gap-2 mb-5 pb-3 border-b border-white/10">
        <span 
          className="h-2 w-2 rounded-full animate-pulse transition-colors duration-500" 
          style={{ backgroundColor: currentMetric.color }}
        />
        <span className="text-[10px] text-white/50 uppercase tracking-widest font-semibold">
          Data Stream Controller
        </span>
      </div>

      <div className="space-y-6">
        {/* Metric Selector (Tabs) */}
        <div className="space-y-2">
          <label className="text-[10px] text-white/40 uppercase tracking-wider block">
            Statistic Type
          </label>
          <div className="grid grid-cols-2 p-1 bg-white/5 rounded-xl border border-white/5 relative">
            {METRICS.map((m) => {
              const isActive = activeMetric === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setActiveMetric(m.id as MetricId)}
                  className={`py-2 px-3 text-center text-xs font-semibold rounded-lg transition-all duration-300 relative cursor-pointer ${
                    isActive 
                      ? "text-white shadow-lg shadow-black/40" 
                      : "text-white/40 hover:text-white/70"
                  }`}
                  style={{
                    backgroundColor: isActive ? "rgba(255,255,255,0.08)" : "transparent",
                    border: isActive ? `1px solid ${m.color}44` : "1px solid transparent"
                  }}
                >
                  {isActive && (
                    <span 
                      className="absolute bottom-1 left-1/2 -translate-x-1/2 w-4 h-[2px] rounded-full"
                      style={{ backgroundColor: m.color }}
                    />
                  )}
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Region/Continent Select */}
        <div className="space-y-2">
          <label className="text-[10px] text-white/40 uppercase tracking-wider block">
            Continent / Region
          </label>
          <Select
            value={continent || "All"}
            onValueChange={(val) => setContinent(val)}
          >
            <SelectTrigger className="w-full bg-white/5 border-white/10 hover:border-white/20 text-white rounded-xl h-10 transition-all font-mono text-xs focus:ring-0 focus:ring-offset-0">
              <SelectValue placeholder="Select Continent" />
            </SelectTrigger>
            <SelectContent className="bg-[#121212]/95 backdrop-blur-lg border-white/10 text-white font-mono text-xs rounded-xl">
              {CONTINENTS.map((c) => (
                <SelectItem
                  key={c}
                  value={c}
                  className="focus:bg-white/10 focus:text-white hover:bg-white/5 transition-colors cursor-pointer"
                >
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Year Slider */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <label className="text-[10px] text-white/40 uppercase tracking-wider">
              Reporting Year
            </label>
            <span 
              className="text-xs font-bold px-2 py-0.5 rounded-md text-white transition-all duration-300 font-mono shadow-[0_0_10px_rgba(255,255,255,0.05)]"
              style={{ 
                backgroundColor: `${currentMetric.color}22`,
                border: `1px solid ${currentMetric.color}44`,
                textShadow: `0 0 4px ${currentMetric.color}aa`
              }}
            >
              {year}
            </span>
          </div>
          <div className="px-1 py-2">
            <Slider
              value={[year]}
              min={2000}
              max={2022}
              step={1}
              onValueChange={(val) => {
                if (Array.isArray(val)) {
                  setYear(val[0]);
                } else if (typeof val === 'number') {
                  setYear(val);
                }
              }}
              className="py-2 cursor-pointer [&_[role=slider]]:bg-white [&_[role=slider]]:border-white/50 [&_[role=slider]]:w-4 [&_[role=slider]]:h-4 [&_[role=slider]]:shadow-lg"
              style={{
                color: currentMetric.color
              }}
            />
          </div>
          <div className="flex justify-between text-[8px] text-white/30 px-1 font-semibold">
            <span>2000</span>
            <span>2011</span>
            <span>2022</span>
          </div>
        </div>
      </div>
    </div>
  );
}
