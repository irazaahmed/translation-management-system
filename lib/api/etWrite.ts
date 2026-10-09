import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath, revalidateTag } from "next/cache";
import { ET_CACHE_TAG, TYPE_LABELS, isWsbType, parseTitleDate, type EtItemWithStages, type StageCode } from "@/lib/et";
import type { AddEtReturnInput, EtPersonInput, UpdateEtItemInput } from "@/lib/etMutations";
import { isIsoDate } from "./common";
import { isStageCode, resolveHolder } from "./items";

/**
 * Validation + shared plumbing for the English write endpoints beyond the
 * pipeline (item edit, final email, stop, returns, workforce, assignments).
 * Every write goes through the same lib/etMutations.ts function the UI uses.
 */

type Fail = { error: string; details?: unknown; status?: number };

/** Drop every ET cache/page the UI's server actions drop (revalidateEt + workforce + assignments). */
export function revalidateEtAll(itemId?: string) {
  revalidateTag(ET_CACHE_TAG, { expire: 0 });
  for (const p of [
    "/et",
    "/et/items",
    "/et/books",
    "/et/books/assignments",
    "/et/magazine",
    "/et/reminders",
    "/et/workforce",
    "/et/workload",
  ]) {
    revalidatePath(p);
  }
  if (itemId) revalidatePath(`/et/items/${itemId}`);
}

/** One api_audit_log row. `itemId` is the English item (or null for workforce-only changes). */
export async function auditEt(
  client: SupabaseClient,
  key: { id: string; name: string },
  entry: { itemId: string | null; action: string; request: unknown; note: string | null }
) {
  const { error } = await client.from("api_audit_log").insert({
    key_id: key.id,
    key_name: key.name,
    item_id: entry.itemId,
    action: entry.action,
    request: entry.request,
    note: entry.note,
  });
  if (error) console.error("api_audit_log insert failed:", error.message);
}

function unknownKeys(body: Record<string, unknown>, allowed: Set<string>): string[] {
  return Object.keys(body).filter((k) => !allowed.has(k));
}

function optText(
  body: Record<string, unknown>,
  field: string,
  max: number,
  problems: string[]
): string | null | undefined {
  if (!(field in body)) return undefined;
  const v = body[field];
  if (v === null || v === "") return null;
  if (typeof v === "string" && v.length <= max) return v.trim() || null;
  problems.push(`${field} must be a string (max ${max}) or null.`);
  return undefined;
}

function optDate(body: Record<string, unknown>, field: string, problems: string[]): string | null | undefined {
  if (!(field in body)) return undefined;
  const v = body[field];
  if (v === null || v === "") return null;
  if (isIsoDate(v)) return v;
  problems.push(`${field} must be YYYY-MM-DD or null.`);
  return undefined;
}

// ============================================================
// PATCH /items/{id} — edit form fields, final email, stop/resume
// ============================================================

const ITEM_PATCH_KEYS = new Set([
  "title",
  "type",
  "received_date",
  "delivery_date",
  "word_count",
  "priority",
  "further_process",
  "sender_name",
  "sender_email",
  "final_email_date",
  "final_email_date_2",
  "stopped",
  "note",
]);

export interface ItemPatchPlan {
  /** Fields for updateEtItem() (the edit form). */
  fields: UpdateEtItemInput;
  /** Final email dates, saved through saveEtStages() so the status is recomputed. */
  finalEmail: { final_email_date?: string | null; final_email_date_2?: string | null } | null;
  stopped: boolean | null;
}

export function planItemPatch(item: EtItemWithStages, body: Record<string, unknown>): { plan: ItemPatchPlan } | Fail {
  const problems: string[] = [];
  const unknown = unknownKeys(body, ITEM_PATCH_KEYS);
  if (unknown.length) problems.push(`Unknown field(s): ${unknown.join(", ")}.`);
  const fields: UpdateEtItemInput = {};

  if ("title" in body) {
    const t = typeof body.title === "string" ? body.title.trim() : "";
    if (!t || t.length > 300) problems.push("title must be a non-empty string (max 300).");
    else fields.title = t;
  }
  if ("type" in body) {
    const v = body.type;
    if (v === null || v === "") fields.type = null;
    else if (typeof v === "string" && v.trim().toLowerCase() in TYPE_LABELS) fields.type = v.trim().toLowerCase();
    else problems.push(`type must be one of: ${Object.keys(TYPE_LABELS).join(", ")} (or null).`);
  }
  const received = optDate(body, "received_date", problems);
  if (received !== undefined) fields.received_date = received;
  const delivery = optDate(body, "delivery_date", problems);
  if (delivery !== undefined) {
    // Same as the edit form: a blank delivery date is read from a "(dd-mm-yy)" title.
    fields.delivery_date = delivery ?? parseTitleDate(fields.title ?? item.title);
  }
  if ("word_count" in body) {
    const v = body.word_count;
    if (v === null) fields.word_count = null;
    else if (Number.isInteger(v) && (v as number) >= 0) fields.word_count = v as number;
    else problems.push("word_count must be a non-negative integer or null.");
  }
  if ("priority" in body) {
    const v = body.priority;
    if (v === null || v === "") fields.priority = null;
    else if (v === "low" || v === "normal" || v === "urgent") fields.priority = v;
    else problems.push("priority must be one of: low, normal, urgent (or null).");
  }
  for (const [f, max] of [["further_process", 5000], ["sender_name", 200], ["sender_email", 200]] as const) {
    const v = optText(body, f, max, problems);
    if (v !== undefined) fields[f] = v;
  }
  if (fields.sender_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.sender_email)) {
    problems.push("sender_email is not a valid email.");
  }

  let finalEmail: ItemPatchPlan["finalEmail"] = null;
  const fe1 = optDate(body, "final_email_date", problems);
  const fe2 = optDate(body, "final_email_date_2", problems);
  if (fe2 !== undefined && !isWsbType(fields.type ?? item.type)) {
    problems.push("final_email_date_2 (the 2nd, Islamic Sisters email) only exists for wsb items.");
  }
  if (fe1 !== undefined || fe2 !== undefined) {
    finalEmail = {};
    if (fe1 !== undefined) finalEmail.final_email_date = fe1;
    if (fe2 !== undefined) finalEmail.final_email_date_2 = fe2;
  }

  let stopped: boolean | null = null;
  if ("stopped" in body) {
    if (typeof body.stopped === "boolean") stopped = body.stopped;
    else problems.push("stopped must be true or false.");
  }

  if (problems.length) return { error: "Invalid request.", details: problems };
  if (Object.keys(fields).length === 0 && !finalEmail && stopped === null) {
    return { error: "Nothing to change." };
  }
  return { plan: { fields, finalEmail, stopped } };
}

