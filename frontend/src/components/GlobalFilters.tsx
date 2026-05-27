"use client";

import React, { useState } from "react";
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

export default function GlobalFilters() {
  const { year, setYear, activeMetric, setActiveMetric } = useFilterStore();
  const [isOpen, setIsOpen] = useState(false);

  const currentMetric =
    METRICS.find((m) => m.id === activeMetric) || METRICS[0];

  return (
    <div className="absolute top-6 left-6 z-30 font-mono select-none flex flex-col gap-3">
      {/* Square Eraser-Pink Toggle Button with 3 horizontal lines */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 bg-[#FF9EBB] hover:bg-[#FF8FAB] text-black flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors duration-200 border-none outline-none shadow-none focus:outline-none"
        aria-label="Toggle Filters"
      >
        <span className="w-5 h-[2px] bg-neutral-900 transition-transform"></span>
        <span className="w-5 h-[2px] bg-neutral-900 transition-opacity"></span>
        <span className="w-5 h-[2px] bg-neutral-900 transition-transform"></span>
      </button>

      {/* Filter Menu Panel */}
      {isOpen && (
        <div className="w-64 bg-[#121212] border border-neutral-800 p-4 flex flex-col gap-4 text-white">
          {/* Statistic Dropdown Selector */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] text-neutral-400 font-semibold tracking-wider uppercase">
              Select Statistic
            </span>
            <Select
              value={activeMetric}
              onValueChange={(val) => setActiveMetric(val as MetricId)}
            >
              <SelectTrigger className="w-full bg-[#181818] border border-neutral-800 hover:border-neutral-700 text-white rounded-none h-10 transition-all font-mono text-xs focus:ring-0 focus:ring-offset-0">
                <SelectValue placeholder="Select Statistic" />
              </SelectTrigger>
              <SelectContent className="bg-[#121212] border border-neutral-800 text-white font-mono text-xs rounded-none">
                {METRICS.map((m) => (
                  <SelectItem
                    key={m.id}
                    value={m.id}
                    className="focus:bg-white! focus:text-black! hover:bg-white! hover:text-black! transition-colors cursor-pointer rounded-none"
                  >
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Year Slider */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-neutral-400 font-semibold tracking-wider uppercase">
                Select Year
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 bg-[#181818] border border-neutral-800 text-white font-mono">
                {year}
              </span>
            </div>
            <div className="px-1 py-1">
              <Slider
                value={[year]}
                min={2000}
                max={2023}
                step={1}
                onValueChange={(val) => {
                  if (Array.isArray(val)) {
                    setYear(val[0]);
                  } else if (typeof val === "number") {
                    setYear(val);
                  }
                }}
                className="py-2 cursor-pointer [&_[role=slider]]:bg-[#FF9EBB] [&_[role=slider]]:border-none [&_[role=slider]]:w-3 [&_[role=slider]]:h-3 [&_[role=slider]]:rounded-none [&_[role=slider]]:shadow-none"
              />
            </div>
            <div className="flex justify-between text-[8px] text-neutral-500 px-1 font-semibold">
              <span>2000</span>
              <span>2011</span>
              <span>2023</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
