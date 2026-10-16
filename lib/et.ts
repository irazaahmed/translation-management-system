// ============================================
// English Translation (ET) module — shared types & pipeline helpers
// ============================================
// A work item flows through an 8-stage pipeline. The "current step / holder"
// is COMPUTED from the stage rows (never stored by hand).

/**
 * Cache tag for all ET data (items, stages, people, returns, assignments). The
 * data layer tags its `unstable_cache` reads with this so repeated navigation
 * serves from cache instead of re-querying Supabase; every mutation helper calls
 * `revalidateTag(ET_CACHE_TAG)` to drop the cache and show fresh data at once.
 */
export const ET_CACHE_TAG = "et-data";

export type StageCode =
  | "TR" | "IF" | "CM" | "ED" | "NR" | "ST" | "FF" | "FPR"
  // Every type except Books: one Formation step (after CM) replaces IF + FF.
  | "FO"
  // Weekly Speech Brothers (wsb) only — an extra "Islamic Sisters" phase that
  // runs after the first final email, before a second (final) email.
  | "PIS" | "FFM"
  // Magazine (mgz) only — a Designing step that sits between FF and FPR.
  | "DSN"
  // Books (bks) only — a final "Ready to Print" step after Final Proofreading.
  | "RTP";

export type ItemBoard = "main_2026" | "kanzul_madaris" | "magazine";
/**
 * "link_missing": the final email is sent, but the delivered work's link (online
 * / SharePoint) or a remark hasn't been recorded yet. The item has left its
 * working section and waits in "Link / Remarks"; adding either completes it.
 */
export type ItemStatus = "pending_assignment" | "in_progress" | "completed" | "link_missing";

/** True for an item still being worked on — not completed and not waiting for its link/remark. */
export function isInProcessStatus(status: ItemStatus): boolean {
  return status !== "completed" && status !== "link_missing";
}
export type ItemPriority = "low" | "normal" | "urgent";

/**
 * The original 8-stage pipeline, in order, with their full names. Books still
 * use it (with RTP); for every other type it is the LEGACY pipeline, kept only
 * for items that already have IF / FF rows (completed, stopped, or past both
 * formations when Formation was introduced). New items use FO_STAGES.
 */
export const STAGES: { code: StageCode; seq: number; name: string }[] = [
  { code: "TR", seq: 1, name: "Translation" },
  { code: "IF", seq: 2, name: "Initial Formation" },
  { code: "CM", seq: 3, name: "Comparison" },
  { code: "ED", seq: 4, name: "Editing" },
  { code: "NR", seq: 5, name: "Native Review" },
  { code: "ST", seq: 6, name: "S.Tafteesh" },
  { code: "FF", seq: 7, name: "Final Formatting" },
  { code: "FPR", seq: 8, name: "Final Proofreading" },
];

/**
 * Extra stages that only apply to Weekly Speech Brothers (wsb). After the
 * standard 8 stages + first final email (handed to the Islamic Sisters), the
 * speech is prepared for the sisters and given a final formation, then a second
 * final email completes it.
 */
export const WSB_EXTRA_STAGES: { code: StageCode; seq: number; name: string }[] = [
  { code: "PIS", seq: 9, name: "Prepared for Islamic Sister" },
  { code: "FFM", seq: 10, name: "Final Formation" },
];

/**
 * Magazine (mgz) pipeline. A magazine article has a "Designing" step that sits
 * BETWEEN Final Formatting (FF) and Final Proofreading (FPR). To keep that order
 * with integer sequence numbers, FPR is renumbered to 9 for magazine items:
 * TR..FF = 1-7, DSN = 8, FPR = 9.
 */
export const MGZ_STAGES: { code: StageCode; seq: number; name: string }[] = (() => {
  const out: { code: StageCode; seq: number; name: string }[] = [];
  let seq = 1;
  for (const s of STAGES) {
    out.push({ code: s.code, seq: seq++, name: s.name });
    if (s.code === "FF") out.push({ code: "DSN", seq: seq++, name: "Designing" });
  }
  return out;
})();

/**
 * Books (bks) pipeline. A book gets one extra step at the very end: after Final
 * Proofreading (FPR) it is "Ready to Print" (RTP, seq 9). Every other type keeps
 * the standard 8-stage pipeline.
 */
export const BKS_STAGES: { code: StageCode; seq: number; name: string }[] = [
  ...STAGES,
  { code: "RTP", seq: 9, name: "Ready to Print" },
];

