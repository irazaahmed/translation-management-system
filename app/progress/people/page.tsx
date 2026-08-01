import DashboardLayout from "@/components/DashboardLayout";
import Link from "next/link";
import { getCachedQuranPeople, getCachedActiveParaCounts } from "@/lib/paraProgressData";
import QuranPeopleManager from "./QuranPeopleManager";

export const dynamic = "force-dynamic";

export default async function QuranPeoplePage() {
  let people: Awaited<ReturnType<typeof getCachedQuranPeople>> = [];
  let workloads: Record<string, number> = {};
  let error: string | null = null;
  try {
    [people, workloads] = await Promise.all([getCachedQuranPeople(), getCachedActiveParaCounts()]);
  } catch (err) {
    console.error("Failed to fetch quran_people:", err);
    error = "Failed to load. Has the add_para_progress migration been run?";
  }

  return (
    <DashboardLayout>
      <div className="mb-4 sm:mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">Workforce</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{people.length} team members · Quranic Translation</p>
        </div>
        <Link
          href="/progress"
          className="btn-press inline-flex flex-shrink-0 items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          ← Progress
        </Link>
      </div>

      {error ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-6 text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300">{error}</div>
      ) : (
        <QuranPeopleManager people={people} workloads={workloads} />
      )}
    </DashboardLayout>
  );
}
