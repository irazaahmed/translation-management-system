import DashboardLayout from "@/components/DashboardLayout";
import Link from "next/link";
import { getCachedEtItemRows, getCachedEtPeople, type EtItemRow } from "@/lib/etData";
import { STAGES, daysSince, isMagazineType, stageBadgeClasses } from "@/lib/et";
import EtQuickAdvance from "../items/[id]/EtQuickAdvance";

export const dynamic = "force-dynamic";

function fmt(d: string | null): string {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function Article({ row, peopleNames }: { row: EtItemRow; peopleNames: string[] }) {
  const d = daysSince(row.current.since);
  return (
    <div className="gloss card-hover rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <Link href={`/et/items/${row.id}?from=${encodeURIComponent("/et/magazine")}`} className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-gray-900 dark:text-white hover:text-emerald-600 dark:hover:text-emerald-400" title={row.title}>{row.title}</h3>
        </Link>
        <span className={`flex-shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${stageBadgeClasses(row.current.stage, row.current.completed)}`}>
          {row.current.stage ? `${row.current.stage} · ${row.current.label}` : row.current.label}
        </span>
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
          <p className="text-gray-500 dark:text-gray-400">Since</p>
          <p className="font-medium text-gray-900 dark:text-white">
            {fmt(row.current.since)}
            {d != null && <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[11px] ${d > 30 ? "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"}`}>{d}d</span>}
          </p>
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

export default async function EtMagazinePage() {
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

  const articles = rows
    .filter((r) => isMagazineType(r.type) && !r.stopped)
    .sort((a, b) => a.title.localeCompare(b.title));

  const active = articles.filter((a) => a.derivedStatus !== "completed");
  const completed = articles.filter((a) => a.derivedStatus === "completed");

  return (
    <DashboardLayout>
      <div className="mb-4 sm:mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-600 dark:text-emerald-400">English Translation</p>
          <h1 className="mt-1 text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">Magazine</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {articles.length} articles · {active.length} active · {completed.length} completed
          </p>
        </div>
        <Link href="/et" className="btn-press inline-flex flex-shrink-0 items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
          ← Dashboard
        </Link>
      </div>

      {error ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-6 text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300">{error}</div>
      ) : articles.length === 0 ? (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-10 text-center text-gray-500 dark:text-gray-400">
          No magazine articles yet. Add an item with type “Magazine”.
        </div>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {STAGES.map((s) => (
              <span key={s.code} className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${stageBadgeClasses(s.code)}`} title={s.name}>{s.code}</span>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {articles.map((row) => (
              <Article key={row.id} row={row} peopleNames={peopleNames} />
            ))}
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
