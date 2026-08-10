"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { usePermissions } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { saveParaStageAction } from "@/app/actions/paraProgressActions";
import { getStagesForLanguage, TOTAL_PARAS, type ParaCell, type StageKey, type StageMeta } from "@/lib/progress";
import type { QuranPerson } from "@/lib/paraProgressData";

const TODAY = new Date().toISOString().slice(0, 10);

interface EditableRow {
  paraNumber: number;
  personId: string;
  startedAt: string;
  finishedAt: string;
}

function toEditable(cells: ParaCell[]): EditableRow[] {
  return cells.map((c) => ({
    paraNumber: c.paraNumber,
    personId: c.personId ?? "",
    startedAt: c.startedAt ?? "",
    finishedAt: c.finishedAt ?? "",
  }));
}

const inputCls =
  "w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-1.5 py-1 text-xs text-gray-900 dark:text-white focus:border-emerald-500 focus:outline-none";
const todayBtnCls =
  "flex-shrink-0 rounded-md bg-gray-100 dark:bg-gray-700 px-1.5 py-1 text-[10px] font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600";

interface SectionProps {
  meta: StageMeta;
  rows: EditableRow[];
  dirty: boolean;
  isOpen: boolean;
  isSaving: boolean;
  canWrite: boolean;
  activePeople: QuranPerson[];
  onToggle: () => void;
  onUpdateRow: (idx: number, patch: Partial<EditableRow>) => void;
  onClearRow: (idx: number) => void;
  onMarkDoneUpTo: (n: number) => void;
  onSave: () => void;
}

