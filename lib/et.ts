// ============================================
// English Translation (ET) module — shared types & pipeline helpers
// ============================================
// A work item flows through an 8-stage pipeline. The "current step / holder"
// is COMPUTED from the stage rows (never stored by hand).

export type StageCode = "TR" | "IF" | "CM" | "ED" | "NR" | "ST" | "FF" | "FPR";

export type ItemBoard = "main_2026" | "kanzul_madaris" | "magazine";
export type ItemStatus = "pending_assignment" | "in_progress" | "completed";
export type ItemPriority = "low" | "normal" | "urgent";

/** Pipeline stages in order, with their full names. */
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

export const STAGE_BY_CODE: Record<StageCode, { seq: number; name: string }> =
  Object.fromEntries(STAGES.map((s) => [s.code, { seq: s.seq, name: s.name }])) as Record<
    StageCode,
    { seq: number; name: string }
  >;

export function stageName(code: StageCode): string {
  return STAGE_BY_CODE[code]?.name ?? code;
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
  quran: "Quran",
};

export function typeLabel(type: string | null | undefined): string {
  if (!type) return "—";
  return TYPE_LABELS[type.toLowerCase()] ?? type;
}

/** Weekly documents that must be delivered every week (handled like the Excel REMINDER sheet). */
export const WEEKLY_TYPES = ["wsb", "fsp", "wbl"] as const;
export function isWeeklyType(type: string | null | undefined): boolean {
  return !!type && (WEEKLY_TYPES as readonly string[]).includes(type.toLowerCase());
}
export function isMagazineType(type: string | null | undefined): boolean {
  return (type || "").toLowerCase() === "mgz";
}

/** High-level category used to group/filter the Work Items list. */
export type ItemCategory = "weekly" | "magazine" | "quran" | "books" | "other";

export const CATEGORY_LABELS: Record<ItemCategory, string> = {
  weekly: "Weekly Docs",
  magazine: "Magazine",
  quran: "Quran",
  books: "Books",
  other: "Other Works",
};

/** Order categories appear as tabs. */
export const CATEGORY_ORDER: ItemCategory[] = ["weekly", "magazine", "quran", "books", "other"];

export function itemCategory(type: string | null | undefined): ItemCategory {
  const t = (type || "").toLowerCase();
  if (isWeeklyType(t)) return "weekly";
  if (t === "mgz") return "magazine";
  if (t === "quran") return "quran";
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
  created_at?: string;
  updated_at?: string;
}

/** A stage that does not count toward the pipeline (skipped as N/A or Merged). */
export function isStageSkipped(s: Pick<EtStage, "not_applicable" | "merged">): boolean {
  return s.not_applicable || s.merged;
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
  /** Manually stopped / skipped projects (e.g. cancelled FOA work) — kept for the record. */
  stopped: boolean;
  priority: ItemPriority | null;
  status: ItemStatus;
  further_process: string | null;
  created_at: string;
  updated_at: string;
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
  /** Count of applicable stages that are received back. */
  doneCount: number;
  /** Count of applicable stages. */
  totalCount: number;
}

/**
 * Derive the current step / holder from an item's stage rows.
 * The current step is the first applicable stage whose work has not yet
 * been received back. The holder is that stage's person; "since" is its
 * sent date (falling back to the previous stage's received-back date).
 */
