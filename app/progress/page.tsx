import DashboardLayout from "@/components/DashboardLayout";
import StageProgressBars from "@/components/StageProgressBars";
import { getCachedProgressBoard } from "@/lib/progressData";
import { TOTAL_PARAS, type LanguageProgress } from "@/lib/progress";
import { StaffOnly } from "@/components/AuthProvider";
import Link from "next/link";

export const dynamic = "force-dynamic";

/** Small circular completion indicator. */
function CompletionRing({ percent }: { percent: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const offset = c - (percent / 100) * c;
  return (
    <div className="relative flex-shrink-0">
      <svg width="64" height="64" viewBox="0 0 64 64" className="-rotate-90">
        <circle
          cx="32" cy="32" r={r} fill="none" strokeWidth="6"
          className="stroke-gray-100 dark:stroke-gray-700"
        />
        <circle
          cx="32" cy="32" r={r} fill="none" strokeWidth="6" strokeLinecap="round"
          className="stroke-emerald-500 transition-all duration-700"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-gray-900 dark:text-gray-100">
        {percent}%
      </span>
    </div>
  );
}

function LanguageCard({ lang }: { lang: LanguageProgress }) {
  return (
    <div className="card-hover rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 transition-colors duration-200">
      {/* Header */}
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-bold text-gray-900 dark:text-gray-100">
            {lang.language}
          </h3>
          <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
            {lang.country}
            {lang.responsiblePerson ? ` · ${lang.responsiblePerson}` : ""}
          </p>
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-rose-50 dark:bg-rose-900/20 px-2.5 py-1 text-[11px] font-medium text-rose-600 dark:text-rose-400">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
            {lang.finishedParas}/{TOTAL_PARAS} paras fully complete
          </p>
        </div>
        <CompletionRing percent={lang.pipelinePercent} />
      </div>

      {/* Stage bars */}
      <StageProgressBars languageName={lang.language} stages={lang.stages} />

      {/* Edit (staff only) */}
      <StaffOnly>
        <Link
          href={`/progress/${lang.languageId}`}
          className="btn-press mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-200"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Update progress
        </Link>
      </StaffOnly>
    </div>
  );
}

export default async function ProgressPage() {
  let board: Awaited<ReturnType<typeof getCachedProgressBoard>> = [];
  let error: string | null = null;

  try {
    board = await getCachedProgressBoard();
  } catch (err) {
    console.error("Failed to load progress board:", err);
    error = "Failed to load progress. Please try again.";
  }

  const allLanguages = board.flatMap((g) => g.languages);
  const totalLanguages = allLanguages.length;
  const totalFinished = allLanguages.reduce((s, l) => s + l.finishedParas, 0);
  const avgPercent =
    totalLanguages === 0
      ? 0
      : Math.round(
          allLanguages.reduce((s, l) => s + l.pipelinePercent, 0) / totalLanguages
        );

  return (
    <DashboardLayout>
      {/* Page header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
          Progress Tracking
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Para-by-para progress of every in-progress language through its stages —
          Translation → Formation → Tafteesh → Designing → Final Proof Reading.
          (Braille follows its own pipeline.)
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4">
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Summary stats */}
      {totalLanguages > 0 && (
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
            <p className="text-sm text-gray-500 dark:text-gray-400">Languages tracked</p>
            <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{totalLanguages}</p>
          </div>
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
            <p className="text-sm text-gray-500 dark:text-gray-400">Average completion</p>
            <p className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">{avgPercent}%</p>
          </div>
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
            <p className="text-sm text-gray-500 dark:text-gray-400">Paras fully completed</p>
            <p className="mt-1 text-2xl font-bold text-rose-600 dark:text-rose-400">{totalFinished}</p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {totalLanguages === 0 && !error && (
        <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 p-12 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <h4 className="mt-4 text-lg font-medium text-gray-900 dark:text-gray-100">No in-progress languages</h4>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Mark a language as “In Progress” to start tracking its para-by-para progress here.
          </p>
        </div>
      )}

      {/* Project groups */}
      <div className="space-y-10">
        {board.map((group) => (
          <section key={group.projectId}>
            <div className="mb-4 flex items-center gap-3">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {group.projectName}
              </h2>
              <span className="rounded-full bg-gray-100 dark:bg-gray-700 px-2.5 py-0.5 text-xs font-medium text-gray-600 dark:text-gray-300">
                {group.languages.length} {group.languages.length === 1 ? "language" : "languages"}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {group.languages.map((lang) => (
                <LanguageCard key={lang.languageId} lang={lang} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </DashboardLayout>
  );
}
