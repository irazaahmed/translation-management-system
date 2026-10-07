import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CATEGORY_LABELS,
  STAGE_BY_CODE,
  computeAdvance,
  computeCurrentStep,
  daysSince,
  deriveStatus,
  effectiveWordCount,
  isQuranType,
  isWsbType,
  itemCategory,
  parseTitleDate,
  stageName,
  TYPE_LABELS,
  typeLabel,
  type CurrentStep,
  type EtItem,
  type EtItemWithStages,
  type EtReturn,
  type EtStage,
  type ItemAdvance,
  type ItemCategory,
  type StageCode,
} from "@/lib/et";
import type { CreateEtItemInput, StagePatch } from "@/lib/etMutations";
import { isIsoDate, todayPk } from "./common";

export { UUID_RE, isIsoDate, todayPk } from "./common";

/**
 * Shared shaping/validation for the /api/v1 REST API. All pipeline rules come
 * from lib/et.ts (computeCurrentStep / computeAdvance) — the same functions the
 * item page and its "Move →" button use — so the API never re-implements them.
 */

// ---- Category slugs (API) <-> ItemCategory (app) ----

export const CATEGORY_SLUGS: Record<string, ItemCategory> = {
  "weekly-docs": "weekly",
  magazine: "magazine",
  books: "books",
  other: "other",
};
const SLUG_BY_CATEGORY = Object.fromEntries(
  Object.entries(CATEGORY_SLUGS).map(([slug, cat]) => [cat, slug])
) as Record<ItemCategory, string>;

export function categorySlug(type: string | null | undefined): string {
  return SLUG_BY_CATEGORY[itemCategory(type)];
}

export function categoryLabel(type: string | null | undefined): string {
  return CATEGORY_LABELS[itemCategory(type)];
}

export function isStageCode(code: unknown): code is StageCode {
  return typeof code === "string" && code in STAGE_BY_CODE;
}

// ---- Output shapes ----

function stepRef(current: CurrentStep) {
  return current.stage ? { code: current.stage, name: stageName(current.stage) } : null;
}

/**
 * The item page's status line, word for word ("Currently at S.Tafteesh with X
 * since 2026-10-03", "Pending assignment — …", "Completed — …").
 */
export function currentlyAtText(item: EtItem, current: CurrentStep): string {
  if (current.completed) {
    return (item.final_email_date_2 || item.final_email_date)
      ? "Completed — final email sent."
      : "Completed — all applicable stages done.";
  }
  if (current.awaitingFinalEmail) {
    return isWsbType(item.type)
      ? "All steps done — send the 2nd final email (to the Islamic Sisters) to complete this item."
      : "All steps done — send the final email to complete this item.";
  }
  if (current.unassigned) {
    return current.doneCount > 0
      ? "Pending assignment — the previous step is done but the next one hasn't been given out yet (no start date)."
      : "Pending assignment — no step has been started yet.";
  }
  let s = `Currently at ${current.label}`;
  if (current.holder) s += ` with ${current.holder}`;
  if (current.since) {
    const days = daysSince(current.since);
    s += ` since ${current.since}`;
    if (days != null) s += ` (${days} day${days === 1 ? "" : "s"} here)`;
  }
  return s;
}

/** What the "Move →" / "Start" button would do next, in API terms. */
export function nextAction(advance: ItemAdvance | null) {
  if (!advance) return null;
  if (!advance.inProgress) {
    return { action: "start", stage: advance.stage, advance_to: advance.stage };
  }
  return advance.nextStage
    ? { action: "move", from: advance.stage, advance_to: advance.nextStage }
    : { action: "finish", stage: advance.stage, advance_to: "DONE" };
}

