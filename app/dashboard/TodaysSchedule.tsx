import Link from "next/link";
import { StaffOnly } from "@/components/AuthProvider";
import type { ScheduleEntry } from "@/lib/cachedData";
import { stateBadgeClasses, type ScheduleStatus } from "@/lib/schedule";

export interface TodaysScheduleItem {
  entry: ScheduleEntry;
  status: ScheduleStatus;
}

/**
 * Dashboard card listing the languages whose recurring weekly meeting falls on
 * TODAY (their assigned weekday). The day is computed server-side on every
 * (dynamic) render, so it rolls over automatically as the weekday changes.
 */
export default function TodaysSchedule({
  items,
  todayName,
}: {
  items: TodaysScheduleItem[];
  todayName: string;
}) {
  // Pending first (due/overdue), already-met last.
  const pending = items.filter((i) => i.status.state !== "done");

  return (
    <section className="gloss card-hover rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/15 dark:to-indigo-900/10 px-4 sm:px-5 py-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="wobble-3d flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              Today&apos;s Meetings
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {todayName} · scheduled cadence
            </p>
          </div>
        </div>
        <Link
          href="/schedule"
          className="flex-shrink-0 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
        >
          Full schedule →
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No meetings scheduled for {todayName}. 🎉
          </p>
          <Link
            href="/schedule"
            className="mt-2 inline-block text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
          >
            Assign meeting days
          </Link>
        </div>
      ) : (
        <>
          {pending.length > 0 && (
            <p className="px-4 sm:px-5 pt-3 text-xs text-gray-500 dark:text-gray-400">
              <span className="font-semibold text-gray-700 dark:text-gray-300">{pending.length}</span>{" "}
              of {items.length} still to meet today.
            </p>
          )}
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {items.map(({ entry, status }) => (
              <li
                key={entry.id}
                className="flex flex-col gap-2 px-4 sm:px-5 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/languages/${entry.id}`}
                      className="text-sm font-medium text-gray-900 dark:text-white hover:text-emerald-600 dark:hover:text-emerald-400 truncate"
                    >
                      {entry.language}
                      <span className="font-normal text-gray-400"> ({entry.country})</span>
                    </Link>
                    <span
                      className={`flex-shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${stateBadgeClasses(
                        status.state
                      )}`}
                    >
                      {status.label}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 truncate">
                    {entry.projectName ? `${entry.projectName}` : ""}
                    {entry.responsible_person ? ` · ${entry.responsible_person}` : ""}
                  </p>
                </div>

                {status.state !== "done" && (
                  <StaffOnly>
                    <Link
                      href={`/meetings/new?project=${entry.project_id ?? ""}&language=${entry.id}`}
                      className="btn-press flex-shrink-0 inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 transition-colors whitespace-nowrap"
                    >
                      Record meeting
                    </Link>
                  </StaffOnly>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
