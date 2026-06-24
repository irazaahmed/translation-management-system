"use client";

import { useEffect, useState } from "react";
import AnimatedNumber from "@/components/AnimatedNumber";

interface Segment {
  label: string;
  value: number;
  color: string; // hex
}

function Donut({
  segments,
  centerValue,
  centerLabel,
}: {
  segments: Segment[];
  centerValue: number;
  centerLabel: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  const size = 168;
  const thickness = 20;
  const r = (size - thickness) / 2;
  const C = 2 * Math.PI * r;
  const total = segments.reduce((s, x) => s + x.value, 0);

  let acc = 0;

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-5">
      <div className="relative aspect-square w-32 flex-shrink-0 sm:w-[168px]">
        <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full -rotate-90">
          {/* track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={thickness}
            className="stroke-gray-100 dark:stroke-gray-800"
          />
          {total > 0 &&
            segments.map((seg) => {
              const len = (seg.value / total) * C;
              const dashoffset = -acc;
              acc += len;
              return (
                <circle
                  key={seg.label}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={thickness}
                  strokeLinecap="round"
                  strokeDasharray={`${mounted ? len : 0} ${C}`}
                  strokeDashoffset={dashoffset}
                  style={{ transition: "stroke-dasharray 1s cubic-bezier(0.16, 1, 0.3, 1)" }}
                />
              );
            })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-gray-900 dark:text-white">
            <AnimatedNumber value={centerValue} />
          </span>
          <span className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {centerLabel}
          </span>
        </div>
      </div>

      {/* Legend — full width below the donut on mobile, beside it from sm up */}
      <ul className="w-full space-y-2 sm:w-auto sm:min-w-0 sm:flex-1">
        {segments.map((seg) => {
          const pct = total > 0 ? Math.round((seg.value / total) * 100) : 0;
          return (
            <li key={seg.label} className="flex items-center gap-2 text-sm">
              <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: seg.color }} />
              <span className="text-gray-600 dark:text-gray-300">{seg.label}</span>
              <span className="ml-auto pl-2 tabular-nums text-gray-500 dark:text-gray-400">
                {seg.value} · {pct}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card-hover animate-fade-in-up rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 sm:p-5">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">{title}</h3>
      {children}
    </div>
  );
}

interface AnalyticsChartsProps {
  workStatus: { completed: number; inProgress: number; notStarted: number };
  priority: { high: number; medium: number; low: number; none: number };
}

export default function AnalyticsCharts({ workStatus, priority }: AnalyticsChartsProps) {
  const totalLang = workStatus.completed + workStatus.inProgress + workStatus.notStarted;
  const totalPriority = priority.high + priority.medium + priority.low + priority.none;

  return (
    <div className="mt-4 sm:mt-6 grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2">
      <ChartCard title="Work Status">
        <Donut
          centerValue={totalLang}
          centerLabel="Total"
          segments={[
            { label: "Completed", value: workStatus.completed, color: "#22c55e" },
            { label: "In Progress", value: workStatus.inProgress, color: "#3b82f6" },
            { label: "Not Started", value: workStatus.notStarted, color: "#9ca3af" },
          ]}
        />
      </ChartCard>

      <ChartCard title="Priority Breakdown">
        <Donut
          centerValue={totalPriority}
          centerLabel="Languages"
          segments={[
            { label: "High", value: priority.high, color: "#ef4444" },
            { label: "Medium", value: priority.medium, color: "#f59e0b" },
            { label: "Low", value: priority.low, color: "#22c55e" },
            { label: "Not set", value: priority.none, color: "#9ca3af" },
          ]}
        />
      </ChartCard>
    </div>
  );
}