const ALL_STAGES = [...STAGES, ...WSB_EXTRA_STAGES];

/**
 * The Formation pipeline — every type except Books. Initial Formation (IF) and
 * Final Formatting (FF) are replaced by a single Formation (FO) step right
 * after Comparison: TR, CM, FO, ED, NR, ST, FPR.
 */
export const FO_STAGES: { code: StageCode; seq: number; name: string }[] = [
  { code: "TR", seq: 1, name: "Translation" },
  { code: "CM", seq: 2, name: "Comparison" },
  { code: "FO", seq: 3, name: "Formation" },
  { code: "ED", seq: 4, name: "Editing" },
  { code: "NR", seq: 5, name: "Native Review" },
  { code: "ST", seq: 6, name: "S.Tafteesh" },
  { code: "FPR", seq: 7, name: "Final Proofreading" },
];

/** wsb on the Formation pipeline: the sisters phase follows FPR (PIS 8, FFM 9). */
const FO_WSB_STAGES: { code: StageCode; seq: number; name: string }[] = [
  ...FO_STAGES,
  { code: "PIS", seq: 8, name: "Prepared for Islamic Sister" },
  { code: "FFM", seq: 9, name: "Final Formation" },
];

/** Magazine on the Formation pipeline: Designing sits between ST and FPR (DSN 7, FPR 8). */
const FO_MGZ_STAGES: { code: StageCode; seq: number; name: string }[] = [
  ...FO_STAGES.slice(0, 6),
  { code: "DSN", seq: 7, name: "Designing" },
  { code: "FPR", seq: 8, name: "Final Proofreading" },
];

/** Every base stage code across both pipelines, in display order (for filters / skills). */
export const FILTER_STAGES: { code: StageCode; name: string }[] = [
  { code: "TR", name: "Translation" },
  { code: "IF", name: "Initial Formation" },
  { code: "CM", name: "Comparison" },
  { code: "FO", name: "Formation" },
  { code: "ED", name: "Editing" },
  { code: "NR", name: "Native Review" },
  { code: "ST", name: "S.Tafteesh" },
  { code: "FF", name: "Final Formatting" },
  { code: "FPR", name: "Final Proofreading" },
];

// Every distinct stage code (base + sisters phase + magazine designing + books
// ready-to-print) for name/seq lookup. The seq here is a fallback only — actual
// ordering uses the per-row seq, which is type-aware (see stageSeq / stagesForType).
const STAGE_DEFS = [
  ...ALL_STAGES,
  { code: "FO" as StageCode, seq: 3, name: "Formation" },
  { code: "DSN" as StageCode, seq: 8, name: "Designing" },
  { code: "RTP" as StageCode, seq: 9, name: "Ready to Print" },
];

export const STAGE_BY_CODE: Record<StageCode, { seq: number; name: string }> =
  Object.fromEntries(STAGE_DEFS.map((s) => [s.code, { seq: s.seq, name: s.name }])) as Record<
    StageCode,
    { seq: number; name: string }
  >;

export function stageName(code: StageCode): string {
  return STAGE_BY_CODE[code]?.name ?? code;
}

/** True for Weekly Speech Brothers items, which have the extra sisters phase. */
export function isWsbType(type: string | null | undefined): boolean {
  return (type || "").toLowerCase() === "wsb";
}

/**
 * Weekly Speech Brothers (wsb) documents always reuse a few sections that are
 * ALREADY translated every week, so those words must not be counted again as new
 * work. We keep the raw word_count exactly as entered (the real total is never
 * lost) and derive a NET, countable figure by subtracting these fixed sections.
 * Net words are what every count / report / sort / export uses.
 */
export const WSB_PRETRANSLATED: { name: string; words: number }[] = [
  { name: "Niyyat aitikaf", words: 153 },
  { name: "6 Durood Sherif", words: 472 },
  { name: "Jaiza Naik amaal", words: 1435 },
  { name: "Bayan niyyatein", words: 96 },
];

/** Fixed words removed from every wsb item: 153 + 472 + 1435 + 96 = 2156. */
export const WSB_PRETRANSLATED_TOTAL = WSB_PRETRANSLATED.reduce((s, p) => s + p.words, 0);

/**
 * The countable ("net") word figure for an item. For wsb the fixed
 * pre-translated sections are removed — e.g. a raw 6,816 becomes 4,660. Every
 * other type counts its words as-is. The DB value is never changed; this is only
 * the figure to count/show. Never returns a negative number.
 */
