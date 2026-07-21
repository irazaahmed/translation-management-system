import DashboardLayout from "@/components/DashboardLayout";
import Link from "next/link";
import { getCachedEtItemRows, getCachedEtPeople, type EtItemRow } from "@/lib/etData";
import {
  daysSince,
  isHeldTooLong,
  isWeeklyType,
  reminderInfo,
  RETURN_BADGE_CLASSES,
  returnBadgeLabel,
  stageBadgeClasses,
  stageChipLabel,
  typeLabel,
  urgencyClasses,
  HELD_ALERT_DAYS,
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

function Card({ row, info, peopleNames }: Entry & { peopleNames: string[] }) {
  const days = daysSince(row.current.since);
  const held = isHeldTooLong(row.current.since);
  const left =
    info.daysLeft == null
      ? "No date"
      : info.daysLeft < 0
        ? `${Math.abs(info.daysLeft)}d late`
        : info.daysLeft === 0
          ? "Due today"
          : `${info.daysLeft}d left`;
  return (
    <div className={`gloss card-hover rounded-xl border p-4 shadow-sm ${held ? "border-red-300 dark:border-red-800/60 bg-red-50/50 dark:bg-red-900/10" : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"}`}>
      <div className="flex items-start justify-between gap-3">
        <Link href={`/et/items/${row.id}?from=${encodeURIComponent("/et/reminders")}`} className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-gray-900 dark:text-white hover:text-emerald-600 dark:hover:text-emerald-400" title={row.title}>{row.title}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">{typeLabel(row.type)}</p>
        </Link>
        <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${urgencyClasses(info.urgency)}`}>{left}</span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${row.inReturn ? RETURN_BADGE_CLASSES : stageBadgeClasses(row.current.stage, row.current.completed)}`}>
          {row.inReturn ? `↩ ${returnBadgeLabel(row.returnStage)}` : stageChipLabel(row.activeStageCodes, row.current.stage, row.current.label)}
        </span>
        {days != null && (
          <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-medium ${held ? "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"}`}>
            {held && "⏳ "}{days}d here
          </span>
        )}
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
        <div>
          <p className="text-gray-500 dark:text-gray-400">Holder</p>
          <p className="font-medium text-gray-900 dark:text-white truncate">{row.current.holder || "—"}</p>
        </div>
        <div>
          <p className="text-gray-500 dark:text-gray-400">Progress</p>
          <p className="font-medium text-gray-900 dark:text-white tabular-nums">{row.current.doneCount}/{row.current.totalCount}</p>
        </div>
        <div>
          <p className="text-gray-500 dark:text-gray-400">Delivery</p>
          <p className="font-medium text-gray-900 dark:text-white">{fmt(info.delivery)}</p>
        </div>
      </div>

      {row.advance && (
        <div className="mt-2 border-t border-gray-100 dark:border-gray-800 pt-2">
          <EtQuickAdvance compact itemId={row.id} advance={row.advance} peopleNames={peopleNames} />
        </div>
      )}
    </div>
  );
}

function Section({ title, entries, tone, peopleNames }: { title: string; entries: Entry[]; tone: string; peopleNames: string[] }) {
  if (entries.length === 0) return null;
  return (
    <div>
      <h2 className={`mb-2 text-sm font-semibold ${tone}`}>{title} <span className="text-gray-400 dark:text-gray-500">({entries.length})</span></h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {entries.map((e) => <Card key={e.row.id} {...e} peopleNames={peopleNames} />)}
      </div>
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

  // Weekly documents only (wsb / fsp / wbl) — the recurring deliverables. Every
  // active weekly item is shown, even ones with no confirmed delivery date yet.
  const weekly = rows.filter((r) => !r.stopped && r.derivedStatus !== "completed" && isWeeklyType(r.type));

  const entries: Entry[] = weekly
    .map((row) => ({ row, info: reminderInfo(row) }))
    .sort((a, b) => (a.info.daysLeft ?? 99999) - (b.info.daysLeft ?? 99999));

  // Items someone is actively working on feed the dated + no-date sections.
  // Pending assignments (nobody working on them yet) are pulled out entirely and
  // shown on their own below — even when their title carries a delivery date, so
  // they never get lost inside the overdue / due-this-week / upcoming lists.
  const assigned = entries.filter((e) => e.row.derivedStatus !== "pending_assignment");
  const dated = assigned.filter((e) => e.info.delivery);
  const overdue = dated.filter((e) => e.info.urgency === "overdue");
  const week = dated.filter((e) => (e.info.daysLeft ?? 99) >= 0 && (e.info.daysLeft ?? 99) <= 7);
  const upcoming = dated.filter((e) => (e.info.daysLeft ?? 0) > 7);
  const noDate = assigned.filter((e) => !e.info.delivery);
  const heldCount = assigned.filter((e) => isHeldTooLong(e.row.current.since)).length;

  // Unassigned weekly tasks (like the Excel sheet's second column) — kept in the
  // delivery-sorted `entries` order so the most urgent surface first.
  const unassigned = entries.filter((e) => e.row.derivedStatus === "pending_assignment");

  return (
    <DashboardLayout>
      <div className="mb-4 sm:mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-600 dark:text-emerald-400">English Translation</p>
          <h1 className="mt-1 text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">Weekly Documents</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Weekly Speech Brothers · Friday Speech · Weekly Booklet — {overdue.length} overdue · {week.length} due this week · {upcoming.length} upcoming
            {noDate.length > 0 && <span> · {noDate.length} no date</span>}
            {unassigned.length > 0 && <span> · {unassigned.length} unassigned</span>}
            {heldCount > 0 && (
              <span className="ml-1 font-medium text-red-600 dark:text-red-400">· {heldCount} held &gt; {HELD_ALERT_DAYS}d</span>
            )}
          </p>
        </div>
        <Link href="/et" className="btn-press inline-flex flex-shrink-0 items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
          ← Dashboard
        </Link>
      </div>

      {error ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-6 text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300">{error}</div>
      ) : entries.length === 0 && unassigned.length === 0 ? (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-10 text-center text-gray-500 dark:text-gray-400">
          No active weekly documents. Add a wsb / fsp / wbl item with a date in its title like “(20-07-26)”.
        </div>
      ) : (
        <div className="space-y-6">
          <Section title="⚠ Overdue" entries={overdue} tone="text-red-600 dark:text-red-400" peopleNames={peopleNames} />
          <Section title="Due this week" entries={week} tone="text-amber-600 dark:text-amber-400" peopleNames={peopleNames} />
          <Section title="Upcoming" entries={upcoming} tone="text-gray-700 dark:text-gray-300" peopleNames={peopleNames} />
          <Section title="No delivery date set" entries={noDate} tone="text-gray-700 dark:text-gray-300" peopleNames={peopleNames} />

          {unassigned.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">⚠ Unassigned weekly tasks <span className="text-gray-400 dark:text-gray-500">({unassigned.length})</span></h2>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {unassigned.map(({ row, info }) => (
                  <div key={row.id} className="gloss card-hover rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <Link href={`/et/items/${row.id}?from=${encodeURIComponent("/et/reminders")}`} className="min-w-0 flex-1">
                        <h3 className="truncate text-sm font-semibold text-gray-900 dark:text-white hover:text-emerald-600 dark:hover:text-emerald-400" title={row.title}>{row.title}</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{typeLabel(row.type)}</p>
                      </Link>
                      {info.delivery && (
                        <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${urgencyClasses(info.urgency)}`} title={`Delivery ${fmt(info.delivery)}`}>{fmt(info.delivery)}</span>
                      )}
                    </div>
                    {row.advance && (
                      <div className="mt-2 border-t border-gray-100 dark:border-gray-800 pt-2">
                        <EtQuickAdvance compact itemId={row.id} advance={row.advance} peopleNames={peopleNames} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
