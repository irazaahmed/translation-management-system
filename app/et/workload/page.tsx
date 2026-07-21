import DashboardLayout from "@/components/DashboardLayout";
import Link from "next/link";
import { getCachedEtItemsWithStages, getCachedEtAllReturns, type EtReturnRow } from "@/lib/etData";
import { activeStages, computeCurrentStep, reminderInfo, returnBadgeLabel, stageName, typeLabel } from "@/lib/et";
import type { EtItemWithStages } from "@/lib/et";
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
  let items: EtItemWithStages[] = [];
  let returns: EtReturnRow[] = [];
  let error: string | null = null;
  try {
    const [i, r] = await Promise.all([getCachedEtItemsWithStages(), getCachedEtAllReturns()]);
    items = i;
    returns = r;
  } catch (err) {
    console.error("Failed to load workload:", err);
    error = "Failed to load. Have you run the migration and import yet?";
  }

  const itemsById = new Map(items.map((it) => [it.id, it]));
  const byHolder = new Map<string, WorkloadItem[]>();
  const unassigned: WorkloadItem[] = [];
  let activeCount = 0;

  for (const it of items) {
    if (it.stopped) continue;
    const current = computeCurrentStep(it.stages, it.final_email_date, it.final_email_date_2);
    // Active = still in flight (not completed).
    if (current.completed) continue;
    activeCount++;

    const info = reminderInfo(it);
    const type = typeLabel(it.type);
    const progress = `${current.doneCount}/${current.totalCount}`;

    // One row per stage the person is *actively* holding — so an item given two
    // stages at once (e.g. TR and CM) shows up as two tasks, not just the last.
    const holding = activeStages(it.stages);

    if (holding.length === 0) {
      // Nobody actively holding it (pending assignment / awaiting final email).
      unassigned.push({
        rowId: it.id,
        id: it.id,
        title: it.title,
        type,
        stageCode: current.stage,
        stageName: current.stage ? stageName(current.stage) : current.label,
        daysHeld: daysSince(current.since),
        delivery: info.delivery,
        daysLeft: info.daysLeft,
        urgency: info.urgency,
        progress,
      });
      continue;
    }

    for (const s of holding) {
      const row: WorkloadItem = {
        rowId: s.id,
        id: it.id,
        title: it.title,
        type,
        stageCode: s.stage,
        stageName: stageName(s.stage),
        daysHeld: daysSince(s.sent_date),
        delivery: info.delivery,
        daysLeft: info.daysLeft,
        urgency: info.urgency,
        progress,
      };
      const holder = s.person?.trim();
      if (holder) {
        if (!byHolder.has(holder)) byHolder.set(holder, []);
        byHolder.get(holder)!.push(row);
      } else {
        unassigned.push(row);
      }
    }
  }

  // Open returns (sent back to fix something, not yet received back) are active
  // work too — whoever is holding the return is genuinely busy with it, even
  // when the item's own pipeline has nothing in progress (or is even marked
  // complete). Surface them as their own "Return" row per holder.
  for (const r of returns) {
    if (r.received_back_date || r.item_stopped) continue;
    const it = itemsById.get(r.item_id);
    const info = it ? reminderInfo(it) : { delivery: null, daysLeft: null, urgency: null };
    const progress = it
      ? (() => {
          const c = computeCurrentStep(it.stages, it.final_email_date, it.final_email_date_2);
          return `${c.doneCount}/${c.totalCount}`;
        })()
      : "—";
    const row: WorkloadItem = {
      rowId: `return-${r.id}`,
      id: r.item_id,
      title: r.item_title,
      type: typeLabel(r.item_type),
      stageCode: null,
      stageName: returnBadgeLabel(r.stage),
      daysHeld: daysSince(r.sent_date),
      delivery: info.delivery,
      daysLeft: info.daysLeft,
      urgency: info.urgency,
      progress,
      isReturn: true,
    };
    const holder = r.person?.trim();
    if (holder) {
      if (!byHolder.has(holder)) byHolder.set(holder, []);
      byHolder.get(holder)!.push(row);
    } else {
      unassigned.push(row);
    }
  }

  // Within a person: longest-held first (most likely to be stuck / need a nudge).
  const sortItems = (a: WorkloadItem, b: WorkloadItem) => (b.daysHeld ?? -1) - (a.daysHeld ?? -1);

  const groups: WorkloadGroup[] = [...byHolder.entries()]
    .map(([holder, items]) => ({ holder, items: items.sort(sortItems) }))
    .sort((a, b) => b.items.length - a.items.length || a.holder.localeCompare(b.holder));

  unassigned.sort(sortItems);

  const totalItems = activeCount;

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
