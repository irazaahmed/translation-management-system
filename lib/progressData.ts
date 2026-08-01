import "server-only";

import { cache } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  buildStageMapFromParaRows,
  computePipelinePercent,
  getStageKeysForLanguage,
  type LanguageProgress,
  type ParaRow,
  type ProjectProgress,
} from "@/lib/progress";
import { getCachedAllParaProgress, getCachedParaRowsForLanguage, toParaRow } from "@/lib/paraProgressData";

interface LanguageRow {
  id: string;
  language: string;
  country: string;
  responsible_person: string | null;
  project_id: string | null;
  projects: { id: string; name: string } | null;
}

function toLanguageProgress(row: LanguageRow, paraRows: ParaRow[]): LanguageProgress {
  const stageKeys = getStageKeysForLanguage(row.language);
  const stages = buildStageMapFromParaRows(paraRows, stageKeys);
  const lastKey = stageKeys[stageKeys.length - 1];
  return {
    languageId: row.id,
    language: row.language,
    country: row.country,
    responsiblePerson: row.responsible_person,
    projectId: row.project_id,
    projectName: row.projects?.name ?? null,
    stageKeys,
    stages,
    pipelinePercent: computePipelinePercent(stages, stageKeys),
    finishedParas: stages[lastKey].current_para,
  };
}

const LANGUAGE_SELECT = `
  id,
  language,
  country,
  responsible_person,
  project_id,
  projects:project_id ( id, name )
`;

/**
 * The full progress board: in-progress languages grouped by project.
 * Consistent with the rest of the app, only `in_progress` languages appear.
 * Progress is derived live from para_progress rows (see lib/paraProgressData.ts).
 * Fetches the languages list and the (already cross-request-cached) full
 * para_progress set in parallel, then groups in memory — one bulk read
 * regardless of how many languages are in progress, not one query each.
 */
export const getCachedProgressBoard = cache(async (): Promise<ProjectProgress[]> => {
  const [{ data, error }, allParaRows] = await Promise.all([
    supabase
      .from("languages")
      .select(LANGUAGE_SELECT)
      .eq("work_status", "in_progress")
      .order("language", { ascending: true }),
    getCachedAllParaProgress(),
  ]);

  if (error) throw error;

  const rowsByLanguage = new Map<string, ParaRow[]>();
  for (const r of allParaRows) {
    const arr = rowsByLanguage.get(r.languageId);
    if (arr) arr.push(toParaRow(r));
    else rowsByLanguage.set(r.languageId, [toParaRow(r)]);
  }

  const groups = new Map<string, ProjectProgress>();
  const UNASSIGNED = "__unassigned__";

  for (const row of (data ?? []) as unknown as LanguageRow[]) {
    const lang = toLanguageProgress(row, rowsByLanguage.get(row.id) ?? []);
    const key = lang.projectId ?? UNASSIGNED;
    if (!groups.has(key)) {
      groups.set(key, {
        projectId: key,
        projectName: lang.projectName ?? "Unassigned",
        languages: [],
      });
    }
    groups.get(key)!.languages.push(lang);
  }

  // Sort: named projects alphabetically, "Unassigned" last.
  return Array.from(groups.values()).sort((a, b) => {
    if (a.projectId === UNASSIGNED) return 1;
    if (b.projectId === UNASSIGNED) return -1;
    return a.projectName.localeCompare(b.projectName);
  });
});

/**
 * Single language's progress (for the edit page). Returns null if not found.
 * Uses the targeted per-language para read (not the bulk all-languages one) —
 * a single small indexed query instead of pulling every language's rows.
 */
export const getCachedLanguageProgress = cache(
  async (languageId: string): Promise<LanguageProgress | null> => {
    const [{ data, error }, paraRows] = await Promise.all([
      supabase.from("languages").select(LANGUAGE_SELECT).eq("id", languageId).maybeSingle(),
      getCachedParaRowsForLanguage(languageId),
    ]);

    if (error) throw error;
    if (!data) return null;
    return toLanguageProgress(data as unknown as LanguageRow, paraRows);
  }
);
