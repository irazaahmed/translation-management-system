"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { usePermissions } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { saveParaStageAction } from "@/app/actions/paraProgressActions";
import {
  getStagesForLanguage,
  TOTAL_PARAS,
  clampPara,
  type ParaCell,
  type StageKey,
  type StageMeta,
} from "@/lib/progress";
import type { ParaStageRowInput } from "@/lib/paraProgressMutations";

const TODAY = new Date().toISOString().slice(0, 10);

function doneCount(cells: ParaCell[]): number {
  return cells.filter((c) => c.finishedAt).length;
}

/**
 * Turn a target "N paras reached" count into the full 1..30 row payload the
 * backend expects: paras 1..N keep their existing dates if already finished
 * (or get today's date if newly marked), paras beyond N are cleared back to
 * "not started". No person is recorded — this stage just tracks a count.
 */
function buildRows(cells: ParaCell[], n: number): ParaStageRowInput[] {
  return cells.map((c) => {
    if (c.paraNumber > n) {
      return { paraNumber: c.paraNumber, personId: null, startedAt: null, finishedAt: null };
    }
    if (c.finishedAt) {
      return { paraNumber: c.paraNumber, personId: c.personId, startedAt: c.startedAt, finishedAt: c.finishedAt };
    }
    return { paraNumber: c.paraNumber, personId: c.personId, startedAt: c.startedAt || TODAY, finishedAt: TODAY };
  });
}

interface StageState {
  meta: StageMeta;
  cells: ParaCell[];
  value: number;
}

interface RowProps {
  state: StageState;
  dirty: boolean;
  isSaving: boolean;
  canWrite: boolean;
  onChange: (value: number) => void;
  onSave: () => void;
}

function StageRow({ state, dirty, isSaving, canWrite, onChange, onSave }: RowProps) {
  const { meta, value } = state;
  const pct = Math.round((value / TOTAL_PARAS) * 100);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${meta.dot}`} />
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">{meta.label}</h3>
        {dirty && (
          <span className="rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
            unsaved
          </span>
        )}
        <span className="ml-auto tabular-nums text-sm font-semibold text-gray-700 dark:text-gray-300">
          {value}/{TOTAL_PARAS}
        </span>
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
        <div className={`h-full rounded-full ${meta.bar} transition-all duration-300`} style={{ width: `${pct}%` }} />
      </div>

      {canWrite && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label htmlFor={`para_${meta.key}`} className="text-xs font-medium text-gray-600 dark:text-gray-400">
            Para reached (0–{TOTAL_PARAS})
          </label>
          <input
            type="number"
            id={`para_${meta.key}`}
            min={0}
            max={TOTAL_PARAS}
            value={value}
            onChange={(e) => onChange(clampPara(parseInt(e.target.value, 10)))}
            className="w-24 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm text-gray-900 dark:text-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
          <button
            type="button"
            onClick={onSave}
            disabled={!dirty || isSaving}
            className="btn-press ml-auto rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {isSaving ? "Saving…" : "Save"}
          </button>
        </div>
      )}
    </div>
  );
}

interface Props {
  languageId: string;
  languageName: string;
  board: Record<StageKey, ParaCell[]>;
}

/**
 * Per-language, per-stage editor: one number ("paras reached") per stage,
 * with a live progress bar — mirrors the original simple progress form.
 * Internally it still stores per-para rows (so reports/assistant stay
 * unaffected), but the editor no longer asks for a person or dates.
 */
export default function ParaStageEditor({ languageId, languageName, board }: Props) {
  const { canWrite } = usePermissions();
  const toast = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [savingStage, setSavingStage] = useState<StageKey | null>(null);

  const stages = getStagesForLanguage(languageName);

  const [stateByStage, setStateByStage] = useState<Record<StageKey, StageState>>(() => {
    const init = {} as Record<StageKey, StageState>;
    for (const meta of stages) {
      const cells = board[meta.key] ?? [];
      init[meta.key] = { meta, cells, value: doneCount(cells) };
    }
    return init;
  });
  const [dirtyStages, setDirtyStages] = useState<Set<StageKey>>(new Set());

  const setValue = (key: StageKey, value: number) => {
    setStateByStage((prev) => ({ ...prev, [key]: { ...prev[key], value } }));
    setDirtyStages((prev) => new Set(prev).add(key));
  };

  const save = (key: StageKey, label: string) => {
    setSavingStage(key);
    startTransition(async () => {
      const { cells, value } = stateByStage[key];
      const res = await saveParaStageAction(languageId, key, buildRows(cells, value));
      if (res.error) toast({ type: "error", message: res.error });
      else {
        toast({ type: "success", message: `${label} saved.` });
        setDirtyStages((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-3">
      {stages.map((meta) => (
        <StageRow
          key={meta.key}
          state={stateByStage[meta.key]}
          dirty={dirtyStages.has(meta.key)}
          isSaving={isPending && savingStage === meta.key}
          canWrite={canWrite}
          onChange={(value) => setValue(meta.key, value)}
          onSave={() => save(meta.key, meta.label)}
        />
      ))}
    </div>
  );
}
