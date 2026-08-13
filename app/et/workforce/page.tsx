import DashboardLayout from "@/components/DashboardLayout";
import Link from "next/link";
import { getCachedEtItemRows, getCachedEtPeople, getCachedEtAssignments, type EtItemRow } from "@/lib/etData";
import { typeShortLabel, type EtAssignment } from "@/lib/et";
import WorkforceManager, { type PlannerItem } from "./WorkforceManager";

export const dynamic = "force-dynamic";

export default async function EtWorkforcePage() {
  let people: Awaited<ReturnType<typeof getCachedEtPeople>> = [];
  let rows: EtItemRow[] = [];
  let assignments: EtAssignment[] = [];
  let error: string | null = null;
  try {
    [people, rows, assignments] = await Promise.all([
      getCachedEtPeople(),
      getCachedEtItemRows(),
      getCachedEtAssignments(),
    ]);
  } catch (err) {
    console.error("Failed to fetch workforce:", err);
    error = "Failed to load. Have you run the migration and import yet?";
  }

  // Item picker options for the planner — every non-stopped item, A–Z.
  const plannerItems: PlannerItem[] = rows
    .filter((r) => !r.stopped)
    .map((r) => ({ id: r.id, title: r.title, type: typeShortLabel(r.type) }))
    .sort((a, b) => a.title.localeCompare(b.title));

  // Planned assignments grouped by person id (already position-ordered).
  const assignmentsByPerson: Record<string, EtAssignment[]> = {};
  for (const a of assignments) {
    (assignmentsByPerson[a.person_id] ||= []).push(a);
  }

  // Active workload per holder (match on the name as stored in stages).
  const load = new Map<string, number>();
  rows
    .filter((r) => r.derivedStatus !== "completed" && !r.stopped)
    .forEach((r) => {
      if (r.current.holder) load.set(r.current.holder, (load.get(r.current.holder) || 0) + 1);
    });

  // Best-effort match a person's name to their workload (the stage "person"
  // strings sometimes differ slightly from the Workforce name, e.g. "Jawwad
  // Jamil (USA)" vs "Jawwad Jamil USA").
  const loadFor = (name: string): number => {
    if (load.has(name)) return load.get(name)!;
    const first = name.split(/[\s(]/)[0].toLowerCase();
    let total = 0;
    for (const [holder, count] of load) {
      if (holder.toLowerCase().startsWith(first)) total += count;
    }
    return total;
  };

  // Active workload per person, keyed by id, for the manager cards.
  const workloads: Record<string, number> = Object.fromEntries(
    people.map((p) => [p.id, loadFor(p.name)])
  );

  return (
    <DashboardLayout>
      <div className="mb-4 sm:mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-600 dark:text-emerald-400">English Translation</p>
          <h1 className="mt-1 text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">Workforce</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{people.length} team members</p>
        </div>
        <Link href="/et" className="btn-press inline-flex flex-shrink-0 items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
          ← Dashboard
        </Link>
      </div>

      {error ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-6 text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300">{error}</div>
      ) : (
        <WorkforceManager
          people={people}
          workloads={workloads}
          plannerItems={plannerItems}
          assignmentsByPerson={assignmentsByPerson}
        />
      )}
    </DashboardLayout>
  );
}
