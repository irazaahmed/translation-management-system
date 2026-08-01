import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";
import { supabase } from "@/lib/supabaseClient";
import { QURAN_CACHE_TAG, buildParaCells, getStagesForLanguage, type ParaCell, type ParaRow, type StageKey } from "@/lib/progress";

// ============================================
// Quran para-progress cached data layer (mirrors lib/etData.ts)
// ============================================

const QURAN_CACHE: { tags: string[]; revalidate: number } = { tags: [QURAN_CACHE_TAG], revalidate: 60 };

export interface QuranPerson {
  id: string;
  name: string;
  active: boolean;
  notes: string | null;
  created_at: string;
}

/** Every quran_people row. Tolerant of the table not existing yet. */
const loadQuranPeople = unstable_cache(
  async (): Promise<QuranPerson[]> => {
    const { data, error } = await supabase
      .from("quran_people")
      .select("id, name, active, notes, created_at")
      .order("name", { ascending: true });
    if (error) throw error;
    return (data || []) as QuranPerson[];
  },
  ["quran-people"],
  QURAN_CACHE
);

export const getCachedQuranPeople = cache(async (): Promise<QuranPerson[]> => {
  try {
    return await loadQuranPeople();
  } catch (err) {
    console.error("Failed to fetch quran_people (has the migration been run?):", err);
    return [];
  }
});

/** Raw row shape returned by the para_progress join, before mapping to ParaRow. */
export interface RawParaRow {
  language_id: string;
  stage: StageKey;
  para_number: number;
  person_id: string | null;
  started_at: string | null;
  finished_at: string | null;
  notes: string | null;
  quran_people: { name: string } | null;
}

const PARA_PROGRESS_SELECT =
  "language_id, stage, para_number, person_id, started_at, finished_at, notes, quran_people(name)";

/** Every para_progress row across all languages. Tolerant of the table not existing yet. */
const loadAllParaProgress = unstable_cache(
  async (): Promise<RawParaRow[]> => {
    const { data, error } = await supabase.from("para_progress").select(PARA_PROGRESS_SELECT);
    if (error) throw error;
    return (data || []) as unknown as RawParaRow[];
  },
  ["para-progress-all"],
  QURAN_CACHE
);

export const getCachedAllParaProgress = cache(async (): Promise<(RawParaRow & { languageId: string })[]> => {
  try {
    const rows = await loadAllParaProgress();
    return rows.map((r) => ({ ...r, languageId: r.language_id }));
  } catch (err) {
    console.error("Failed to fetch para_progress (has the migration been run?):", err);
    return [];
  }
});

export function toParaRow(r: RawParaRow): ParaRow {
  return {
    stage: r.stage,
    paraNumber: r.para_number,
    personId: r.person_id,
    personName: r.quran_people?.name ?? null,
    startedAt: r.started_at,
    finishedAt: r.finished_at,
    notes: r.notes,
  };
}

/** All para_progress rows for a single language, mapped to the pure ParaRow shape. */
export const getCachedParaRowsForLanguage = cache(async (languageId: string): Promise<ParaRow[]> => {
  const all = await getCachedAllParaProgress();
  return all.filter((r) => r.languageId === languageId).map(toParaRow);
});

/** The full per-stage 1..30 board for a single language. */
export const getCachedParaBoard = cache(
  async (languageId: string, stageKeys: StageKey[]): Promise<Record<StageKey, ParaCell[]>> => {
    const rows = await getCachedParaRowsForLanguage(languageId);
    const board = {} as Record<StageKey, ParaCell[]>;
    for (const key of stageKeys) board[key] = buildParaCells(rows, key);
    return board;
  }
);

/** A para_progress row joined with language/project context, for Reports. */
export interface ParaActivityRow extends ParaRow {
  languageId: string;
  language: string;
  country: string;
  projectName: string | null;
}

interface LanguageMeta {
  id: string;
  language: string;
  country: string;
  projects: { name: string } | null;
}

const loadLanguageMeta = unstable_cache(
  async (): Promise<LanguageMeta[]> => {
    const { data, error } = await supabase
      .from("languages")
      .select("id, language, country, projects:project_id ( name )");
    if (error) throw error;
    return (data || []) as unknown as LanguageMeta[];
  },
  ["quran-language-meta"],
  QURAN_CACHE
);

/** Every language with its applicable stage pipeline — for the Reports "by language" rollup. */
export const getCachedLanguagesMeta = cache(async (): Promise<
  { language: string; country: string; projectName: string | null; stageKeys: { key: StageKey; label: string }[] }[]
> => {
  try {
    const languages = await loadLanguageMeta();
    return languages.map((l) => ({
      language: l.language,
      country: l.country,
      projectName: l.projects?.name ?? null,
      stageKeys: getStagesForLanguage(l.language).map((s) => ({ key: s.key, label: s.label })),
    }));
  } catch (err) {
    console.error("Failed to fetch languages (has the migration been run?):", err);
    return [];
  }
});

/** Flat activity log across every language — one row per para_progress row. Feeds Reports. */
export const getCachedParaActivity = cache(async (): Promise<ParaActivityRow[]> => {
  try {
    const [rows, languages] = await Promise.all([loadAllParaProgress(), loadLanguageMeta()]);
    const metaById = new Map(languages.map((l) => [l.id, l]));
    return rows.map((r) => {
      const meta = metaById.get(r.language_id);
      return {
        ...toParaRow(r),
        languageId: r.language_id,
        language: meta?.language ?? "(deleted language)",
        country: meta?.country ?? "",
        projectName: meta?.projects?.name ?? null,
      };
    });
  } catch (err) {
    console.error("Failed to build para activity (has the migration been run?):", err);
    return [];
  }
});
