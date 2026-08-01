"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { usePermissions } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import {
  assignParaAction,
  finishParaAction,
  reopenParaAction,
  clearParaAction,
} from "@/app/actions/paraProgressActions";
import { getStagesForLanguage, TOTAL_PARAS, type ParaCell, type StageKey } from "@/lib/progress";
import type { QuranPerson } from "@/lib/paraProgressData";

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  const a = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const b = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.round((b - a) / 86400000));
}

function cellClasses(status: ParaCell["status"]): string {
  switch (status) {
    case "done":
      return "bg-emerald-500 text-white hover:bg-emerald-600";
    case "in_progress":
      return "bg-amber-400 text-white hover:bg-amber-500";
    default:
      return "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700";
  }
}

const emptyCell = (para: number): ParaCell => ({
  paraNumber: para,
  status: "not_started",
  personId: null,
  personName: null,
  startedAt: null,
  finishedAt: null,
  notes: null,
});

interface Props {
  languageId: string;
  languageName: string;
  board: Record<StageKey, ParaCell[]>;
  people: QuranPerson[];
}

/**
 * Per-language, per-stage 1..30 para board. Each cell records who's working a
 * para, since when, and when it finished — the progress bars on /progress are
 * derived live from these rows, never typed in by hand.
 */
export default function ParaBoard({ languageId, languageName, board, people }: Props) {
  const { canWrite } = usePermissions();
  const toast = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<{ stage: StageKey; para: number } | null>(null);
  const [personId, setPersonId] = useState("");
  const [dateValue, setDateValue] = useState(todayIso());

  const stages = getStagesForLanguage(languageName);
  const activePeople = people.filter((p) => p.active);

  const cellFor = (stage: StageKey, para: number): ParaCell => board[stage]?.[para - 1] ?? emptyCell(para);

  const select = (stage: StageKey, para: number) => {
    if (!canWrite) return;
    const cell = cellFor(stage, para);
    setSelected({ stage, para });
    setPersonId(cell.personId ?? "");
    setDateValue(todayIso());
  };

  const refresh = (message: string) => {
    toast({ type: "success", message });
    setSelected(null);
    router.refresh();
  };

  const run = (action: () => Promise<{ error?: string; success?: boolean }>, message: string) => {
    startTransition(async () => {
      const res = await action();
      if (res.error) toast({ type: "error", message: res.error });
      else refresh(message);
    });
  };

  const selectedCell = selected ? cellFor(selected.stage, selected.para) : null;

  return (
    <div className="space-y-6">
      {stages.map((meta) => {
        const cells = board[meta.key] ?? [];
        const done = cells.filter((c) => c.status === "done").length;
        return (
          <div key={meta.key} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} />
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">{meta.label}</h3>
              </div>
              <span className="tabular-nums text-sm font-semibold text-gray-600 dark:text-gray-300">
                {done}/{TOTAL_PARAS}
              </span>
            </div>

            <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-10">
              {cells.map((cell) => {
                const isSel = selected?.stage === meta.key && selected.para === cell.paraNumber;
                const title =
                  cell.status === "not_started"
                    ? `Para ${cell.paraNumber} — not started`
                    : `Para ${cell.paraNumber} — ${cell.personName ?? "unassigned"}${
                        cell.finishedAt ? `, done ${cell.finishedAt}` : cell.startedAt ? `, since ${cell.startedAt}` : ""
                      }`;
                return (
                  <button
                    key={cell.paraNumber}
                    type="button"
                    onClick={() => select(meta.key, cell.paraNumber)}
                    title={title}
                    className={`btn-press flex h-9 items-center justify-center rounded-md text-[11px] font-semibold ring-1 ring-inset ring-black/5 transition ${cellClasses(cell.status)} ${
                      isSel ? "ring-2 ring-offset-1 ring-emerald-600 dark:ring-offset-gray-800" : ""
                    } ${!canWrite ? "cursor-default" : ""}`}
                  >
                    {cell.paraNumber}
                  </button>
                );
              })}
            </div>

            {selected?.stage === meta.key && selectedCell && canWrite && (
              <div className="mt-4 rounded-lg border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/40 dark:bg-emerald-900/10 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {meta.label} — Para {selected.para}
                  </p>
                  <button type="button" onClick={() => setSelected(null)} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                    Close
                  </button>
                </div>

                {selectedCell.status !== "not_started" && (
                  <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
                    {selectedCell.personName ?? "Unassigned"}
                    {selectedCell.startedAt && ` · started ${selectedCell.startedAt}`}
                    {selectedCell.finishedAt && ` · finished ${selectedCell.finishedAt}`}
                    {!selectedCell.finishedAt &&
                      selectedCell.startedAt &&
                      (() => {
                        const d = daysSince(selectedCell.startedAt);
                        return d != null ? ` · ${d === 0 ? "started today" : `${d}d held`}` : "";
                      })()}
                  </p>
                )}

                <div className="flex flex-wrap items-end gap-3">
                  {selectedCell.status === "not_started" && (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Person</label>
                        <select
                          value={personId}
                          onChange={(e) => setPersonId(e.target.value)}
                          className="mt-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-sm text-gray-900 dark:text-white focus:border-emerald-500 focus:outline-none"
                        >
                          <option value="">Unassigned</option>
                          {activePeople.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Start date</label>
                        <input
                          type="date"
                          value={dateValue}
                          onChange={(e) => setDateValue(e.target.value)}
                          className="mt-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-sm text-gray-900 dark:text-white focus:border-emerald-500 focus:outline-none"
                        />
                      </div>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() =>
                          run(
                            () => assignParaAction(languageId, selected.stage, selected.para, personId || null, dateValue),
                            `Para ${selected.para} started.`
                          )
                        }
                        className="btn-press rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        Start
                      </button>
                    </>
                  )}

                  {selectedCell.status === "in_progress" && (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Finish date</label>
                        <input
                          type="date"
                          value={dateValue}
                          onChange={(e) => setDateValue(e.target.value)}
                          className="mt-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-sm text-gray-900 dark:text-white focus:border-emerald-500 focus:outline-none"
                        />
                      </div>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() =>
                          run(
                            () => finishParaAction(languageId, selected.stage, selected.para, dateValue),
                            `Para ${selected.para} marked finished.`
                          )
                        }
                        className="btn-press rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        Mark finished
                      </button>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => run(() => clearParaAction(languageId, selected.stage, selected.para), "Unassigned.")}
                        className="btn-press rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
                      >
                        Unassign
                      </button>
                    </>
                  )}

                  {selectedCell.status === "done" && (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => run(() => reopenParaAction(languageId, selected.stage, selected.para), "Reopened.")}
                      className="btn-press rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
                    >
                      Reopen
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