export function effectiveWordCount(
  type: string | null | undefined,
  wordCount: number | null | undefined
): number | null {
  if (wordCount == null) return null;
  if (isWsbType(type)) return Math.max(0, wordCount - WSB_PRETRANSLATED_TOTAL);
  return wordCount;
}

/** How many words were deducted as pre-translated for this item (0 for non-wsb). */
export function wsbDeduction(
  type: string | null | undefined,
  wordCount: number | null | undefined
): number {
  if (!isWsbType(type) || wordCount == null) return 0;
  return Math.min(wordCount, WSB_PRETRANSLATED_TOTAL);
}

/** True for Magazine items, which have the extra Designing step (DSN). */
export function isMagazineDesignType(type: string | null | undefined): boolean {
  return (type || "").toLowerCase() === "mgz";
}

/** True for Books items, which have the extra "Ready to Print" step (RTP). */
export function isBooksType(type: string | null | undefined): boolean {
  return (type || "").toLowerCase() === "bks";
}

/**
 * True when an item runs on the original IF/FF pipeline: always for Books, and
 * for any other type only when the item already has IF / FF rows (it predates
 * Formation and was not converted). Without stage rows (a new item) every
 * non-book type uses the Formation (FO) pipeline.
 */
export function usesLegacyFormation(
  type: string | null | undefined,
  stages?: Pick<EtStage, "stage">[] | null
): boolean {
  if (isBooksType(type)) return true;
  return !!stages?.some((s) => s.stage === "IF" || s.stage === "FF");
}

/**
 * The pipeline stages for an item. Books: the original 8 + "Ready to Print".
 * Every other type: the Formation pipeline (TR, CM, FO, ED, NR, ST, FPR) — wsb
 * adds the sisters stages, magazine adds Designing before FPR. Pass the item's
 * stage rows so items still on the legacy IF/FF pipeline keep it.
 */
export function stagesForType(
  type: string | null | undefined,
  stages?: Pick<EtStage, "stage">[] | null
): { code: StageCode; seq: number; name: string }[] {
  if (isBooksType(type)) return BKS_STAGES;
  const legacy = usesLegacyFormation(type, stages);
  if (isWsbType(type)) return legacy ? ALL_STAGES : FO_WSB_STAGES;
  if (isMagazineDesignType(type)) return legacy ? MGZ_STAGES : FO_MGZ_STAGES;
  return legacy ? STAGES : FO_STAGES;
}

/**
 * The sequence number for a stage code within an item's pipeline (type-aware,
 * and legacy-aware when the item's stage rows are passed).
 */
export function stageSeq(
  type: string | null | undefined,
  code: StageCode,
  stages?: Pick<EtStage, "stage">[] | null
): number {
  const found = stagesForType(type, stages).find((s) => s.code === code);
  return found?.seq ?? STAGE_BY_CODE[code]?.seq ?? 0;
}

/** Human-readable label for a content type code (drives the form dropdown order). */
export const TYPE_LABELS: Record<string, string> = {
  bks: "Books",
  wsb: "Weekly Speech Brothers",
  fsp: "Friday Speech",
  wbl: "Weekly Booklet",
  dwk: "Other Departmental Work",
  mgz: "Magazine",
  aer: "Ala Hazrat English Rasail",
  rpr: "Reprint",
};

export function typeLabel(type: string | null | undefined): string {
  if (!type) return "—";
  return TYPE_LABELS[type.toLowerCase()] ?? type;
}

/** Short code for a content type (e.g. "WSB") — for tight spots like mobile cards where the full label crowds out the item name. */
export function typeShortLabel(type: string | null | undefined): string {
  if (!type) return "—";
  return type.toUpperCase();
}

/** Weekly documents that must be delivered every week (handled like the Excel REMINDER sheet). */
export const WEEKLY_TYPES = ["wsb", "fsp", "wbl"] as const;
export function isWeeklyType(type: string | null | undefined): boolean {
  return !!type && (WEEKLY_TYPES as readonly string[]).includes(type.toLowerCase());
}
export function isMagazineType(type: string | null | undefined): boolean {
  return (type || "").toLowerCase() === "mgz";
}
/**
 * Quran-e-Pak items are handled in the Quranic Translation module, not here, so
 * the English Translation module ignores/hides them entirely.
 */
export function isQuranType(type: string | null | undefined): boolean {
  return (type || "").toLowerCase() === "quran";
}