/** Compact list row. `row` comes from getCachedEtItemRows (already computed). */
export function listItem(row: EtItem & {
  current: CurrentStep;
  derivedStatus: string;
  activeStageCodes: StageCode[];
  inReturn: boolean;
  returnStage: StageCode | null;
  returnPerson: string | null;
  returnSentDate: string | null;
}) {
  const c = row.current;
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    type_label: typeLabel(row.type),
    category: categorySlug(row.type),
    status: row.derivedStatus,
    stopped: row.stopped,
    current_step: stepRef(c),
    current_label: c.label,
    active_stages: row.activeStageCodes,
    holder: c.holder,
    at_step_since: c.since,
    days_at_step: daysSince(c.since),
    progress: { done: c.doneCount, total: c.totalCount },
    delivery_date: row.delivery_date,
    priority: row.priority,
    word_count: row.word_count,
    net_word_count: effectiveWordCount(row.type, row.word_count),
    in_return: row.inReturn
      ? { stage: row.returnStage, holder: row.returnPerson, since: row.returnSentDate }
      : null,
  };
}

function stageState(s: EtStage): string {
  if (s.not_applicable) return "not_applicable";
  if (s.merged) return "merged";
  if (s.received_back_date) return "done";
  if (s.sent_date) return "in_progress";
  return "pending";
}

/** Full item detail: meta + pipeline + tracking history + computed state. */
export function itemDetail(item: EtItemWithStages, returns: EtReturn[]) {
  const stages = [...item.stages].sort((a, b) => a.seq - b.seq);
  const current = computeCurrentStep(stages, item.final_email_date, item.final_email_date_2);
  const advance = computeAdvance(stages, item.final_email_date, item.final_email_date_2);

  const tracking = [
    ...stages
      .filter((s) => s.person || s.sent_date)
      .map((s) => ({
        kind: "stage" as const,
        stage: s.stage,
        stage_name: stageName(s.stage),
        holder: s.person,
        from: s.sent_date,
        to: s.received_back_date,
      })),
    ...returns.map((r) => ({
      kind: "return" as const,
      stage: r.stage,
      stage_name: r.stage ? stageName(r.stage) : null,
      holder: r.person,
      from: r.sent_date,
      to: r.received_back_date,
      note: r.note,
    })),
  ].sort((a, b) => (a.from ?? "9999").localeCompare(b.from ?? "9999"));

  return {
    id: item.id,
    title: item.title,
    type: item.type,
    type_label: typeLabel(item.type),
    category: categorySlug(item.type),
    category_label: categoryLabel(item.type),
    board: item.board,
    status: deriveStatus(stages, item.final_email_date, item.final_email_date_2),
    stopped: item.stopped,
    priority: item.priority,
    word_count: item.word_count,
    net_word_count: effectiveWordCount(item.type, item.word_count),
    received_date: item.received_date,
    delivery_date: item.delivery_date,
    final_email_date: item.final_email_date,
    final_email_date_2: isWsbType(item.type) ? item.final_email_date_2 : undefined,
    sender: { name: item.sender_name, email: item.sender_email },
    further_process: item.further_process,
    current_step: stepRef(current),
    currently_at: currentlyAtText(item, current),
    holder: current.holder,
    at_step_since: current.since,
    days_at_step: daysSince(current.since),
    progress: { done: current.doneCount, total: current.totalCount },
    next_action: nextAction(advance),
    pipeline: stages.map((s) => ({
      code: s.stage,
      name: stageName(s.stage),
      seq: s.seq,
      state: stageState(s),
      holder: s.person,
      sent_date: s.sent_date,
      received_date: s.received_back_date,
    })),
    tracking,
    created_at: item.created_at,
    updated_at: item.updated_at,
  };
}

// ---- Fresh (uncached) reads for the write path ----

