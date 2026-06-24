import DashboardLayout from "@/components/DashboardLayout";
import Link from "next/link";
import { getCachedEtItemsWithStages, getCachedEtPeople } from "@/lib/etData";
import {
  computeCurrentStep,
  isStageSkipped,
  itemCategory,
  reminderInfo,
  stageName,
  typeLabel,
  CATEGORY_LABELS,
} from "@/lib/et";
import ReportBuilder, { type ActivityRow, type ItemReportRow } from "./ReportBuilder";

export const dynamic = "force-dynamic";

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default async function EtReportsPage() {
  let activity: ActivityRow[] = [];
  let items: ItemReportRow[] = [];
  let people: string[] = [];
  let error: string | null = null;

  try {
    const [withStages, peopleRows] = await Promise.all([
      getCachedEtItemsWithStages(),
      getCachedEtPeople(),
    ]);
    people = peopleRows.map((p) => p.name);

    for (const item of withStages) {
      if (item.stopped) continue;
      const cat = itemCategory(item.type);
      const typeName = typeLabel(item.type);
      const current = computeCurrentStep(item.stages, item.final_email_date, item.final_email_date_2);

      // One activity row per touched (non-skipped) stage — who had it & when.
      for (const s of item.stages) {
        if (isStageSkipped(s)) continue;
        if (!s.person && !s.sent_date && !s.received_back_date) continue;
        activity.push({
          itemId: item.id,
          itemTitle: item.title,
          type: typeName,
          category: CATEGORY_LABELS[cat],
          stage: s.stage,
          stageName: stageName(s.stage),
          person: s.person ?? "",
          sent: s.sent_date,
          received: s.received_back_date,
        });
      }

      items.push({
        itemId: item.id,
        title: item.title,
        type: typeName,
        category: CATEGORY_LABELS[cat],
        status: current.completed ? "Completed" : current.unassigned ? "Unassigned" : "In Progress",
        stageCode: current.stage,
        currentStep: current.stage ? `${current.stage} · ${current.label}` : current.label,
        holder: current.holder ?? "",
        progress: `${current.doneCount}/${current.totalCount}`,
        delivery: reminderInfo(item).delivery,
        wordCount: item.word_count,
        received: item.received_date,
        finalEmail: item.final_email_date_2 || item.final_email_date,
      });
    }
  } catch (err) {
    console.error("Failed to build reports:", err);
    error = "Failed to load. Have you run the migration and import yet?";
  }

  const now = new Date();
  const defaultFrom = iso(new Date(now.getFullYear(), now.getMonth(), 1));
  const defaultTo = iso(new Date(now.getFullYear(), now.getMonth() + 1, 0));

  return (
    <DashboardLayout>
      <div className="mb-4 sm:mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-600 dark:text-emerald-400">English Translation</p>
          <h1 className="mt-1 text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">Reports</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Per-person activity &amp; full items export — filter, then download as Excel or PDF.
          </p>
        </div>
        <Link href="/et" className="btn-press inline-flex flex-shrink-0 items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
          ← Dashboard
        </Link>
      </div>

      {error ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-6 text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300">{error}</div>
      ) : (
        <ReportBuilder
          activity={activity}
          items={items}
          people={people}
          defaultFrom={defaultFrom}
          defaultTo={defaultTo}
        />
      )}
    </DashboardLayout>
  );
}
