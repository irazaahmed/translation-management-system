"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { usePermissions } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { patchEtStagesAction } from "@/app/actions/etActions";
import type { ItemAdvance } from "@/lib/et";
import type { StagePatch } from "@/lib/etMutations";

const TODAY = new Date().toISOString().slice(0, 10);

interface Props {
  itemId: string;
  advance: ItemAdvance;
  peopleNames: string[];
  /** Compact mode for list rows (no header line, just the action). */
  compact?: boolean;
}

export default function EtQuickAdvance({ itemId, advance, peopleNames, compact = false }: Props) {
  const { canWrite } = usePermissions();
  const toast = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const [returnedDate, setReturnedDate] = useState(TODAY);
  const [nextPerson, setNextPerson] = useState("");
  const [nextSent, setNextSent] = useState(TODAY);
  const [startPerson, setStartPerson] = useState(advance.holder ?? "");
  const [startSent, setStartSent] = useState(TODAY);

  if (!canWrite) return null;

  const inputCls =
    "w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-sm text-gray-900 dark:text-white focus:border-emerald-500 focus:outline-none";

  const run = (patches: StagePatch[], successMsg: string) => {
    startTransition(async () => {
      const res = await patchEtStagesAction(itemId, patches);
      if (res.error) toast({ type: "error", message: res.error });
      else {
        toast({ type: "success", message: successMsg });
        setOpen(false);
        router.refresh();
      }
    });
  };

  const advanceNow = () => {
    const patches: StagePatch[] = [{ stage: advance.stage, received_back_date: returnedDate }];
    if (advance.nextStage) {
      patches.push({ stage: advance.nextStage, person: nextPerson || null, sent_date: nextSent || null });
    }
    run(patches, advance.nextStage ? `Moved to ${advance.nextStage}.` : `${advance.stage} marked done.`);
  };

  const startNow = () => {
    run([{ stage: advance.stage, person: startPerson || null, sent_date: startSent || null }], `${advance.stage} started.`);
  };

  return (
    <div className={compact ? "" : "mt-3 rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/40 dark:bg-emerald-900/10 p-3"}>
      <div className="flex items-center justify-between gap-2">
        {!compact && (
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {advance.inProgress ? (
              <>
                With <span className="font-semibold text-gray-900 dark:text-white">{advance.holder || "—"}</span> at{" "}
                <span className="font-semibold text-gray-900 dark:text-white">{advance.stageName}</span>
                {advance.days != null && (
                  <span className="text-gray-500 dark:text-gray-400"> · {advance.days} day{advance.days === 1 ? "" : "s"} here</span>
                )}
              </>
            ) : (
              <>
                <span className="font-semibold text-gray-900 dark:text-white">{advance.stageName}</span> not started yet
              </>
            )}
          </p>
        )}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={`btn-press flex-shrink-0 rounded-lg font-medium ${compact ? "border border-emerald-300 dark:border-emerald-700 px-2.5 py-1 text-xs text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20" : "bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-700"}`}
        >
          {open ? "Cancel" : advance.inProgress ? (advance.nextStage ? `Move → ${advance.nextStage}` : "Mark done") : `Start ${advance.stage}`}
        </button>
      </div>

      {open && (
        <div className="mt-3 border-t border-emerald-200/70 dark:border-emerald-800/40 pt-3">
          <datalist id="qa-people">
            {peopleNames.map((n) => <option key={n} value={n} />)}
          </datalist>

          {advance.inProgress ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">
                  {advance.stage} returned on
                </label>
                <input type="date" value={returnedDate} onChange={(e) => setReturnedDate(e.target.value)} className={`mt-1 ${inputCls}`} />
              </div>
              {advance.nextStage ? (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Give {advance.nextStage} to</label>
                    <input type="text" list="qa-people" value={nextPerson} onChange={(e) => setNextPerson(e.target.value)} placeholder="Person…" className={`mt-1 ${inputCls}`} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Sent on</label>
                    <input type="date" value={nextSent} onChange={(e) => setNextSent(e.target.value)} className={`mt-1 ${inputCls}`} />
                  </div>
                </div>
              ) : (
                <p className="self-end text-xs text-gray-500 dark:text-gray-400">This is the last stage — marking it returned completes the item.</p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Give {advance.stage} to</label>
                <input type="text" list="qa-people" value={startPerson} onChange={(e) => setStartPerson(e.target.value)} placeholder="Person…" className={`mt-1 ${inputCls}`} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Sent on</label>
                <input type="date" value={startSent} onChange={(e) => setStartSent(e.target.value)} className={`mt-1 ${inputCls}`} />
              </div>
            </div>
          )}

          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={advance.inProgress ? advanceNow : startNow}
              disabled={isPending}
              className="btn-press inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {isPending && (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {isPending ? "Saving…" : advance.inProgress ? (advance.nextStage ? `Save & move to ${advance.nextStage}` : `Mark ${advance.stage} done`) : `Start ${advance.stage}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
