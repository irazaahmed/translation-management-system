"use client";

import { useEffect, useState } from "react";

interface LiveClockProps {
  /** Show the date part (weekday/month/day/year). */
  showDate?: boolean;
  /** Include seconds in the time. */
  showSeconds?: boolean;
  /** Show a small clock icon before the time. */
  showIcon?: boolean;
  /** Use the longer weekday+year date format (else short month/day). */
  longDate?: boolean;
  /** Stack the date above the time (instead of inline) — good for tight mobile bars. */
  stacked?: boolean;
  className?: string;
}

/**
 * A live, self-updating clock. Ticks every second on the client. Renders an
 * empty (reserved) span until mounted so server/client markup matches and there
 * is no hydration mismatch.
 */
export default function LiveClock({
  showDate = true,
  showSeconds = true,
  showIcon = false,
  longDate = false,
  stacked = false,
  className = "",
}: LiveClockProps) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Before mount: reserve space, render nothing (avoids hydration mismatch).
  if (!now) {
    return <span className={className} suppressHydrationWarning />;
  }

  const dateStr = now.toLocaleDateString("en-US", longDate
    ? { weekday: "long", year: "numeric", month: "long", day: "numeric" }
    : { weekday: "short", month: "short", day: "numeric" });

  const timeStr = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    ...(showSeconds ? { second: "2-digit" } : {}),
    hour12: true,
  });

  // Stacked: date on top, time below — compact for tight mobile bars.
  if (stacked) {
    return (
      <span className={`inline-flex flex-col items-end leading-tight tabular-nums ${className}`} suppressHydrationWarning>
        {showDate && <span className="opacity-80">{dateStr}</span>}
        <span className="font-medium">{timeStr}</span>
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 tabular-nums ${className}`} suppressHydrationWarning>
      {showIcon && (
        <svg className="w-3.5 h-3.5 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )}
      {showDate && <span>{dateStr}</span>}
      {showDate && <span className="opacity-40">·</span>}
      <span className="font-medium">{timeStr}</span>
    </span>
  );
}