/** High-level category used to group/filter the Work Items list. */
export type ItemCategory = "weekly" | "magazine" | "books" | "other";

export const CATEGORY_LABELS: Record<ItemCategory, string> = {
  weekly: "Weekly Docs",
  magazine: "Magazine",
  books: "Books",
  other: "Other Works",
};

/** Order categories appear as tabs. */
export const CATEGORY_ORDER: ItemCategory[] = ["weekly", "magazine", "books", "other"];

export function itemCategory(type: string | null | undefined): ItemCategory {
  const t = (type || "").toLowerCase();
  if (isWeeklyType(t)) return "weekly";
  if (t === "mgz") return "magazine";
  if (t === "bks") return "books";
  return "other";
}

export const BOARD_LABELS: Record<ItemBoard, string> = {
  main_2026: "Main (2026)",
  kanzul_madaris: "Kanzul Madaris",
  magazine: "Magazine",
};

// ============================================
// Row types (mirror the DB tables)
// ============================================

export interface EtStage {
  id: string;
  item_id: string;
  stage: StageCode;
  seq: number;
  person: string | null;
  sent_date: string | null;
  received_back_date: string | null;
  not_applicable: boolean;
  /** Stage skipped because the parts were merged into another file. */
  merged: boolean;
  /**
   * ED only: Editing is done together with Translation (AI translation), so it
   * is not a separate step. Skipped like N/A; the TR step covers both.
   */
  with_tr: boolean;
  created_at?: string;
  updated_at?: string;
}

/** A stage that does not count toward the pipeline (skipped as N/A, Merged, or ED done with TR). */
export function isStageSkipped(s: Pick<EtStage, "not_applicable" | "merged"> & { with_tr?: boolean }): boolean {
  return s.not_applicable || s.merged || !!s.with_tr;
}

/**
 * Translation & Editing combined (AI translation): the ED row is flagged
 * with_tr, so TR covers both steps. Manual translation keeps ED as its own step.
 */
export function isTrEdCombined(stages: Pick<EtStage, "stage" | "with_tr">[]): boolean {
  return stages.some((s) => s.stage === "ED" && !!s.with_tr);
}

/** Display name for a stage, aware of TR+ED being combined ("Translation & Editing"). */
export function itemStageName(code: StageCode, trEdCombined: boolean): string {
  return code === "TR" && trEdCombined ? "Translation & Editing" : stageName(code);
}

/**
 * Every stage a person is *actively* holding right now — sent out but not yet
 * received back (and not skipped). Unlike computeCurrentStep, which collapses to
 * a single "current" step, this returns ALL concurrent tasks, so a person given
 * two stages of one item (e.g. TR and CM) shows up for both. Pipeline order.
 */
export function activeStages(stages: EtStage[]): EtStage[] {
  return [...stages]
    .filter((s) => !isStageSkipped(s) && !!s.sent_date && !s.received_back_date)
    .sort((a, b) => a.seq - b.seq);
}

/**
 * Short label for a card's stage chip. When an item is at two+ stages at once
 * it shows just the codes (e.g. "TR, CM"); a single stage shows "TR · Name";
 * otherwise the current-step label ("Awaiting final email", "Completed", …).
 */
export function stageChipLabel(
  activeCodes: StageCode[],
  stage: StageCode | null,
  label: string
): string {
  if (activeCodes.length >= 2) return activeCodes.join(", ");
  return stage ? `${stage} · ${label}` : label;
}

export interface EtItem {
  id: string;
  title: string;
  type: string | null;
  board: ItemBoard;
  received_date: string | null;
  word_count: number | null;
  delivery_date: string | null;
  /** When set, the final email was sent and the item is complete. */
  final_email_date: string | null;
  /**
   * Second final email — wsb only. After the sisters phase (PIS, FFM), this
   * marks the item truly complete. Null/ignored for every other type.
   */
  final_email_date_2: string | null;
  /** Manually stopped / skipped projects (e.g. cancelled FOA work) — kept for the record. */
  stopped: boolean;
  priority: ItemPriority | null;
  status: ItemStatus;
  further_process: string | null;
  /** Optional — who sent this work in, for tracing where it came from. */
  sender_name: string | null;
  sender_email: string | null;
  /**
   * After the final email, a link (online / SharePoint) or a remark must be
   * recorded before the item counts as completed. False for items that were
   * already completed when this was introduced.
   */
  link_required: boolean;
  /** Where the delivered work lives — online link or SharePoint (database) link. */
  delivery_link: string | null;
  /** Remarks about the delivered work (instead of, or as well as, a link). */
  delivery_remarks: string | null;
  /** When the link / remark was recorded (the item was completed). */
  closeout_date: string | null;
  created_at: string;
  updated_at: string;
}