export function computeCurrentStep(
  stages: EtStage[],
  finalEmailDate?: string | null
): CurrentStep {
  const applicable = [...stages]
    .filter((s) => !isStageSkipped(s))
    .sort((a, b) => a.seq - b.seq);

  const totalCount = applicable.length;
  const doneCount = applicable.filter((s) => !!s.received_back_date).length;

  // Final email sent => done, regardless of any unfinished stage.
  if (finalEmailDate) {
    return {
      stage: null,
      label: "Completed",
      holder: null,
      since: null,
      completed: true,
      unassigned: false,
      doneCount: totalCount,
      totalCount,
    };
  }

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
      label: stageName(cur.stage),
      holder: cur.person ?? null,
      since: cur.sent_date ?? null,
      completed: false,
      unassigned: false,
      doneCount,
      totalCount,
    };
  }

  // Nothing in progress. A stage only "starts" once it has a date — a person
  // pencilled in with no sent date yet does NOT count as started, so the item
  // stays "Pending Assignment" until a date is put on it.
  const anyDated = applicable.some((s) => s.sent_date || s.received_back_date);
  if (!anyDated) {
    return {
      stage: null,
      label: "Pending Assignment",
      holder: null,
      since: null,
      completed: false,
      unassigned: true,
      doneCount,
      totalCount,
    };
  }

  // Every started stage is finished. If the last applicable stage is done, the
  // item is complete (even if an earlier stage was left empty/skipped).
  const finished = applicable.filter((s) => s.received_back_date);
  const furthestFinished = finished.length ? finished[finished.length - 1] : null;
  const lastApplicable = applicable[applicable.length - 1];
  if (furthestFinished && lastApplicable && furthestFinished.seq === lastApplicable.seq) {
    return {
      stage: null,
      label: "Completed",
      holder: null,
      since: null,
      completed: true,
      unassigned: false,
      doneCount: totalCount,
      totalCount,
    };
  }

  // Otherwise the work is waiting between stages: show the next unfinished stage.
  const fromSeq = furthestFinished ? furthestFinished.seq : 0;
  const next = applicable.find((s) => s.seq > fromSeq && !s.received_back_date);
  if (next) {
    return {
      stage: next.stage,
      label: stageName(next.stage),
      holder: next.person ?? null,
      since: next.sent_date ?? furthestFinished?.received_back_date ?? null,
      completed: false,
      unassigned: false,
      doneCount,
      totalCount,
    };
  }

  // Fallback.
  return {
    stage: null,
    label: "Completed",
    holder: null,
    since: null,
    completed: true,
    unassigned: false,
    doneCount: totalCount,
    totalCount,
  };
}

/** Derive the high-level lifecycle status from an item's stage rows. */
export function deriveStatus(stages: EtStage[], finalEmailDate?: string | null): ItemStatus {
  const c = computeCurrentStep(stages, finalEmailDate);
  if (c.completed) return "completed";
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
  now: Date = new Date()
): ItemAdvance | null {
  const current = computeCurrentStep(stages, finalEmailDate);
  if (current.completed) return null;

  const applicable = [...stages].filter((s) => !isStageSkipped(s)).sort((a, b) => a.seq - b.seq);
  const actStage = current.stage ?? applicable[0]?.stage ?? null;
  if (!actStage) return null;

  const actRow = stages.find((s) => s.stage === actStage) ?? null;
  const inProgress = !!(actRow?.sent_date && !actRow?.received_back_date);
  const actSeq = STAGE_BY_CODE[actStage].seq;
  const next = applicable.find((s) => s.seq > actSeq && !s.received_back_date) ?? null;

  return {
    stage: actStage,
    stageName: stageName(actStage),
    holder: current.holder,
    days: daysSince(current.since, now),
    inProgress,
    nextStage: next?.stage ?? null,
    nextStageName: next ? stageName(next.stage) : null,
  };
}

/** Build the 8 blank stage rows for a brand-new item (no item_id yet). */
export function blankStages(): Array<{
  stage: StageCode;
  seq: number;
  person: null;
  sent_date: null;
  received_back_date: null;
  not_applicable: false;
  merged: false;
}> {
  return STAGES.map((s) => ({
    stage: s.code,
    seq: s.seq,
    person: null,
    sent_date: null,
    received_back_date: null,
    not_applicable: false,
    merged: false,
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
    ED: "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-900/20 dark:text-amber-400",
    NR: "bg-orange-50 text-orange-700 ring-orange-600/20 dark:bg-orange-900/20 dark:text-orange-400",
    ST: "bg-purple-50 text-purple-700 ring-purple-600/20 dark:bg-purple-900/20 dark:text-purple-400",
    FF: "bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-600/20 dark:bg-fuchsia-900/20 dark:text-fuchsia-400",
    FPR: "bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-900/20 dark:text-rose-400",
  };
  return map[stage];
}
