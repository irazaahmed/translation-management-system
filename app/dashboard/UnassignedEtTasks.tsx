import Link from "next/link";

export interface UnassignedTask {
  id: string;
  title: string;
}

export interface UnassignedGroup {
  key: string;
  label: string;
  tasks: UnassignedTask[];
}

/**
 * Alert (shown on the English dashboard) for English Translation items waiting
 * for someone to be assigned (no stage has a date yet) — e.g. a weekly doc or
 * magazine article whose previous round finished but the next hand-off hasn't
 * been set. Grouped by category so it's clear what kind of work is stalled.
 */
export default function UnassignedEtTasks({
  groups,
  total,
}: {
  groups: UnassignedGroup[];
  total: number;
}) {
  if (total === 0) return null;

  return (
    <div className="mt-4 sm:mt-6 rounded-2xl border border-amber-300 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-900/15 p-4 sm:p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </span>
          <div>
            <h2 className="text-base font-semibold text-amber-800 dark:text-amber-300">
              Unassigned tasks ({total})
            </h2>
            <p className="text-xs text-amber-700/80 dark:text-amber-400/80">
              These need a person + date before work can start.
            </p>
          </div>
        </div>
        <Link href="/et/items?status=pending_assignment" className="flex-shrink-0 text-sm font-medium text-amber-700 dark:text-amber-400 hover:underline">
          View all →
        </Link>
      </div>

      <div className="mt-4 space-y-4">
        {groups.map((g) => (
          <div key={g.key}>
            <div className="mb-2 flex items-center gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">{g.label}</h3>
              <span className="rounded-full bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">{g.tasks.length}</span>
            </div>
            <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {g.tasks.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/et/items/${t.id}`}
                    className="group flex items-center gap-2 rounded-lg border border-amber-200/70 dark:border-amber-800/40 bg-white/70 dark:bg-gray-900/40 px-3 py-2"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm text-gray-800 dark:text-gray-200 group-hover:text-amber-700 dark:group-hover:text-amber-400" title={t.title}>
                      {t.title}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
