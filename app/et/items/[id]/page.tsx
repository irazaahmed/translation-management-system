import DashboardLayout from "@/components/DashboardLayout";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCachedEtItem, getCachedEtPeople, getCachedEtReturns } from "@/lib/etData";
import { computeAdvance, computeCurrentStep, daysSince, isStageSkipped, stageName, typeLabel } from "@/lib/et";
import EtPipelineEditor from "./EtPipelineEditor";
import EtItemActions from "./EtItemActions";
import EtQuickAdvance from "./EtQuickAdvance";
import EtReturns from "./EtReturns";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

function fmt(d: string | null): string {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function daysBetween(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  const da = new Date(a).getTime();
  const db = new Date(b).getTime();
  if (isNaN(da) || isNaN(db)) return null;
  return Math.round((db - da) / (24 * 60 * 60 * 1000));
}

export default async function EtItemDetailPage({ params }: Props) {
  const { id } = await params;
  const [item, people, returns] = await Promise.all([
    getCachedEtItem(id),
    getCachedEtPeople(),
    getCachedEtReturns(id),
  ]);
  if (!item) notFound();

  const current = computeCurrentStep(item.stages, item.final_email_date);
  const sinceDays = daysSince(current.since);
  const peopleNames = people.map((p) => p.name);

  // Quick-advance data: which stage to act on next, straight from the summary.
  const quickAdvance = item.stopped ? null : computeAdvance(item.stages, item.final_email_date);

  // Movement timeline: stages that have actually been touched (assigned/sent),
  // in pipeline order — who had it, when it was sent and came back, how long.
  const timeline = item.stages
    .filter((s) => !isStageSkipped(s) && (s.person || s.sent_date || s.received_back_date))
    .sort((a, b) => a.seq - b.seq);

  return (
    <DashboardLayout>
      {/* Back + breadcrumb */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link href="/et/items" className="inline-flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400 hover:underline">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Work Items
        </Link>
        <EtItemActions itemId={item.id} title={item.title} stopped={item.stopped} />
      </div>

      {item.stopped && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-800/60 p-3 text-sm text-gray-700 dark:text-gray-300">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          This project is <span className="font-semibold">stopped / skipped</span> — kept for the record. Use “Resume” to bring it back.
        </div>
      )}

      {/* Header card */}
      <div className="gloss mb-5 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 sm:p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
            {typeLabel(item.type)}
          </span>
          {item.word_count != null && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
              {item.word_count.toLocaleString()} words
            </span>
          )}
          {item.delivery_date && (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
              Delivery: {fmt(item.delivery_date)}
            </span>
          )}
          {item.final_email_date && (
            <span className="rounded-full bg-green-50 px-2 py-0.5 font-medium text-green-700 dark:bg-green-900/20 dark:text-green-400">
              ✓ Final email: {fmt(item.final_email_date)}
            </span>
          )}
        </div>
        <h1 className="mt-2 text-lg sm:text-2xl font-bold text-gray-900 dark:text-white break-words">{item.title}</h1>

        {/* Current step banner */}
        <div className="mt-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-3 sm:p-4">
          {current.completed ? (
            <p className="text-sm font-medium text-green-700 dark:text-green-400">
              ✓ Completed{item.final_email_date ? " — final email sent." : " — all applicable stages done."}
            </p>
          ) : current.unassigned ? (
            <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Pending assignment — no stage has been assigned yet.</p>
          ) : (
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Currently at{" "}
              <span className="font-semibold text-gray-900 dark:text-white">{current.label}</span>
              {current.holder && (
                <>
                  {" "}with <span className="font-semibold text-gray-900 dark:text-white">{current.holder}</span>
                </>
              )}
              {current.since && (
                <>
                  {" "}since {fmt(current.since)}
                  {sinceDays != null && (
                    <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${sinceDays > 30 ? "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400" : "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300"}`}>
                      {sinceDays} day{sinceDays === 1 ? "" : "s"} here
                    </span>
                  )}
                </>
              )}
            </p>
          )}
          <div className="mt-2 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all"
                style={{ width: `${current.totalCount ? (current.doneCount / current.totalCount) * 100 : 0}%` }}
              />
            </div>
            <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400">{current.doneCount}/{current.totalCount}</span>
          </div>

          {quickAdvance && (
            <EtQuickAdvance itemId={item.id} advance={quickAdvance} peopleNames={peopleNames} />
          )}
        </div>

        {item.received_date && (
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">Received: {fmt(item.received_date)}</p>
        )}
      </div>

      {/* Pipeline (editable for staff, read-only for viewers) */}
      <h2 className="mb-3 text-base font-semibold text-gray-900 dark:text-white">Pipeline</h2>
      <EtPipelineEditor itemId={item.id} stages={item.stages} peopleNames={peopleNames} finalEmailDate={item.final_email_date} />

      {/* Movement timeline — who had it, when sent, when returned, how long */}
      <h2 className="mt-6 mb-3 text-base font-semibold text-gray-900 dark:text-white">Tracking — who had it &amp; when</h2>
      {timeline.length === 0 ? (
        <p className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 text-sm text-gray-500 dark:text-gray-400">
          No movement recorded yet. Assign people and dates in the pipeline above.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <ol className="divide-y divide-gray-100 dark:divide-gray-800">
            {timeline.map((s) => {
              const dur = daysBetween(s.sent_date, s.received_back_date);
              const isCurrent = s.stage === current.stage;
              const held = !s.received_back_date && s.sent_date ? daysBetween(s.sent_date, new Date().toISOString().slice(0, 10)) : null;
              return (
                <li key={s.stage} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
                  <span className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${s.received_back_date ? "bg-green-500 text-white" : isCurrent ? "bg-emerald-600 text-white" : "bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-300"}`}>
                    {s.received_back_date ? "✓" : s.seq}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {s.stage} · {stageName(s.stage)}
                      <span className="ml-2 font-normal text-gray-600 dark:text-gray-400">{s.person || "—"}</span>
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Sent {fmt(s.sent_date)} → Returned {fmt(s.received_back_date)}
                    </p>
                  </div>
                  {dur != null ? (
                    <span className="flex-shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                      {dur} day{dur === 1 ? "" : "s"}
                    </span>
                  ) : held != null ? (
                    <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${held > 30 ? "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400" : "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400"}`}>
                      holding · {held}d
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {/* Returns — go back and complete a missed part */}
      <EtReturns itemId={item.id} returns={returns} peopleNames={peopleNames} />

      {/* Further process notes */}
      {item.further_process && (
        <div className="mt-5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Notes / Further process</h3>
          <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-400">{item.further_process}</p>
        </div>
      )}
    </DashboardLayout>
  );
}