/** What computeCurrentStep needs to know about the link/remark close-out. */
export interface Closeout {
  /** A link or remark is required after the final email. */
  required: boolean;
  /** A link or remark has been recorded. */
  done: boolean;
}

export function closeoutOf(
  item: Pick<EtItem, "link_required" | "delivery_link" | "delivery_remarks">
): Closeout {
  return {
    required: !!item.link_required,
    done: !!(item.delivery_link?.trim() || item.delivery_remarks?.trim()),
  };
}

export interface EtItemWithStages extends EtItem {
  stages: EtStage[];
}

/**
 * An optional "go back and fix a missed part" step. Sometimes an item moves on
 * a few stages and only then someone notices a missing/incorrect part, so it is
 * handed back to be completed. We log it like a normal hand-off: a note of what
 * was missing, who it went to, when it was given, and when it came back.
 */
export interface EtReturn {
  id: string;
  item_id: string;
  /** Pipeline stage it was sent back to (optional). */
  stage: StageCode | null;
  /** What was missing / needs completing. */
  note: string | null;
  person: string | null;
  /** When it was handed back (kab dia). */
  sent_date: string | null;
  /** When it came back completed (kab aya). */
  received_back_date: string | null;
  created_at?: string;
}

export interface EtPerson {
  id: string;
  name: string;
  skills: string | null;
  email: string | null;
  working_hours: string | null;
  dpr_link: string | null;
  notes: string | null;
  active: boolean;
  created_at: string;
}

/**
 * A planned work assignment: a workforce member lined up to do a specific item
 * (book/work), with an optional note, an ordering position and a done flag.
 * Used by the Workforce managing board. Carries the item's title/type (joined)
 * for display.
 */
export interface EtAssignment {
  id: string;
  person_id: string;
  item_id: string;
  note: string | null;
  position: number;
  done: boolean;
  item_title: string;
  item_type: string | null;
}

// ============================================
// Pipeline computation
// ============================================

export interface CurrentStep {
  /** The stage code currently in progress, or null when completed/empty. */
  stage: StageCode | null;
  /** Full name of the current stage (e.g. "Editing"), or a status word. */
  label: string;
  /** Person currently holding the item, or null. */
  holder: string | null;
  /** ISO date the item has been at this step (sent date, or prior received). */
  since: string | null;
  /** True when every applicable stage has been received back. */
  completed: boolean;
  /** No stage has a person assigned yet. */
  unassigned: boolean;
  /** wsb only: every stage is done but the final (sisters) email isn't sent yet. */
  awaitingFinalEmail: boolean;
  /** Final email sent, but the link / remark isn't recorded yet (see ItemStatus "link_missing"). */
  linkMissing: boolean;
  /** Count of applicable stages that are received back. */
  doneCount: number;
  /** Count of applicable stages. */
  totalCount: number;
}

/**
 * Derive the current step / holder from an item's stage rows.
 * The current step is the stage that is actively in progress — i.e. it has a
 * start date (sent_date) but no end date (received_back_date) yet. If no stage
 * is in progress, the item is either Completed (the last applicable stage has
 * its end date) or Pending Assignment (waiting for the next step to be given
 * out — a step never counts as started until it has a start date).
 */