/** Load one item + stages straight from the DB (no cache). Null if missing / Quran. */
export async function loadItemFresh(
  client: SupabaseClient,
  id: string
): Promise<EtItemWithStages | null> {
  const { data, error } = await client
    .from("et_items")
    .select("*, et_stages(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data || isQuranType((data as EtItem).type)) return null;
  const { et_stages, ...item } = data as EtItem & { et_stages: EtStage[] };
  return { ...(item as EtItem), stages: [...(et_stages || [])].sort((a, b) => a.seq - b.seq) };
}

export async function loadReturnsFresh(client: SupabaseClient, itemId: string): Promise<EtReturn[]> {
  const { data, error } = await client
    .from("et_returns")
    .select("id, item_id, stage, note, person, sent_date, received_back_date, created_at")
    .eq("item_id", itemId)
    .order("created_at", { ascending: false });
  if (error) return []; // table may not exist yet — same tolerance as the item page
  return (data || []) as EtReturn[];
}

// ---- PATCH body -> StagePatch[] ----

type BuildResult = { patches: StagePatch[] } | { error: string; details?: unknown; status?: number };

/**
 * Resolve a holder name to the canonical workforce name (case-insensitive).
 * Pipeline holders must come from the workforce list, same as the UI dropdown.
 */
function resolveHolder(
  raw: unknown,
  people: string[]
): { ok: true; name: string | null } | { ok: false; error: string } {
  if (raw === null || raw === "") return { ok: true, name: null };
  if (typeof raw !== "string") return { ok: false, error: "holder must be a string or null." };
  const found = people.find((p) => p.toLowerCase() === raw.trim().toLowerCase());
  return found
    ? { ok: true, name: found }
    : { ok: false, error: `Unknown holder "${raw}". Use a name from GET /api/v1/meta (holders).` };
}

/**
 * Build the stage patches for a PATCH /pipeline request, applying the same
 * rules as the item page:
 *  - `advance_to` mirrors the "Move →" / "Start" button exactly: it must name
 *    the step computeAdvance() says comes next (or "DONE" for the last step).
 *  - `stages` mirrors the pipeline editor: per-stage field edits, only for
 *    stages that exist on this item, with holders from the workforce list.
 */
export function buildPipelinePatches(
  item: EtItemWithStages,
  body: Record<string, unknown>,
  people: string[]
): BuildResult {
  const hasAdvance = body.advance_to !== undefined;
  const hasStages = body.stages !== undefined;
  if (hasAdvance === hasStages) {
    return { error: 'Send exactly one of "advance_to" or "stages".' };
  }

  if (hasAdvance) {
    const target = typeof body.advance_to === "string" ? body.advance_to.trim().toUpperCase() : "";
    const date = body.date === undefined ? todayPk() : body.date;
    if (!isIsoDate(date)) return { error: '"date" must be YYYY-MM-DD.' };
    // Holder is optional; when omitted, whatever holder the stage row already
    // has (e.g. pre-assigned in the pipeline editor) is left untouched.
    const holder = body.holder === undefined ? null : resolveHolder(body.holder, people);
    if (holder && !holder.ok) return { error: holder.error };
    const person = holder ? { person: holder.name } : {};

    const advance = computeAdvance(item.stages, item.final_email_date, item.final_email_date_2);
    if (!advance) {
      return {
        status: 409,
        error: "Nothing to advance — the item is completed or only awaiting its final email.",
      };
    }
    const expected = nextAction(advance)!;
    if (target !== expected.advance_to) {
      return {
        status: 409,
        error: `Cannot advance to "${target || body.advance_to}". The next allowed step is "${expected.advance_to}".`,
        details: { next_action: expected },
      };
    }

    if (!advance.inProgress) {
      // "Start <stage>": give the waiting stage out.
      return { patches: [{ stage: advance.stage, ...person, sent_date: date }] };
    }
    // "Move → <next>": receive the current stage back, send the next one out.
    const patches: StagePatch[] = [{ stage: advance.stage, received_back_date: date }];
    if (advance.nextStage) {
      patches.push({ stage: advance.nextStage, ...person, sent_date: date });
    }
    return { patches };
  }

  if (!Array.isArray(body.stages) || body.stages.length === 0 || body.stages.length > 20) {
    return { error: '"stages" must be a non-empty array (max 20).' };
  }
  const present = new Set(item.stages.map((s) => s.stage));
  const patches: StagePatch[] = [];
  const problems: string[] = [];
  body.stages.forEach((raw, i) => {
    if (!raw || typeof raw !== "object") {
      problems.push(`stages[${i}] must be an object.`);
      return;
    }
    const s = raw as Record<string, unknown>;
    const code = typeof s.code === "string" ? s.code.trim().toUpperCase() : s.code;
    if (!isStageCode(code) || !present.has(code)) {
      problems.push(`stages[${i}].code "${String(s.code)}" is not a stage of this item (${[...present].join(", ")}).`);
      return;
    }
    const patch: StagePatch = { stage: code };
    if ("holder" in s) {
      const h = resolveHolder(s.holder, people);
      if (!h.ok) problems.push(`stages[${i}]: ${h.error}`);
      else patch.person = h.name;
    }
    for (const [field, target] of [
      ["sent_date", "sent_date"],
      ["received_date", "received_back_date"],
    ] as const) {
      if (!(field in s)) continue;
      const v = s[field];
      if (v === null || v === "") patch[target] = null;
      else if (isIsoDate(v)) patch[target] = v;
      else problems.push(`stages[${i}].${field} must be YYYY-MM-DD or null.`);
    }
    if (Object.keys(patch).length === 1) {
      problems.push(`stages[${i}] has nothing to change (holder / sent_date / received_date).`);
      return;
    }
    patches.push(patch);
  });
  if (problems.length) return { error: "Invalid stages.", details: problems };
  return { patches };
}

// ---- POST /items body -> CreateEtItemInput ----

const CREATE_KEYS = new Set([
  "title",
  "type",
  "received_date",
  "delivery_date",
  "word_count",
  "final_email_date",
  "priority",
  "further_process",
  "sender_name",
  "sender_email",
  "allow_duplicate",
  "note",
]);
const ITEM_PRIORITIES = ["low", "normal", "urgent"];

/**
 * Validate a new-item body with the same rules as the "New item" form
 * (createEtItemAction): title required, delivery date auto-read from a title
 * ending in "(dd-mm-yy)" when not given, board fixed to Main (2026).
 */
export function parseCreateItem(
  body: Record<string, unknown>
): { input: CreateEtItemInput } | { error: string; details?: unknown } {
  const problems: string[] = [];
  const unknown = Object.keys(body).filter((k) => !CREATE_KEYS.has(k));
  if (unknown.length) problems.push(`Unknown field(s): ${unknown.join(", ")}.`);

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) problems.push("title is required.");
  else if (title.length > 300) problems.push("title must be at most 300 characters.");

  let type: string | null = null;
  if (body.type !== undefined && body.type !== null && body.type !== "") {
    const t = typeof body.type === "string" ? body.type.trim().toLowerCase() : "";
    if (t in TYPE_LABELS) type = t;
    else problems.push(`type must be one of: ${Object.keys(TYPE_LABELS).join(", ")} (or null).`);
  }

  const date = (field: string): string | null => {
    const v = body[field];
    if (v === undefined || v === null || v === "") return null;
    if (isIsoDate(v)) return v;
    problems.push(`${field} must be YYYY-MM-DD or null.`);
    return null;
  };
  const received_date = date("received_date");
  const final_email_date = date("final_email_date");
  const delivery_date = date("delivery_date") ?? (title ? parseTitleDate(title) : null);

  let word_count: number | null = null;
  if (body.word_count !== undefined && body.word_count !== null) {
    if (Number.isInteger(body.word_count) && (body.word_count as number) >= 0) word_count = body.word_count as number;
    else problems.push("word_count must be a non-negative integer or null.");
  }

  let priority: CreateEtItemInput["priority"] = null;
  if (body.priority !== undefined && body.priority !== null && body.priority !== "") {
    if (ITEM_PRIORITIES.includes(body.priority as string)) priority = body.priority as CreateEtItemInput["priority"];
    else problems.push(`priority must be one of: ${ITEM_PRIORITIES.join(", ")} (or null).`);
  }

  const text = (field: string, max: number): string | null => {
    const v = body[field];
    if (v === undefined || v === null) return null;
    if (typeof v === "string" && v.length <= max) return v.trim() || null;
    problems.push(`${field} must be a string (max ${max}) or null.`);
    return null;
  };
  const further_process = text("further_process", 5000);
  const sender_name = text("sender_name", 200);
  const sender_email = text("sender_email", 200);
  if (sender_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sender_email)) problems.push("sender_email is not a valid email.");

  if (problems.length) return { error: "Invalid request.", details: problems };
  return {
    input: {
      title,
      type,
      board: "main_2026",
      received_date,
      word_count,
      delivery_date,
      final_email_date,
      priority,
      further_process,
      sender_name,
      sender_email,
    },
  };
}