function StageSection({
  meta,
  rows,
  dirty,
  isOpen,
  isSaving,
  canWrite,
  activePeople,
  onToggle,
  onUpdateRow,
  onClearRow,
  onMarkDoneUpTo,
  onSave,
}: SectionProps) {
  const [markN, setMarkN] = useState("");
  const done = rows.filter((r) => r.finishedAt).length;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
      <button type="button" onClick={onToggle} className="flex w-full flex-wrap items-center gap-2 p-4 text-left">
        <span className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${meta.dot}`} />
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">{meta.label}</h3>
        <span className="tabular-nums text-sm font-semibold text-gray-500 dark:text-gray-400">
          {done}/{TOTAL_PARAS}
        </span>
        {dirty && (
          <span className="rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
            unsaved
          </span>
        )}
        <svg
          className={`ml-auto h-4 w-4 flex-shrink-0 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="border-t border-gray-100 dark:border-gray-800 p-4">
          {canWrite && (
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="text-xs text-gray-500 dark:text-gray-400">Mark done up to para</span>
              <input
                type="number"
                min={1}
                max={TOTAL_PARAS}
                value={markN}
                onChange={(e) => setMarkN(e.target.value)}
                placeholder="e.g. 20"
                className="w-16 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1 text-xs text-gray-900 dark:text-white focus:border-emerald-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  const n = Math.max(1, Math.min(TOTAL_PARAS, parseInt(markN, 10) || 0));
                  if (n > 0) onMarkDoneUpTo(n);
                }}
                disabled={!markN}
                className="btn-press rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
              >
                Apply
              </button>
              <button
                type="button"
                onClick={onSave}
                disabled={!dirty || isSaving}
                className="btn-press ml-auto rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {isSaving ? "Saving…" : "Save changes"}
              </button>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 dark:text-gray-400">
                  <th className="w-10 py-1.5 pr-2">#</th>
                  <th className="py-1.5 pr-2">Person</th>
                  <th className="py-1.5 pr-2">Started</th>
                  <th className="py-1.5 pr-2">Finished</th>
                  {canWrite && <th className="w-6 py-1.5" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {rows.map((r, i) => (
                  <tr
                    key={r.paraNumber}
                    className={r.finishedAt ? "bg-emerald-50/40 dark:bg-emerald-900/10" : r.startedAt ? "bg-amber-50/40 dark:bg-amber-900/10" : ""}
                  >
                    <td className="py-1 pr-2 tabular-nums text-gray-500 dark:text-gray-400">{r.paraNumber}</td>
                    <td className="py-1 pr-2">
                      {canWrite ? (
                        <select value={r.personId} onChange={(e) => onUpdateRow(i, { personId: e.target.value })} className={inputCls}>
                          <option value="">Unassigned</option>
                          {activePeople.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-xs text-gray-700 dark:text-gray-300">
                          {activePeople.find((p) => p.id === r.personId)?.name ?? (r.personId ? "—" : "Unassigned")}
                        </span>
                      )}
                    </td>
                    <td className="py-1 pr-2">
                      {canWrite ? (
                        <div className="flex items-center gap-1">
                          <input type="date" value={r.startedAt} onChange={(e) => onUpdateRow(i, { startedAt: e.target.value })} className={inputCls} />
                          <button type="button" onClick={() => onUpdateRow(i, { startedAt: TODAY })} title="Today" className={todayBtnCls}>
                            Today
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-700 dark:text-gray-300">{r.startedAt || "—"}</span>
                      )}
                    </td>
                    <td className="py-1 pr-2">
                      {canWrite ? (
                        <div className="flex items-center gap-1">
                          <input type="date" value={r.finishedAt} onChange={(e) => onUpdateRow(i, { finishedAt: e.target.value })} className={inputCls} />
                          <button type="button" onClick={() => onUpdateRow(i, { finishedAt: TODAY })} title="Today" className={todayBtnCls}>
                            Today
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-700 dark:text-gray-300">{r.finishedAt || "—"}</span>
                      )}
                    </td>
                    {canWrite && (
                      <td className="py-1 text-center">
                        {(r.personId || r.startedAt || r.finishedAt) && (
                          <button
                            type="button"
                            onClick={() => onClearRow(i)}
                            title="Clear (back to not started)"
                            className="text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                          >
                            ✕
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

interface Props {
  languageId: string;
  languageName: string;
  board: Record<StageKey, ParaCell[]>;
  people: QuranPerson[];
}

/**
 * Per-language, per-stage editor: a directly-editable table (person, start
 * date, finish date) for all 30 paras, with a single batch "Save changes"
 * per stage — mirrors the English module's pipeline editor instead of the
 * old click-a-cell-then-find-the-popover flow.
 */
export default function ParaStageEditor({ languageId, languageName, board, people }: Props) {
  const { canWrite } = usePermissions();
  const toast = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [savingStage, setSavingStage] = useState<StageKey | null>(null);

  const stages = getStagesForLanguage(languageName);
  const activePeople = people.filter((p) => p.active);

  const [rowsByStage, setRowsByStage] = useState<Record<StageKey, EditableRow[]>>(() => {
    const init = {} as Record<StageKey, EditableRow[]>;
    for (const s of stages) init[s.key] = toEditable(board[s.key] ?? []);
    return init;
  });
  const [dirtyStages, setDirtyStages] = useState<Set<StageKey>>(new Set());

  // Open the first not-fully-done stage by default; the rest start collapsed.
  const defaultOpen = stages.find((s) => (rowsByStage[s.key] ?? []).some((r) => !r.finishedAt))?.key ?? stages[0]?.key;
  const [openStages, setOpenStages] = useState<Set<StageKey>>(() => new Set(defaultOpen ? [defaultOpen] : []));

  const toggleOpen = (key: StageKey) =>
    setOpenStages((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const markDirty = (key: StageKey) => setDirtyStages((prev) => new Set(prev).add(key));

  const updateRow = (stage: StageKey, idx: number, patch: Partial<EditableRow>) => {
    setRowsByStage((prev) => ({
      ...prev,
      [stage]: prev[stage].map((r, i) => (i === idx ? { ...r, ...patch } : r)),
    }));
    markDirty(stage);
  };

  const clearRow = (stage: StageKey, idx: number) => updateRow(stage, idx, { personId: "", startedAt: "", finishedAt: "" });

  const markDoneUpTo = (stage: StageKey, n: number) => {
    setRowsByStage((prev) => ({
      ...prev,
      [stage]: prev[stage].map((r) => (r.paraNumber <= n && !r.finishedAt ? { ...r, startedAt: r.startedAt || TODAY, finishedAt: TODAY } : r)),
    }));
    markDirty(stage);
  };

  const save = (stage: StageKey, label: string) => {
    setSavingStage(stage);
    startTransition(async () => {
      const res = await saveParaStageAction(
        languageId,
        stage,
        rowsByStage[stage].map((r) => ({
          paraNumber: r.paraNumber,
          personId: r.personId || null,
          startedAt: r.startedAt || null,
          finishedAt: r.finishedAt || null,
        }))
      );
      if (res.error) toast({ type: "error", message: res.error });
      else {
        toast({ type: "success", message: `${label} saved.` });
        setDirtyStages((prev) => {
          const next = new Set(prev);
          next.delete(stage);
          return next;
        });
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-3">
      {stages.map((meta) => (
        <StageSection
          key={meta.key}
          meta={meta}
          rows={rowsByStage[meta.key] ?? []}
          dirty={dirtyStages.has(meta.key)}
          isOpen={openStages.has(meta.key)}
          isSaving={isPending && savingStage === meta.key}
          canWrite={canWrite}
          activePeople={activePeople}
          onToggle={() => toggleOpen(meta.key)}
          onUpdateRow={(idx, patch) => updateRow(meta.key, idx, patch)}
          onClearRow={(idx) => clearRow(meta.key, idx)}
          onMarkDoneUpTo={(n) => markDoneUpTo(meta.key, n)}
          onSave={() => save(meta.key, meta.label)}
        />
      ))}
    </div>
  );
}