export function computeCurrentStep(
  stages: EtStage[],
  finalEmailDate?: string | null,
  finalEmailDate2?: string | null,
  closeout?: Closeout | null
): CurrentStep {
  const applicable = [...stages]
    .filter((s) => !isStageSkipped(s))
    .sort((a, b) => a.seq - b.seq);

  const totalCount = applicable.length;
  const doneCount = applicable.filter((s) => !!s.received_back_date).length;

  // wsb items carry the extra sisters stages (PIS/FFM). For them the SECOND
  // final email is what completes the item; the first one is just the hand-off.
  const isWsb = applicable.some((s) => s.stage === "PIS" || s.stage === "FFM");
  const completingEmail = isWsb ? finalEmailDate2 : finalEmailDate;
  const combined = isTrEdCombined(stages);

  const completedResult: CurrentStep = {
    stage: null,
    label: "Completed",
    holder: null,
    since: null,
    completed: true,
    unassigned: false,
    awaitingFinalEmail: false,
    linkMissing: false,
    doneCount: totalCount,
    totalCount,
  };

  // The completing final email sent => done, regardless of any unfinished stage
  // — unless the link / remark still has to be recorded.
  if (completingEmail) {
    if (closeout?.required && !closeout.done) {
      return {
        ...completedResult,
        label: "Link / remark missing",
        completed: false,
        linkMissing: true,
      };
    }
    return completedResult;
  }

  // Merged-out items: this item was folded into a combined file, so its pipeline
  // ends on a "Merged" stage and the final email is sent on that combined file —
  // not here. Detect that by the LAST real (non-N/A) stage being Merged. When the
  // tail is merged and no real work is still pending, the item is Complete even
  // without its own final email.
  const nonNa = [...stages].filter((s) => !s.not_applicable && !s.with_tr).sort((a, b) => a.seq - b.seq);
  const endedByMerge = nonNa.length > 0 && !!nonNa[nonNa.length - 1].merged;
  if (endedByMerge && doneCount === totalCount) return completedResult;

  // A stage's work "starts" when its SENT (first) date is written and "ends"
  // when the received-back date is written. So a stage that has a sent date but
  // no received-back date is the one actively in progress. When several are in
  // progress at once, the LAST (highest-seq) one is where the item is now —
  // even if a later stage was already finished out of order.
  const inProgress = applicable.filter((s) => s.sent_date && !s.received_back_date);
  if (inProgress.length > 0) {
    const cur = inProgress[inProgress.length - 1];
    return {
      stage: cur.stage,
      label: itemStageName(cur.stage, combined),
      holder: cur.person ?? null,
      since: cur.sent_date ?? null,
      completed: false,
      unassigned: false,
      awaitingFinalEmail: false,
      linkMissing: false,
      doneCount,
      totalCount,
    };
  }

  // No stage is in progress. If EVERY applicable stage is received back, all the
  // pipeline work is done — but the item is only COMPLETE once the (completing)
  // final email is sent (handled above). Until then surface a clear "awaiting
  // final email" state. This applies to standard items (awaiting the final email)
  // and wsb (awaiting its second, sisters' email). NOTE: we require ALL stages
  // done, not just the last one — finishing a later step out of order (e.g. FPR
  // before ST/FF) must NOT look complete.
  if (totalCount > 0 && doneCount === totalCount) {
    return {
      stage: null,
      label: "Awaiting final email",
      holder: null,
      since: null,
      completed: false,
      unassigned: false,
      awaitingFinalEmail: true,
      linkMissing: false,
      doneCount: totalCount,
      totalCount,
    };
  }

  // Otherwise nobody is currently working on it: a brand-new item, or a stage
  // was returned but the next one has no start date yet (not assigned to anyone
  // yet). Both show as Pending Assignment — a step only "starts" once it has a
  // start date.
  return {
    stage: null,
    label: "Pending Assignment",
    holder: null,
    since: null,
    completed: false,
    unassigned: true,
    awaitingFinalEmail: false,
    linkMissing: false,
    doneCount,
    totalCount,
  };
}

/** Derive the high-level lifecycle status from an item's stage rows. */
export function deriveStatus(
  stages: EtStage[],
  finalEmailDate?: string | null,
  finalEmailDate2?: string | null,
  closeout?: Closeout | null
): ItemStatus {
  const c = computeCurrentStep(stages, finalEmailDate, finalEmailDate2, closeout);
  if (c.completed) return "completed";
  if (c.linkMissing) return "link_missing";
  if (c.unassigned) return "pending_assignment";
  return "in_progress";
}

/** Data for the quick "advance to next step" control. Null when nothing to do. */
export interface ItemAdvance {
  stage: StageCode;
  stageName: string;
  holder: string | null;
  days: number | null;
  /** True when the current stage is sent but not yet returned (in progress). */
  inProgress: boolean;
  nextStage: StageCode | null;
  nextStageName: string | null;
}

