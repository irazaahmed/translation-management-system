import DashboardLayout from "@/components/DashboardLayout";
import Link from "next/link";
import { getCachedEtItemRows } from "@/lib/etData";
import { StaffOnly } from "@/components/AuthProvider";
import EtItemsList from "./EtItemsList";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{
    holder?: string;
    stage?: string;
    status?: string;
    category?: string;
    q?: string;
    sort?: string;
  }>;
}

export default async function EtItemsPage({ searchParams }: Props) {
  const sp = await searchParams;
  let rows: Awaited<ReturnType<typeof getCachedEtItemRows>> = [];
  let error: string | null = null;

  try {
    rows = await getCachedEtItemRows();
  } catch (err) {
    console.error("Failed to fetch ET items:", err);
    error = "Failed to load items. Have you run the migration and import yet?";
  }

  const live = rows.filter((r) => !r.stopped);
  const active = live.filter((r) => r.derivedStatus !== "completed").length;
  const completed = live.filter((r) => r.derivedStatus === "completed").length;
  const skipped = rows.filter((r) => r.stopped).length;

  return (
    <DashboardLayout>
      <div className="mb-4 sm:mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-600 dark:text-emerald-400">English Translation</p>
          <h1 className="mt-1 text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">Work Items</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {live.length} items · {active} active · {completed} completed{skipped > 0 ? ` · ${skipped} skipped` : ""}
          </p>
        </div>
        <StaffOnly>
          <Link
            href="/et/items/new"
            className="btn-press inline-flex flex-shrink-0 items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:from-emerald-700 hover:to-teal-700"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Item
          </Link>
        </StaffOnly>
      </div>

      {error ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-6 text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
          <p className="font-medium">{error}</p>
          <p className="mt-2 text-sm">
            Run <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/40">lib/migrations/add_english_translation.sql</code> in Supabase, then{" "}
            <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/40">python scripts/import_english_translation.py "&lt;file&gt;.xlsx"</code>.
          </p>
        </div>
      ) : (
        <EtItemsList
          items={rows}
          initial={{
            holder: sp.holder,
            stage: sp.stage,
            status: sp.status,
            category: sp.category,
            q: sp.q,
            sort: sp.sort,
          }}
        />
      )}
    </DashboardLayout>
  );
}
