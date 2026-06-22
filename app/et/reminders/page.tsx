import DashboardLayout from "@/components/DashboardLayout";
import Link from "next/link";
import { getCachedEtItemRows, getCachedEtPeople, type EtItemRow } from "@/lib/etData";
import {
  daysSince,
  isWeeklyType,
  reminderInfo,
  stageBadgeClasses,
  typeLabel,
  urgencyClasses,
  type ReminderInfo,
} from "@/lib/et";
import EtQuickAdvance from "../items/[id]/EtQuickAdvance";

export const dynamic = "force-dynamic";

function fmt(d: string | null): string {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

type Entry = { row: EtItemRow; info: ReminderInfo };

function Row({ row, info, peopleNames }: Entry & { peopleNames: string[] }) {
  const days = daysSince(row.current.since);
  return (
    <li className="py-2.5">
      <Link href={`/et/items/${row.id}`} className="group flex items-center gap-3">
        <span className={`flex-shrink-0 w-20 text-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${urgencyClasses(info.urgency)}`}>
          {info.daysLeft! < 0 ? `${Math.abs(info.daysLeft!)}d late` : info.daysLeft === 0 ? "today" : `${info.daysLeft}d left`}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm text-gray-800 dark:text-gray-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400">{row.title}</span>
        <span className="hidden md:inline text-xs text-gray-400 dark:text-gray-500">{typeLabel(row.type)}</span>
        <span className={`hidden sm:inline-flex flex-shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${stageBadgeClasses(row.current.stage, row.current.completed)}`}>
          {row.current.stage ?? row.current.label}
        </span>
        <span className="hidden sm:block flex-shrink-0 w-24 truncate text-xs text-gray-500 dark:text-gray-400">{row.current.holder || "—"}</span>
        {days != null && (
          <span className={`flex-shrink-0 rounded-full px-1.5 py-0.5 text-[11px] font-medium ${days > 30 ? "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"}`}>{days}d</span>
        )}
        <span className="hidden lg:block flex-shrink-0 w-24 text-right text-xs text-gray-400 dark:text-gray-500">{fmt(info.delivery)}</span>
      </Link>
      {row.advance && (
        <div className="mt-1.5 pl-[5.5rem]">
          <EtQuickAdvance compact itemId={row.id} advance={row.advance} peopleNames={peopleNames} />
        </div>
      )}
    </li>
  );
}

function Section({ title, entries, tone, peopleNames }: { title: string; entries: Entry[]; tone: string; peopleNames: string[] }) {
  if (entries.length === 0) return null;
  return (
    <div className="gloss rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 shadow-sm">
      <h2 className={`text-sm font-semibold ${tone}`}>{title} <span className="text-gray-400 dark:text-gray-500">({entries.length})</span></h2>
      <ul className="mt-2 divide-y divide-gray-100 dark:divide-gray-800">
        {entries.map((e) => <Row key={e.row.id} {...e} peopleNames={peopleNames} />)}
      </ul>
    </div>
  );
}

export default async function EtRemindersPage() {
  let rows: EtItemRow[] = [];
  let peopleNames: string[] = [];
  let error: string | null = null;
  try {
    const [r, people] = await Promise.all([getCachedEtItemRows(), getCachedEtPeople()]);
    rows = r;
    peopleNames = people.map((p) => p.name);
  } catch (err) {
    console.error("Failed to fetch ET items:", err);
    error = "Failed to load. Have you run the migrations and import yet?";
  }

  // Weekly documents only (wsb / fsp / wbl) — the recurring deliverables.
  const weekly = rows.filter((r) => r.derivedStatus !== "completed" && isWeeklyType(r.type));

  const entries: Entry[] = weekly
    .map((row) => ({ row, info: reminderInfo(row) }))
    .filter((e) => e.info.delivery)
    .sort((a, b) => (a.info.daysLeft ?? 0) - (b.info.daysLeft ?? 0));

  const overdue = entries.filter((e) => e.info.urgency === "overdue");
  const week = entries.filter((e) => (e.info.daysLeft ?? 99) >= 0 && (e.info.daysLeft ?? 99) <= 7);
  const upcoming = entries.filter((e) => (e.info.daysLeft ?? 0) > 7);

  // Unassigned weekly tasks (like the Excel sheet's second column).
  const unassigned = weekly.filter((r) => r.derivedStatus === "pending_assignment");

  return (
    <DashboardLayout>
      <div className="mb-4 sm:mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-600 dark:text-emerald-400">English Translation</p>
          <h1 className="mt-1 text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">Weekly Documents</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Weekly Speech Brothers · Friday Speech · Weekly Booklet — {overdue.length} overdue · {week.length} due this week · {upcoming.length} upcoming
          </p>
        </div>
        <Link href="/et" className="btn-press inline-flex flex-shrink-0 items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
          ← Dashboard
        </Link>
      </div>

      {error ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-6 text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300">{error}</div>
      ) : (
        <div className="space-y-4">
          {entries.length === 0 && unassigned.length === 0 ? (
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-10 text-center text-gray-500 dark:text-gray-400">
              No active weekly documents. Add a wsb / fsp / wbl item with a date in its title like “(20-07-26)”.
            </div>
          ) : (
            <>
              <Section title="⚠ Overdue" entries={overdue} tone="text-red-600 dark:text-red-400" peopleNames={peopleNames} />
              <Section title="Due this week" entries={week} tone="text-amber-600 dark:text-amber-400" peopleNames={peopleNames} />
              <Section title="Upcoming" entries={upcoming} tone="text-gray-700 dark:text-gray-300" peopleNames={peopleNames} />

              {unassigned.length > 0 && (
                <div className="gloss rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 shadow-sm">
                  <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">⚠ Unassigned weekly tasks <span className="text-gray-400 dark:text-gray-500">({unassigned.length})</span></h2>
                  <ul className="mt-2 divide-y divide-gray-100 dark:divide-gray-800">
                    {unassigned.map((row) => (
                      <li key={row.id} className="py-2">
                        <Link href={`/et/items/${row.id}`} className="group flex items-center gap-3">
                          <span className="min-w-0 flex-1 truncate text-sm text-gray-800 dark:text-gray-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400">{row.title}</span>
                          <span className="flex-shrink-0 text-xs text-gray-400 dark:text-gray-500">{typeLabel(row.type)}</span>
                        </Link>
                        {row.advance && (
                          <div className="mt-1.5">
                            <EtQuickAdvance compact itemId={row.id} advance={row.advance} peopleNames={peopleNames} />
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