/** Work out which stage to act on next (and the one after it) for quick advance. */
export function computeAdvance(
  stages: EtStage[],
  finalEmailDate?: string | null,
  finalEmailDate2?: string | null,
  now: Date = new Date(),
  closeout?: Closeout | null
): ItemAdvance | null {
  const current = computeCurrentStep(stages, finalEmailDate, finalEmailDate2, closeout);
  if (current.completed || current.awaitingFinalEmail || current.linkMissing) return null;

  const applicable = [...stages].filter((s) => !isStageSkipped(s)).sort((a, b) => a.seq - b.seq);
  // When in progress, act on the current stage; otherwise the stage to START is
  // the first applicable one that hasn't been received back yet (the next step
  // waiting to be assigned) — not necessarily the very first stage.
  const actStage = current.stage ?? applicable.find((s) => !s.received_back_date)?.stage ?? null;
  if (!actStage) return null;

  const actRow = stages.find((s) => s.stage === actStage) ?? null;
  const inProgress = !!(actRow?.sent_date && !actRow?.received_back_date);
  // Use the stored row seq (type-aware: magazine FPR=9, Designing=8) so the
  // "next stage" lookup matches the real pipeline order for this item.
  const actSeq = actRow?.seq ?? STAGE_BY_CODE[actStage].seq;
  const next = applicable.find((s) => s.seq > actSeq && !s.received_back_date) ?? null;
  const combined = isTrEdCombined(stages);

  return {
    stage: actStage,
    stageName: itemStageName(actStage, combined),
    holder: current.holder,
    days: daysSince(current.since, now),
    inProgress,
    nextStage: next?.stage ?? null,
    nextStageName: next ? itemStageName(next.stage, combined) : null,
  };
}

/**
 * Build the blank stage rows for a brand-new item (no item_id yet). wsb items
 * get the 2 extra "Islamic Sisters" stages on top of the standard 8.
 *
 * By default Translation is done with AI, so Editing is combined into TR (the
 * ED row is flagged with_tr). Pass manualTranslation to keep ED as its own step.
 */
export function blankStages(type?: string | null, manualTranslation = false): Array<{
  stage: StageCode;
  seq: number;
  person: null;
  sent_date: null;
  received_back_date: null;
  not_applicable: false;
  merged: false;
  with_tr: boolean;
}> {
  return stagesForType(type).map((s) => ({
    stage: s.code,
    seq: s.seq,
    person: null,
    sent_date: null,
    received_back_date: null,
    not_applicable: false,
    merged: false,
    with_tr: s.code === "ED" && !manualTranslation,
  }));
}

/** Days an item has been sitting at its current step (or null). */
export function daysSince(since: string | null, now: Date = new Date()): number | null {
  if (!since) return null;
  const d = new Date(since);
  if (isNaN(d.getTime())) return null;
  return Math.floor((now.getTime() - d.getTime()) / (24 * 60 * 60 * 1000));
}

/**
 * Anything held by one person for more than this many days is flagged on the
 * weekly views so it can be chased up.
 */
export const HELD_ALERT_DAYS = 2;

/**
 * Dashboard threshold: a task sitting at the same step for more than this many
 * days is surfaced in the top "Weekly deliveries" attention list.
 */
export const STEP_ALERT_DAYS = 4;

/** True when an item has been sitting at its current step longer than HELD_ALERT_DAYS. */
export function isHeldTooLong(since: string | null, now: Date = new Date()): boolean {
  const d = daysSince(since, now);
  return d != null && d > HELD_ALERT_DAYS;
}

/**
 * Best-effort parse of a trailing delivery date from a title, e.g.
 * "… (10-7-26)" or "… (18-07-26)" or "… (08.01.2026)". Day-month-year order.
 * Returns an ISO date string, or null. Titles ending in "(old …)" won't match.
 */
