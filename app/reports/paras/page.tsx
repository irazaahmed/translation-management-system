import DashboardLayout from "@/components/DashboardLayout";
import Link from "next/link";
import { getCachedParaActivity, getCachedQuranPeople, getCachedLanguagesMeta } from "@/lib/paraProgressData";
import ParaReportBuilder, { type ParaActivityRow, type LanguageMeta } from "./ParaReportBuilder";

export const dynamic = "force-dynamic";

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default async function ParaReportsPage() {
  let activity: ParaActivityRow[] = [];
  let languages: LanguageMeta[] = [];
  let people: string[] = [];
  let error: string | null = null;

  try {
    const [rows, peopleRows, langRows] = await Promise.all([
      getCachedParaActivity(),
      getCachedQuranPeople(),
      getCachedLanguagesMeta(),
    ]);
    people = peopleRows.filter((p) => p.active).map((p) => p.name);
    languages = langRows;
    activity = rows.map((r) => ({
      language: r.language,
      country: r.country,
      projectName: r.projectName,
      stage: r.stage,
      stageName: languages.find((l) => l.language === r.language)?.stageKeys.find((s) => s.key === r.stage)?.label ?? r.stage,
      paraNumber: r.paraNumber,
      person: r.personName ?? "",
      startedAt: r.startedAt,
      finishedAt: r.finishedAt,
      status: r.finishedAt ? "Done" : "In progress",
    }));
  } catch (err) {
    console.error("Failed to build para reports:", err);
    error = "Failed to load. Has the add_para_progress migration been run?";
  }

  const now = new Date();
  const defaultFrom = iso(new Date(now.getFullYear(), now.getMonth(), 1));
  const defaultTo = iso(new Date(now.getFullYear(), now.getMonth() + 1, 0));

  return (
    <DashboardLayout>
      <div className="mb-4 sm:mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-600 dark:text-emerald-400">Quranic Translation</p>
          <h1 className="mt-1 text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">Para Progress Reports</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Who worked which para, when — filter by language, stage, person or date, then download as Excel or PDF.
          </p>
        </div>
        <Link href="/progress" className="btn-press inline-flex flex-shrink-0 items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
          ← Progress
        </Link>
      </div>

      {error ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-6 text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300">{error}</div>
      ) : (
        <ParaReportBuilder activity={activity} languages={languages} people={people} defaultFrom={defaultFrom} defaultTo={defaultTo} />
      )}
    </DashboardLayout>
  );
}
