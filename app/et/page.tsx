import DashboardLayout from "@/components/DashboardLayout";
import Link from "next/link";
import SummaryCard from "@/components/SummaryCard";
import { getCachedEtItemRows, type EtItemRow } from "@/lib/etData";
import {
  daysSince,
  isWeeklyType,
  reminderInfo,
  RETURN_BADGE_CLASSES,
  returnBadgeLabel,
  stageBadgeClasses,
  urgencyClasses,
  typeLabel,
  itemCategory,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  STEP_ALERT_DAYS,
} from "@/lib/et";
import UnassignedEtTasks from "@/app/dashboard/UnassignedEtTasks";

export const dynamic = "force-dynamic";

function fmt(d: string | null): string {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function StageChip({ row }: { row: EtItemRow }) {
  if (row.inReturn) {
    return (
      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${RETURN_BADGE_CLASSES}`}>
        ↩ {returnBadgeLabel(row.returnStage)}
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${stageBadgeClasses(row.current.stage, row.current.completed)}`}>
      {row.current.stage ? `${row.current.stage}` : row.current.label}
    </span>
  );
}

export default async function EtDashboardPage() {
  let rows: EtItemRow[] = [];
  let error: string | null = null;
  try {
    rows = await getCachedEtItemRows();
  } catch (err) {
    console.error("Failed to fetch ET items:", err);
    error = "Failed to load. Have you run the migration and import yet?";
  }

  const live = rows.filter((r) => !r.stopped);
  const active = live.filter((r) => r.derivedStatus !== "completed");
  const completed = live.filter((r) => r.derivedStatus === "completed");
  const unassigned = live.filter((r) => r.derivedStatus === "pending_assignment");

  // Unassigned tasks (no person + date yet), grouped by category so it's clear
  // what kind of work is stalled (weekly docs, magazine, books, other).
  const unassignedGroups = CATEGORY_ORDER.map((cat) => ({
    key: cat,
    label: CATEGORY_LABELS[cat],
    tasks: unassigned
      .filter((r) => itemCategory(r.type) === cat)
      .map((r) => ({ id: r.id, title: r.title })),
  })).filter((g) => g.tasks.length > 0);

  // Top "Weekly deliveries" attention list — WEEKLY tasks only (wbl/wsb/fsp):
  // those whose delivery is within 7 days, OR that have been sitting at the same
  // step for more than STEP_ALERT_DAYS days. Soonest delivery first, then
  // longest-held.
  const attention = active
    .filter((r) => isWeeklyType(r.type))
    .map((r) => ({ row: r, info: reminderInfo(r), held: daysSince(r.current.since) }))
    .filter(
      (x) =>
        (x.info.daysLeft != null && x.info.daysLeft <= 7) ||
        (x.held != null && x.held > STEP_ALERT_DAYS)
    )
    .sort((a, b) => {
      const da = a.info.daysLeft ?? 9999;
      const db = b.info.daysLeft ?? 9999;
      if (da !== db) return da - db;
      return (b.held ?? 0) - (a.held ?? 0);
    });
  const dueSoon = attention.filter((x) => x.info.daysLeft != null && x.info.daysLeft <= 7);
  const heldOver = attention.filter((x) => x.held != null && x.held > STEP_ALERT_DAYS).length;

  // Stuck items (active, oldest at current step).
  const stuck = active
    .filter((r) => r.current.since)
    .sort((a, b) => new Date(a.current.since!).getTime() - new Date(b.current.since!).getTime())
    .slice(0, 8);

  return (
    <DashboardLayout>
      <div className="mb-4 sm:mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-600 dark:text-emerald-400">English Translation</p>
          <h1 className="mt-1 text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        </div>
        <Link href="/et/items" className="btn-press inline-flex flex-shrink-0 items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
          All items →
        </Link>
      </div>

      {error ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-6 text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
          {error}
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
            <SummaryCard title="Active items" value={active.length} color="blue" index={1}
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>} />
            <SummaryCard title="Completed" value={completed.length} color="green" index={2}
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
            <SummaryCard title="Unassigned" value={unassigned.length} color="gray" index={3}
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>} />
            <SummaryCard title="Due ≤ 7 days" value={dueSoon.length} color="amber" index={4}
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
          </div>

          {/* 1. Weekly deliveries — due within 7 days, or held over 4 days */}
          <div className="mt-4 sm:mt-6">
            <div className="gloss rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold text-gray-900 dark:text-white">Weekly deliveries</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Due within 7 days, or held more than {STEP_ALERT_DAYS} days at a step.</p>
                </div>
                <div className="flex items-center gap-3">
                  {heldOver > 0 && (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700 dark:bg-red-900/20 dark:text-red-400">
                      {heldOver} held &gt; {STEP_ALERT_DAYS}d
                    </span>
                  )}
                  <Link href="/et/reminders" className="text-sm text-emerald-600 dark:text-emerald-400 hover:underline">View all →</Link>
                </div>
              </div>
              {attention.length === 0 ? (
                <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">Nothing due soon or held up. 🎉</p>
              ) : (
                <ul className="mt-3 divide-y divide-gray-100 dark:divide-gray-800">
                  {attention.slice(0, 14).map(({ row, info, held }) => {
                    const isHeld = held != null && held > STEP_ALERT_DAYS;
                    return (
                      <li key={row.id} className={`py-2 ${isHeld ? "-mx-2 rounded-lg bg-red-50/60 px-2 dark:bg-red-900/10" : ""}`}>
                        <Link href={`/et/items/${row.id}?from=${encodeURIComponent("/et")}`} className="group flex items-center gap-2 sm:gap-3">
                          {info.daysLeft != null ? (
                            <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${urgencyClasses(info.urgency)}`}>
                              {info.daysLeft < 0 ? `${Math.abs(info.daysLeft)}d overdue` : info.daysLeft === 0 ? "today" : `${info.daysLeft}d`}
                            </span>
                          ) : (
                            <span className="flex-shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">no date</span>
                          )}
                          <span className="min-w-0 flex-1 truncate text-sm text-gray-800 dark:text-gray-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400">{row.title}</span>
                          {isHeld && (
                            <span className="flex-shrink-0 inline-flex items-center gap-1 rounded-full bg-red-100 px-1.5 py-0.5 text-[11px] font-medium text-red-700 dark:bg-red-900/20 dark:text-red-400" title={`Held ${held} days at this step — chase up`}>
                              ⏳ {held}d
                            </span>
                          )}
                          <StageChip row={row} />
                          <span className="hidden sm:block flex-shrink-0 text-xs text-gray-500 dark:text-gray-400">{row.current.holder || "—"}</span>
                          <span className="hidden sm:block flex-shrink-0 text-xs text-gray-400 dark:text-gray-500">{fmt(info.delivery)}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* 2. Unassigned tasks — grouped by category */}
          <UnassignedEtTasks groups={unassignedGroups} total={unassigned.length} />

          {/* 3. Longest at current step */}
          <div className="mt-4 sm:mt-6 gloss rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 shadow-sm">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Longest at current step</h2>
            {stuck.length === 0 ? (
              <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">Nothing stuck. 🎉</p>
            ) : (
              <ul className="mt-3 divide-y divide-gray-100 dark:divide-gray-800">
                {stuck.map((row) => {
                  const d = daysSince(row.current.since);
                  return (
                    <li key={row.id} className="py-2">
                      <Link href={`/et/items/${row.id}?from=${encodeURIComponent("/et")}`} className="group flex items-center gap-3">
                        <span className={`flex-shrink-0 rounded-full px-1.5 py-0.5 text-[11px] font-medium ${d != null && d > 60 ? "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400" : "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400"}`}>
                          {d ?? "—"}d
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm text-gray-800 dark:text-gray-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400">{row.title}</span>
                        <StageChip row={row} />
                        <span className="hidden sm:block flex-shrink-0 text-xs text-gray-500 dark:text-gray-400">{row.current.holder || "—"}</span>
                        <span className="hidden md:block flex-shrink-0 text-xs text-gray-400 dark:text-gray-500">{typeLabel(row.type)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