export function parseTitleDate(title: string): string | null {
  const m = title.match(/\((\d{1,2})[-.\/](\d{1,2})[-.\/](\d{2,4})\)\s*$/);
  if (!m) return null;
  let [, dd, mm, yy] = m;
  let day = parseInt(dd, 10);
  let mon = parseInt(mm, 10);
  let year = parseInt(yy, 10);
  if (year < 100) year += 2000;
  if (mon < 1 || mon > 12 || day < 1 || day > 31) return null;
  const d = new Date(Date.UTC(year, mon - 1, day));
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export type ReminderUrgency = "overdue" | "urgent" | "soon" | "later";

export interface ReminderInfo {
  delivery: string | null;
  daysLeft: number | null;
  urgency: ReminderUrgency | null;
}

/** Effective delivery date (explicit, else parsed from title) + days-left + urgency. */
export function reminderInfo(
  item: { delivery_date: string | null; title: string },
  now: Date = new Date()
): ReminderInfo {
  const delivery = item.delivery_date ?? parseTitleDate(item.title);
  if (!delivery) return { delivery: null, daysLeft: null, urgency: null };
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(delivery);
  const daysLeft = Math.round((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  let urgency: ReminderUrgency;
  if (daysLeft < 0) urgency = "overdue";
  else if (daysLeft <= 3) urgency = "urgent";
  else if (daysLeft <= 10) urgency = "soon";
  else urgency = "later";
  return { delivery, daysLeft, urgency };
}

export function urgencyClasses(u: ReminderUrgency | null): string {
  switch (u) {
    case "overdue":
      return "bg-red-100 text-red-700 ring-red-600/20 dark:bg-red-900/20 dark:text-red-400";
    case "urgent":
      return "bg-orange-100 text-orange-700 ring-orange-600/20 dark:bg-orange-900/20 dark:text-orange-400";
    case "soon":
      return "bg-amber-100 text-amber-700 ring-amber-600/20 dark:bg-amber-900/20 dark:text-amber-400";
    default:
      return "bg-gray-100 text-gray-600 ring-gray-500/20 dark:bg-gray-800 dark:text-gray-400";
  }
}

/** Tailwind classes for the "Link / remark missing" badge (final email sent, link or remark not recorded yet). */
export const LINK_MISSING_BADGE_CLASSES =
  "bg-sky-100 text-sky-700 ring-sky-600/20 dark:bg-sky-900/20 dark:text-sky-400";

/** Tailwind classes for the "Return" badge — an item currently out on an open return (sent back to fix something) always shows this instead of its normal stage/status. */
export const RETURN_BADGE_CLASSES =
  "bg-amber-100 text-amber-700 ring-amber-600/20 dark:bg-amber-900/20 dark:text-amber-400";

/**
 * Label for the "Return" badge. A return IS assignment — someone has it to fix
 * — so it never reads as bare "Return"; it names the stage it was sent back to
 * (e.g. "Return to ED") when known, falling back to plain "Return" only when
 * the return entry itself has no stage set.
 */
export function returnBadgeLabel(stage: StageCode | null): string {
  return stage ? `Return to ${stage}` : "Return";
}

/**
 * Compact "· Person · Nd" suffix for a return badge — who it's with and how
 * long it's been out. Empty string when neither is known.
 */
export function returnBadgeDetail(person: string | null, sentDate: string | null): string {
  const parts: string[] = [];
  if (person) parts.push(person);
  const days = daysSince(sentDate);
  if (days != null) parts.push(days <= 0 ? "today" : `${days}d`);
  return parts.length ? ` · ${parts.join(" · ")}` : "";
}

/** Tailwind classes for a stage badge, colour-coded by pipeline position. */
export function stageBadgeClasses(stage: StageCode | null, completed = false): string {
  if (completed)
    return "bg-green-50 text-green-700 ring-green-600/20 dark:bg-green-900/20 dark:text-green-400";
  if (!stage)
    return "bg-gray-100 text-gray-600 ring-gray-500/20 dark:bg-gray-800 dark:text-gray-400";
  const map: Record<StageCode, string> = {
    TR: "bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-900/20 dark:text-blue-400",
    IF: "bg-cyan-50 text-cyan-700 ring-cyan-600/20 dark:bg-cyan-900/20 dark:text-cyan-400",
    CM: "bg-teal-50 text-teal-700 ring-teal-600/20 dark:bg-teal-900/20 dark:text-teal-400",
    FO: "bg-lime-50 text-lime-700 ring-lime-600/20 dark:bg-lime-900/20 dark:text-lime-400",
    ED: "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-900/20 dark:text-amber-400",
    NR: "bg-orange-50 text-orange-700 ring-orange-600/20 dark:bg-orange-900/20 dark:text-orange-400",
    ST: "bg-purple-50 text-purple-700 ring-purple-600/20 dark:bg-purple-900/20 dark:text-purple-400",
    FF: "bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-600/20 dark:bg-fuchsia-900/20 dark:text-fuchsia-400",
    DSN: "bg-sky-50 text-sky-700 ring-sky-600/20 dark:bg-sky-900/20 dark:text-sky-400",
    FPR: "bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-900/20 dark:text-rose-400",
    PIS: "bg-pink-50 text-pink-700 ring-pink-600/20 dark:bg-pink-900/20 dark:text-pink-400",
    FFM: "bg-indigo-50 text-indigo-700 ring-indigo-600/20 dark:bg-indigo-900/20 dark:text-indigo-400",
    RTP: "bg-slate-100 text-slate-700 ring-slate-600/20 dark:bg-slate-800 dark:text-slate-300",
  };
  return map[stage];
}
