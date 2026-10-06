// ============================================================
// Para / Stage progress — shared constants, types & helpers
// Safe to import from both server and client components (pure data).
// ============================================================

/**
 * Cache tag for the per-para progress data (quran_people + para_progress).
 * Every mutation calls `revalidateTag(QURAN_CACHE_TAG)` to drop the cache and
 * show fresh data at once — mirrors ET_CACHE_TAG in lib/et.ts.
 */
export const QURAN_CACHE_TAG = "quran-para-data";

/** The Quran has 30 paras (juz). */
export const TOTAL_PARAS = 30;

export type StageKey =
  | "translation"
  | "comparison"
  | "formation"
  | "convert_into_braille"
  | "tafteesh"
  | "designing"
  | "final_proof_reading";

export interface StageMeta {
  key: StageKey;
  /** Full display label. */
  label: string;
  /** Tailwind class for the solid progress-bar fill. */
  bar: string;
  /** Tailwind text colour for accents. */
  text: string;
  /** Tailwind soft background for chips/dots. */
  dot: string;
}

/** Visual metadata for every possible stage (default labels). */
const STAGE_REGISTRY: Record<StageKey, StageMeta> = {
  translation:          { key: "translation",          label: "Translation",          bar: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500" },
  comparison:           { key: "comparison",           label: "Comparison",           bar: "bg-sky-500",     text: "text-sky-600 dark:text-sky-400",         dot: "bg-sky-500" },
  formation:            { key: "formation",            label: "Formation",            bar: "bg-indigo-500",  text: "text-indigo-600 dark:text-indigo-400",   dot: "bg-indigo-500" },
  convert_into_braille: { key: "convert_into_braille", label: "Convert into Braille", bar: "bg-cyan-500",    text: "text-cyan-600 dark:text-cyan-400",        dot: "bg-cyan-500" },
  tafteesh:             { key: "tafteesh",             label: "Tafteesh",             bar: "bg-violet-500",  text: "text-violet-600 dark:text-violet-400",   dot: "bg-violet-500" },
  designing:            { key: "designing",            label: "Designing",            bar: "bg-amber-500",   text: "text-amber-600 dark:text-amber-400",     dot: "bg-amber-500" },
  final_proof_reading:  { key: "final_proof_reading",  label: "Final Proof Reading",  bar: "bg-rose-500",    text: "text-rose-600 dark:text-rose-400",       dot: "bg-rose-500" },
};

/** Every stage key that exists across all pipelines. */
export const ALL_STAGE_KEYS: StageKey[] = Object.keys(STAGE_REGISTRY) as StageKey[];

/**
 * Standard pipeline (all languages except Braille), in order.
 * Translation and Comparison are the "first-most" stages: Comparison can't be
 * ahead of Translation, and no other stage can be ahead of either of them.
 * The remaining stages have no fixed order and may move back and forth.
 */
export const DEFAULT_STAGE_KEYS: StageKey[] = [
  "translation",
  "comparison",
  "formation",
  "tafteesh",
  "designing",
  "final_proof_reading",
];

/**
 * Braille has its own pipeline — no Formation/Designing, but an extra
 * "Convert into Braille" step:
 *   Translation (for Braille) → Comparison → Convert into Braille
 *   → Tafteesh → Final Proof Reading
 */
export const BRAILLE_STAGE_KEYS: StageKey[] = [
  "translation",
  "comparison",
  "convert_into_braille",
  "tafteesh",
  "final_proof_reading",
];

/** A language is the special Braille case if its name mentions "braille". */
export function isBrailleLanguage(name: string | null | undefined): boolean {
  return /braille/i.test(name ?? "");
}

/** The ordered stage keys that apply to a given language. */
export function getStageKeysForLanguage(name: string | null | undefined): StageKey[] {
  return isBrailleLanguage(name) ? BRAILLE_STAGE_KEYS : DEFAULT_STAGE_KEYS;
}

/** The ordered stage metadata for a language (with Braille's label tweak). */
export function getStagesForLanguage(name: string | null | undefined): StageMeta[] {
  const braille = isBrailleLanguage(name);
  return getStageKeysForLanguage(name).map((key) => {
    const meta = STAGE_REGISTRY[key];
    if (braille && key === "translation") {
      return { ...meta, label: "Translation (for Braille)" };
    }
    return meta;
  });
}

export function getStageMeta(key: StageKey): StageMeta {
  return STAGE_REGISTRY[key];
}

/** A single (language, stage) progress row as stored in the DB. */
export interface StageProgressRow {
  stage: StageKey;
  current_para: number;
  since_date: string | null;
  notes: string | null;
  updated_at: string | null;
}

/** A language with its full stage progress, ready for the board/UI. */
export interface LanguageProgress {
  languageId: string;
  language: string;
  country: string;
  responsiblePerson: string | null;
  projectId: string | null;
  projectName: string | null;
  /** Ordered stage keys that apply to this language. */
  stageKeys: StageKey[];
  /** Contains every stage applicable to this language (missing → 0 paras). */
  stages: Record<StageKey, StageProgressRow>;
  /** Overall pipeline completion across this language's stages (0–100). */
  pipelinePercent: number;
  /** Paras that have cleared every stage (= the final stage's count). */
  finishedParas: number;
}

/** All progress for a single project, grouped for the board. */
export interface ProjectProgress {
  projectId: string;
  projectName: string;
  languages: LanguageProgress[];
}

function emptyStage(stage: StageKey): StageProgressRow {
  return { stage, current_para: 0, since_date: null, notes: null, updated_at: null };
}

/** Turn sparse DB rows into a complete map over `stageKeys` (missing → 0). */
export function buildStageMap(
  rows: StageProgressRow[] | null | undefined,
  stageKeys: StageKey[]
): Record<StageKey, StageProgressRow> {
  const map = {} as Record<StageKey, StageProgressRow>;
  for (const key of stageKeys) map[key] = emptyStage(key);
  for (const row of rows ?? []) {
    if (map[row.stage]) {
      map[row.stage] = {
        stage: row.stage,
        current_para: clampPara(row.current_para),
        since_date: row.since_date ?? null,
        notes: row.notes ?? null,
        updated_at: row.updated_at ?? null,
      };
    }
  }
  return map;
}

// ============================================================
// Per-para tracking (para_progress table) — who, since when, finished when.
// ============================================================

export type ParaStatus = "not_started" | "in_progress" | "done";

/** A single (language, stage, para) row as read from the DB/cache. */
export interface ParaRow {
  stage: StageKey;
  paraNumber: number;
  personId: string | null;
  personName: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  notes: string | null;
}

/** A single para's cell state for the per-language board — always present for 1..30. */
export interface ParaCell {
  paraNumber: number;
  status: ParaStatus;
  personId: string | null;
  personName: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  notes: string | null;
}

export function paraStatusOf(row: ParaRow | null | undefined): ParaStatus {
  if (!row) return "not_started";
  if (row.finishedAt) return "done";
  if (row.startedAt) return "in_progress";
  return "not_started";
}

/** Turn a stage's sparse para_progress rows into a full 1..30 grid (missing → not started). */
export function buildParaCells(rows: ParaRow[], stage: StageKey): ParaCell[] {
  const byNumber = new Map(rows.filter((r) => r.stage === stage).map((r) => [r.paraNumber, r]));
  const cells: ParaCell[] = [];
  for (let n = 1; n <= TOTAL_PARAS; n++) {
    const row = byNumber.get(n);
    cells.push({
      paraNumber: n,
      status: paraStatusOf(row),
      personId: row?.personId ?? null,
      personName: row?.personName ?? null,
      startedAt: row?.startedAt ?? null,
      finishedAt: row?.finishedAt ?? null,
      notes: row?.notes ?? null,
    });
  }
  return cells;
}

/**
 * Derive the same Record<StageKey, StageProgressRow> shape the old hand-typed
 * `stage_progress` table produced, but computed from real per-para rows:
 * current_para = count of finished paras; since_date = most recent activity
 * (last finish, or last start if nothing has finished yet). This keeps
 * StageProgressBars / CompletionRing / LanguageProgress consumers unchanged.
 */
export function buildStageMapFromParaRows(
  rows: ParaRow[],
  stageKeys: StageKey[]
): Record<StageKey, StageProgressRow> {
  const map = {} as Record<StageKey, StageProgressRow>;
  for (const key of stageKeys) {
    const stageRows = rows.filter((r) => r.stage === key);
    const finishedCount = stageRows.filter((r) => r.finishedAt).length;
    const dates = stageRows
      .map((r) => r.finishedAt ?? r.startedAt)
      .filter((d): d is string => !!d)
      .sort();
    map[key] = {
      stage: key,
      current_para: clampPara(finishedCount),
      since_date: dates.length ? dates[dates.length - 1] : null,
      notes: null,
      updated_at: null,
    };
  }
  return map;
}

/**
 * Turn a target "N paras reached" count into the full 1..30 row payload that
 * saveParaStage expects: paras 1..N keep their existing dates if already
 * finished (or get `today` if newly marked), paras beyond N are cleared back to
 * "not started". No person is recorded — this stage just tracks a count.
 * Shared by the progress editor and the /api/v1/quran API.
 */
export function buildParaCountRows(
  cells: ParaCell[],
  n: number,
  today: string
): { paraNumber: number; personId: string | null; startedAt: string | null; finishedAt: string | null }[] {
  return cells.map((c) => {
    if (c.paraNumber > n) {
      return { paraNumber: c.paraNumber, personId: null, startedAt: null, finishedAt: null };
    }
    if (c.finishedAt) {
      return { paraNumber: c.paraNumber, personId: c.personId, startedAt: c.startedAt, finishedAt: c.finishedAt };
    }
    return { paraNumber: c.paraNumber, personId: c.personId, startedAt: c.startedAt || today, finishedAt: today };
  });
}

/** Overall completion across the language's stages, 0–100. */
export function computePipelinePercent(
  stages: Record<StageKey, StageProgressRow>,
  stageKeys: StageKey[]
): number {
  if (stageKeys.length === 0) return 0;
  const total = stageKeys.reduce((sum, key) => sum + (stages[key]?.current_para ?? 0), 0);
  return Math.round((total / (stageKeys.length * TOTAL_PARAS)) * 100);
}

export function clampPara(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(TOTAL_PARAS, Math.round(n)));
}

export function stagePercent(currentPara: number): number {
  return Math.round((clampPara(currentPara) / TOTAL_PARAS) * 100);
}