// ============================================================
// Returns ("sent back to complete a missing part")
// ============================================================

const RETURN_KEYS = new Set(["stage", "note", "holder", "sent_date", "received_date", "api_note"]);

/**
 * Validate a return body. On create the UI requires a note or a person; the
 * stage (optional) must be one of the item's stages and the holder must come
 * from the workforce list, same as the UI's dropdowns.
 */
export function parseReturn(
  item: EtItemWithStages,
  body: Record<string, unknown>,
  people: string[],
  creating: boolean
): { input: Partial<AddEtReturnInput> } | Fail {
  const problems: string[] = [];
  const unknown = unknownKeys(body, RETURN_KEYS);
  if (unknown.length) problems.push(`Unknown field(s): ${unknown.join(", ")}. (Use "api_note" for the audit note.)`);
  const input: Partial<AddEtReturnInput> = {};

  if ("stage" in body) {
    const v = body.stage;
    const code = typeof v === "string" ? v.trim().toUpperCase() : v;
    if (v === null || v === "") input.stage = null;
    else if (isStageCode(code) && item.stages.some((s) => s.stage === code)) input.stage = code as StageCode;
    else problems.push(`stage must be one of this item's stages (${item.stages.map((s) => s.stage).join(", ")}) or null.`);
  }
  const note = optText(body, "note", 2000, problems);
  if (note !== undefined) input.note = note;
  if ("holder" in body) {
    const h = resolveHolder(body.holder, people);
    if (h.ok) input.person = h.name;
    else problems.push(h.error);
  }
  const sent = optDate(body, "sent_date", problems);
  if (sent !== undefined) input.sent_date = sent;
  const recv = optDate(body, "received_date", problems);
  if (recv !== undefined) input.received_back_date = recv;

  if (creating && !input.note && !input.person) problems.push("Add a note of what's missing, or who it went to (holder).");
  if (!creating && Object.keys(input).length === 0) problems.push("Nothing to change.");
  if (problems.length) return { error: "Invalid request.", details: problems };
  if (creating) {
    return {
      input: {
        stage: input.stage ?? null,
        note: input.note ?? null,
        person: input.person ?? null,
        sent_date: input.sent_date ?? null,
        received_back_date: input.received_back_date ?? null,
      },
    };
  }
  return { input };
}

// ============================================================
// Workforce (et_people)
// ============================================================

const PERSON_KEYS = new Set(["name", "skills", "email", "working_hours", "active", "note"]);

/** Validate a workforce member. On edit, unspecified fields keep their current values. */
export function parsePerson(
  body: Record<string, unknown>,
  current: EtPersonInput | null
): { input: EtPersonInput } | Fail {
  const problems: string[] = [];
  const unknown = unknownKeys(body, PERSON_KEYS);
  if (unknown.length) problems.push(`Unknown field(s): ${unknown.join(", ")}.`);
  const out: EtPersonInput = current
    ? { ...current }
    : { name: "", skills: null, email: null, working_hours: null, active: true };

  if ("name" in body || !current) {
    const n = typeof body.name === "string" ? body.name.trim() : "";
    if (!n || n.length > 120) problems.push("name is required (max 120).");
    else out.name = n;
  }
  for (const [f, max] of [["skills", 500], ["email", 200], ["working_hours", 200]] as const) {
    const v = optText(body, f, max, problems);
    if (v !== undefined) out[f] = v;
  }
  if (out.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(out.email)) problems.push("email is not a valid email.");
  if ("active" in body) {
    if (typeof body.active === "boolean") out.active = body.active;
    else problems.push("active must be true or false.");
  }
  if (current && Object.keys(body).filter((k) => k !== "note").length === 0) problems.push("Nothing to change.");
  if (problems.length) return { error: "Invalid request.", details: problems };
  return { input: out };
}

export function personOut(p: {
  id: string;
  name: string;
  skills: string | null;
  email: string | null;
  working_hours: string | null;
  active: boolean;
  created_at?: string;
}) {
  return {
    id: p.id,
    name: p.name,
    skills: p.skills,
    email: p.email,
    working_hours: p.working_hours,
    active: p.active,
    created_at: p.created_at,
  };
}
