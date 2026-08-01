import DashboardLayout from "@/components/DashboardLayout";
import ParaBoard from "./ParaBoard";
import { getCachedLanguageProgress } from "@/lib/progressData";
import { getCachedParaBoard, getCachedQuranPeople } from "@/lib/paraProgressData";
import { requireStaff } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ languageId: string }>;
}

export default async function EditProgressPage({ params }: PageProps) {
  const { languageId } = await params;

  // Editing is staff-only. Bounce viewers back to the read-only board.
  try {
    await requireStaff();
  } catch {
    redirect("/progress");
  }

  const [lang, people] = await Promise.all([
    getCachedLanguageProgress(languageId),
    getCachedQuranPeople(),
  ]);
  if (!lang) {
    notFound();
  }

  // The para rows for this language were already fetched above (as part of
  // getCachedLanguageProgress) and are request-scoped cached, so this reuses
  // them instead of issuing another query.
  const board = await getCachedParaBoard(languageId, lang.stageKeys);

  return (
    <DashboardLayout>
      <div className="mb-6 sm:mb-8">
        <nav className="mb-3 flex items-center gap-2 text-sm overflow-x-auto">
          <Link href="/progress" className="whitespace-nowrap text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition-colors duration-200">
            Progress
          </Link>
          <span className="text-gray-400 dark:text-gray-600">/</span>
          <span className="whitespace-nowrap font-medium text-gray-900 dark:text-gray-100">{lang.language}</span>
        </nav>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
              Update Progress — {lang.language}
            </h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              {lang.country}
              {lang.projectName ? ` · ${lang.projectName}` : ""}
            </p>
          </div>
          <Link
            href="/progress/people"
            className="btn-press inline-flex flex-shrink-0 items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            Manage workforce →
          </Link>
        </div>
        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
          Click a para to start it (pick a person + date), mark it finished, or reopen it. The
          progress bars on the main Progress board update automatically from this.
        </p>
      </div>

      <ParaBoard languageId={lang.languageId} languageName={lang.language} board={board} people={people} />
    </DashboardLayout>
  );
}
