import DashboardLayout from "@/components/DashboardLayout";
import Link from "next/link";
import { getCachedEtItemRows, type EtItemRow } from "@/lib/etData";
import { reminderInfo, stageName, typeLabel } from "@/lib/et";
import WorkloadBoard, { type WorkloadGroup, type WorkloadItem } from "./WorkloadBoard";

export const dynamic = "force-dynamic";

/** Whole days between an ISO date and today (never negative). */
function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  const a = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const b = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.round((b - a) / 86400000));
}

export default async function EtWorkloadPage() {
  let rows: EtItemRow[] = [];
  let error: string | null = null;
  try {
    rows = await getCachedEtItemRows();
  } catch (err) {
    console.error("Failed to load workload:", err);
    error = "Failed to load. Have you run the migration and import yet?";
  }

  // Active = still in flight (not completed, not stopped).
  const active = rows.filter((r) => r.derivedStatus !== "completed" && !r.stopped);

  const byHolder = new Map<string, WorkloadItem[]>();
  const unassigned: WorkloadItem[] = [];

  for (const r of active) {
    const info = reminderInfo(r);
    const item: WorkloadItem = {
      id: r.id,
      title: r.title,
      type: typeLabel(r.type),
      stageCode: r.current.stage,
      stageName: r.current.stage ? stageName(r.current.stage) : r.current.label,
      daysHeld: daysSince(r.current.since),
      delivery: info.delivery,
      daysLeft: info.daysLeft,
      urgency: info.urgency,
      progress: `${r.current.doneCount}/${r.current.totalCount}`,
    };
    const holder = r.current.holder?.trim();
    if (holder) {
      if (!byHolder.has(holder)) byHolder.set(holder, []);
      byHolder.get(holder)!.push(item);
    } else {
      unassigned.push(item);
    }
  }

  // Within a person: longest-held first (most likely to be stuck / need a nudge).
  const sortItems = (a: WorkloadItem, b: WorkloadItem) => (b.daysHeld ?? -1) - (a.daysHeld ?? -1);

  const groups: WorkloadGroup[] = [...byHolder.entries()]
    .map(([holder, items]) => ({ holder, items: items.sort(sortItems) }))
    .sort((a, b) => b.items.length - a.items.length || a.holder.localeCompare(b.holder));

  unassigned.sort(sortItems);

  const totalItems = active.length;

  return (
    <DashboardLayout>
      <div className="mb-4 sm:mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-600 dark:text-emerald-400">English Translation</p>
          <h1 className="mt-1 text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">Who&apos;s working on what</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Live view of every active item, grouped by the person currently holding it.
          </p>
        </div>
        <Link href="/et" className="btn-press inline-flex flex-shrink-0 items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
          ← Dashboard
        </Link>
      </div>

      {error ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-6 text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300">{error}</div>
      ) : (
        <WorkloadBoard groups={groups} unassigned={unassigned} totalItems={totalItems} />
      )}
    </DashboardLayout>
  );
}
