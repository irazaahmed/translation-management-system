"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { usePermissions } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import {
  stagesForType,
  isWsbType,
  computeCurrentStep,
  stageName,
  type EtStage,
  type StageCode,
} from "@/lib/et";
import { saveEtStagesAction } from "@/app/actions/etActions";
import PersonSelect from "@/components/PersonSelect";

const TODAY = new Date().toISOString().slice(0, 10);

function fmt(d: string | null): string {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

type SkipState = "active" | "na" | "merged";

type Editable = {
  stage: StageCode;
  seq: number;
  person: string;
  sent_date: string;
  received_back_date: string;
  skip: SkipState;
};

function toEditable(stages: EtStage[], type?: string | null): Editable[] {
  const byCode = new Map(stages.map((s) => [s.stage, s]));
  return stagesForType(type).map((s) => {
    const row = byCode.get(s.code);
    const skip: SkipState = row?.merged ? "merged" : row?.not_applicable ? "na" : "active";
    return {
      stage: s.code,
      seq: s.seq,
      person: row?.person ?? "",
      sent_date: row?.sent_date ?? "",
      received_back_date: row?.received_back_date ?? "",
      skip,
    };
  });
}

type StageState = "done" | "current" | "pending" | "na" | "merged";

const STATE_DOT: Record<StageState, string> = {
  done: "bg-green-500 text-white",
  current: "bg-emerald-600 text-white ring-4 ring-emerald-500/25",
  pending: "bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400",
  na: "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-600",
  merged: "bg-violet-100 text-violet-500 dark:bg-violet-900/30 dark:text-violet-400",
};
const STATE_LABEL: Record<StageState, string> = {
  done: "Done",
  current: "In progress",
  pending: "Pending",
  na: "N/A",
  merged: "Merged",
};

interface Props {
  itemId: string;
  stages: EtStage[];
  peopleNames: string[];
  finalEmailDate?: string | null;
  finalEmailDate2?: string | null;
  type?: string | null;
}

export default function EtPipelineEditor({ itemId, stages, peopleNames, finalEmailDate, finalEmailDate2, type }: Props) {
  const { canWrite } = usePermissions();
  const toast = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const isWsb = isWsbType(type);

  const [rows, setRows] = useState<Editable[]>(() => toEditable(stages, type));
  const [finalEmail, setFinalEmail] = useState(finalEmailDate ?? "");
  const [finalEmail2, setFinalEmail2] = useState(finalEmailDate2 ?? "");
  const [dirty, setDirty] = useState(false);
  // Which save button was clicked (so only that one shows the "Saving…" state).
  const [savingBack, setSavingBack] = useState(false);

  // Live current-step computation from the in-memory rows (+ final email dates).
  const current = useMemo(
    () =>
      computeCurrentStep(
        rows.map((r) => ({
          id: "",
          item_id: itemId,
          stage: r.stage,
          seq: r.seq,
          person: r.person || null,
          sent_date: r.sent_date || null,
          received_back_date: r.received_back_date || null,
          not_applicable: r.skip === "na",
          merged: r.skip === "merged",
        })),
        finalEmail || null,
        finalEmail2 || null
      ),
    [rows, itemId, finalEmail, finalEmail2]
  );

  const setFinal = (v: string) => {
    setFinalEmail(v);
    setDirty(true);
  };
  const setFinal2 = (v: string) => {
    setFinalEmail2(v);
    setDirty(true);
  };

  // Final-email cards. wsb items show two (handoff to sisters, then final send);
  // every other type shows a single "Final email" card.
  const readonlyEmailCard = (value: string, title: string) => (
    <div key={title} className={`mt-3 flex flex-wrap items-center gap-3 rounded-xl border p-4 ${value ? "border-green-300 dark:border-green-700 bg-green-50/50 dark:bg-green-900/10" : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"}`}>
      <span className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-sm ${value ? "bg-green-500 text-white" : "bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-300"}`}>✉</span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-900 dark:text-white">{title} {value ? "sent" : "not sent"}</p>
      </div>
      <span className="ml-auto text-sm font-medium text-gray-700 dark:text-gray-300">{fmt(value || null)}</span>
    </div>
  );

  const editableEmailCard = (value: string, onChange: (v: string) => void, title: string, subtitle: string) => (
    <div key={title} className={`mt-3 flex flex-wrap items-center gap-3 rounded-xl border p-4 ${value ? "border-green-300 dark:border-green-700 bg-green-50/50 dark:bg-green-900/10" : "border-emerald-300 dark:border-emerald-700 bg-emerald-50/40 dark:bg-emerald-900/10"}`}>
      <span className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-sm ${value ? "bg-green-500 text-white" : "bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-300"}`}>✉</span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-900 dark:text-white">{title}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>
      </div>
      <div className="ml-auto flex items-center gap-1">
        <input type="date" value={value} onChange={(e) => onChange(e.target.value)} aria-label={title} className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-xs text-gray-900 dark:text-white focus:border-emerald-500 focus:outline-none" />
        <button type="button" onClick={() => onChange(TODAY)} title="Sent today" className="flex-shrink-0 rounded-md bg-emerald-100 dark:bg-emerald-900/30 px-1.5 py-1 text-[10px] font-medium text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/50">✉Today</button>
        {value && (
          <button type="button" onClick={() => onChange("")} title="Clear" className="flex-shrink-0 rounded-md px-1.5 py-1 text-[11px] font-medium text-gray-400 hover:text-red-600 dark:hover:text-red-400">✕</button>
        )}
      </div>
    </div>
  );

  const update = (i: number, patch: Partial<Editable>) => {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
    setDirty(true);
  };

  // After parts are merged, the leftover empty stages can be marked merged in one go.
  const emptyActiveCount = rows.filter(
    (r) => r.skip === "active" && !r.person && !r.sent_date && !r.received_back_date
  ).length;
  const markEmptyMerged = () => {
    setRows((prev) =>
      prev.map((r) =>
        r.skip === "active" && !r.person && !r.sent_date && !r.received_back_date
          ? { ...r, skip: "merged" as SkipState }
          : r
      )
    );
    setDirty(true);
  };

  const stageStateOf = (r: Editable): StageState => {
    if (r.skip === "merged") return "merged";
    if (r.skip === "na") return "na";
    if (r.received_back_date) return "done";
    if (r.stage === current.stage) return "current";
    return "pending";
  };

  const save = (goBack: boolean) => {
    setSavingBack(goBack);
    startTransition(async () => {
      const res = await saveEtStagesAction(
        itemId,
        rows.map((r) => ({
          stage: r.stage,
          person: r.person.trim() || null,
          sent_date: r.sent_date || null,
          received_back_date: r.received_back_date || null,
          not_applicable: r.skip === "na",
          merged: r.skip === "merged",
        })),
        finalEmail || null,
        isWsb ? finalEmail2 || null : undefined
      );
      if (res.error) {
        toast({ type: "error", message: res.error });
      } else {
        toast({ type: "success", message: "Pipeline saved." });
        setDirty(false);
        if (goBack) router.back();
        else router.refresh();
      }
    });
  };

  // ---- Read-only view (viewers) ----
  if (!canWrite) {
    return (
      <div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {rows.map((r) => {
          const st = stageStateOf(r);
          return (
            <div key={r.stage} className={`rounded-xl border p-3 ${st === "current" ? "border-emerald-400 dark:border-emerald-600 bg-emerald-50/50 dark:bg-emerald-900/10" : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"}`}>
              <div className="flex items-center gap-2">
                <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${STATE_DOT[st]}`}>
                  {st === "done" ? "✓" : r.seq}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{r.stage}</p>
                  <p className="truncate text-xs text-gray-500 dark:text-gray-400">{stageName(r.stage)}</p>
                </div>
                <span className="ml-auto text-[11px] font-medium text-gray-400 dark:text-gray-500">{STATE_LABEL[st]}</span>
              </div>
              {r.skip === "merged" ? (
                <p className="mt-2 text-xs italic text-violet-600 dark:text-violet-400">Merged into the combined file — stage not needed.</p>
              ) : (
                <div className="mt-2 space-y-1 text-xs">
                  <p className="text-gray-700 dark:text-gray-300"><span className="text-gray-400 dark:text-gray-500">Person: </span>{r.person || (st === "na" ? "N/A" : "—")}</p>
                  <p className="text-gray-600 dark:text-gray-400">
                    <span className="text-gray-400 dark:text-gray-500">Sent: </span>{fmt(r.sent_date || null)}
                    <span className="mx-1">→</span>
                    <span className="text-gray-400 dark:text-gray-500">Back: </span>{fmt(r.received_back_date || null)}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Final email(s) — when set, the item is complete */}
      {isWsb ? (
        <>
          {readonlyEmailCard(finalEmail, "Final email — Islamic Sisters")}
          {readonlyEmailCard(finalEmail2, "Final email — sisters' final")}
        </>
      ) : (
        readonlyEmailCard(finalEmail, "Final email")
      )}
      </div>
    );
  }

  // ---- Editable view (staff) ----
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {rows.map((r, i) => {
          const st = stageStateOf(r);
          return (
            <div key={r.stage} className={`rounded-xl border p-3 ${st === "current" ? "border-emerald-400 dark:border-emerald-600 bg-emerald-50/50 dark:bg-emerald-900/10" : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"} ${r.skip !== "active" ? "opacity-70" : ""}`}>
              <div className="flex items-center gap-2">
                <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${STATE_DOT[st]}`}>
                  {st === "done" ? "✓" : r.seq}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{r.stage}</p>
                  <p className="truncate text-xs text-gray-500 dark:text-gray-400">{stageName(r.stage)}</p>
                </div>
                <select
                  aria-label={`${r.stage} state`}
                  value={r.skip}
                  onChange={(e) => update(i, { skip: e.target.value as SkipState })}
                  className="ml-auto rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-1 py-0.5 text-[11px] text-gray-600 dark:text-gray-300 focus:border-emerald-500 focus:outline-none"
                >
                  <option value="active">Active</option>
                  <option value="na">N/A</option>
                  <option value="merged">Merged</option>
                </select>
              </div>

              {r.skip === "merged" ? (
                <p className="mt-2 text-xs italic text-violet-600 dark:text-violet-400">Merged into the combined file — stage not needed.</p>
              ) : r.skip === "na" ? (
                <p className="mt-2 text-xs italic text-gray-400 dark:text-gray-500">Not applicable for this item.</p>
              ) : (
                <div className="mt-2 space-y-2">
                  <PersonSelect
                    value={r.person}
                    onChange={(v) => update(i, { person: v })}
                    people={peopleNames}
                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-xs text-gray-900 dark:text-white focus:border-emerald-500 focus:outline-none"
                  />
                  <div className="flex items-center gap-1">
                    <input type="date" value={r.sent_date} onChange={(e) => update(i, { sent_date: e.target.value })} aria-label={`${r.stage} sent date`} className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-1.5 py-1 text-xs text-gray-900 dark:text-white focus:border-emerald-500 focus:outline-none" />
                    <button type="button" onClick={() => update(i, { sent_date: TODAY })} title="Sent today" className="flex-shrink-0 rounded-md bg-gray-100 dark:bg-gray-700 px-1.5 py-1 text-[10px] font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600">↑Today</button>
                  </div>
                  <div className="flex items-center gap-1">
                    <input type="date" value={r.received_back_date} onChange={(e) => update(i, { received_back_date: e.target.value })} aria-label={`${r.stage} received date`} className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-1.5 py-1 text-xs text-gray-900 dark:text-white focus:border-emerald-500 focus:outline-none" />
                    <button type="button" onClick={() => update(i, { received_back_date: TODAY })} title="Received today" className="flex-shrink-0 rounded-md bg-gray-100 dark:bg-gray-700 px-1.5 py-1 text-[10px] font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600">✓Today</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Final email(s) — when set, the item is Complete */}
      {isWsb ? (
        <>
          {editableEmailCard(finalEmail, setFinal, "Final email — to Islamic Sisters", "Hands the speech to the sisters' phase (steps 9–10 above).")}
          {editableEmailCard(finalEmail2, setFinal2, "Final email — sisters' final send", "When this date is set, the item is Complete.")}
        </>
      ) : (
        editableEmailCard(finalEmail, setFinal, "Final email", "When the date is set, the item is Complete — final email sent.")
      )}

      {/* Save bar */}
      <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
        {emptyActiveCount > 1 && (
          <button
            type="button"
            onClick={markEmptyMerged}
            className="mr-auto inline-flex items-center gap-1.5 rounded-lg border border-violet-300 dark:border-violet-800 px-3 py-2 text-sm font-medium text-violet-700 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20"
          >
            Mark {emptyActiveCount} empty stages as Merged
          </button>
        )}
        {dirty && <span className="text-xs text-amber-600 dark:text-amber-400">Unsaved changes</span>}
        <button
          type="button"
          onClick={() => save(false)}
          disabled={isPending || !dirty}
          className="btn-press inline-flex items-center gap-2 rounded-lg border border-emerald-600 px-5 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 disabled:opacity-50"
        >
          {isPending && !savingBack && (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          {isPending && !savingBack ? "Saving…" : "Save Pipeline"}
        </button>
        <button
          type="button"
          onClick={() => save(true)}
          disabled={isPending || !dirty}
          className="btn-press inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {isPending && savingBack ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          )}
          {isPending && savingBack ? "Saving…" : "Save & Back"}
        </button>
      </div>
    </div>
  );
}
