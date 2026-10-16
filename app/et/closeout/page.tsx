import DashboardLayout from "@/components/DashboardLayout";
import Link from "next/link";
import { getCachedEtItemRows, type EtItemRow } from "@/lib/etData";
import { CATEGORY_LABELS, LINK_MISSING_BADGE_CLASSES, daysSince, isWsbType, itemCategory, typeLabel } from "@/lib/et";
import EtCloseoutForm from "../items/[id]/EtCloseoutForm";

export const dynamic = "force-dynamic";

function fmt(d: string | null): string {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

/** The final email that completed the pipeline (wsb: the 2nd, sisters' email). */
function finalEmailOf(row: EtItemRow): string | null {
  return isWsbType(row.type) ? row.final_email_date_2 : row.final_email_date;
}

function Pending({ row }: { row: EtItemRow }) {
  const sent = finalEmailOf(row);
  const d = daysSince(sent);
  return (
    <div className="gloss rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <Link href={`/et/items/${row.id}?from=${encodeURIComponent("/et/closeout")}`} className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-sm font-semibold text-gray-900 dark:text-white hover:text-emerald-600 dark:hover:text-emerald-400" title={row.title}>{row.title}</h3>
        </Link>
        <span className={`flex-shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${LINK_MISSING_BADGE_CLASSES}`}>
          Link / remark missing
        </span>
      </div>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        {typeLabel(row.type)} · Final email {fmt(sent)}
        {d != null && <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[11px] ${d > 7 ? "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"}`}>{d}d</span>}
      </p>
      <div className="mt-3 border-t border-gray-100 dark:border-gray-800 pt-3">
        <EtCloseoutForm compact itemId={row.id} link={row.delivery_link} remarks={row.delivery_remarks} />
      </div>
    </div>
  );
}

export default async function EtCloseoutPage() {
  let rows: EtItemRow[] = [];
  let error: string | null = null;
  try {
    rows = await getCachedEtItemRows();
  } catch (err) {
    console.error("Failed to fetch ET items:", err);
    error = "Failed to load. Have you run the migrations yet?";
  }

  // Final email sent, link / remark not recorded yet — oldest email first.
  const pending = rows
    .filter((r) => !r.stopped && r.derivedStatus === "link_missing")
    .sort((a, b) => (finalEmailOf(a) ?? "").localeCompare(finalEmailOf(b) ?? ""));

  // Recently closed out, so a wrong link / remark can be fixed quickly.
  const recent = rows
    .filter((r) => r.link_required && r.closeout_date && r.derivedStatus === "completed")
    .sort((a, b) => (b.closeout_date ?? "").localeCompare(a.closeout_date ?? ""))
    .slice(0, 10);

  return (
    <DashboardLayout>
      <div className="mb-4 sm:mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-600 dark:text-emerald-400">English Translation</p>
          <h1 className="mt-1 text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">Link / Remarks</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {pending.length} item{pending.length === 1 ? "" : "s"} sent (final email done) — add the online / SharePoint link or a remark to complete.
          </p>
        </div>
        <Link href="/et" className="btn-press inline-flex flex-shrink-0 items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
          ← Dashboard
        </Link>
      </div>

      {error ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-6 text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300">{error}</div>
      ) : (
        <>
          {pending.length === 0 ? (
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-10 text-center text-gray-500 dark:text-gray-400">
              Nothing waiting — every sent item has its link or remark.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {pending.map((row) => (
                <Pending key={row.id} row={row} />
              ))}
            </div>
          )}

          {recent.length > 0 && (
            <div className="mt-8">
              <h2 className="mb-3 text-base font-semibold text-gray-900 dark:text-white">Recently completed</h2>
              <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
                <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                  {recent.map((r) => (
                    <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm">
                      <Link href={`/et/items/${r.id}?from=${encodeURIComponent("/et/closeout")}`} className="min-w-0 flex-1 truncate font-medium text-gray-900 dark:text-white hover:text-emerald-600 dark:hover:text-emerald-400" title={r.title}>
                        {r.title}
                      </Link>
                      <span className="text-xs text-gray-500 dark:text-gray-400">{CATEGORY_LABELS[itemCategory(r.type)]}</span>
                      {r.delivery_link ? (
                        <a href={r.delivery_link} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline">Link ↗</a>
                      ) : (
                        <span className="max-w-[16rem] truncate text-xs text-gray-500 dark:text-gray-400" title={r.delivery_remarks ?? ""}>“{r.delivery_remarks}”</span>
                      )}
                      <span className="text-xs text-gray-400 dark:text-gray-500">{fmt(r.closeout_date)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </>
      )}
    </DashboardLayout>
  );
}
