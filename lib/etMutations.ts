import "server-only";
import { createClient as createServerSupabase } from "./supabase/server";
import {
  blankStages,
  deriveStatus,
  STAGE_BY_CODE,
  type EtItem,
  type EtStage,
  type ItemBoard,
  type ItemPriority,
  type StageCode,
} from "./et";

export interface AddEtReturnInput {
  stage: StageCode | null;
  note: string | null;
  person: string | null;
  sent_date: string | null;
  received_back_date: string | null;
}

/**
 * Write operations for the English Translation module. Server-only; uses the
 * request-scoped Supabase client bound to the logged-in user's session so RLS
 * applies. Callers (server actions) must gate with requireStaff().
 */
async function getWriteClient() {
  return await createServerSupabase();
}

export interface CreateEtItemInput {
  title: string;
  type: string | null;
  board: ItemBoard;
  received_date: string | null;
  word_count: number | null;
  delivery_date: string | null;
  final_email_date: string | null;
  priority: ItemPriority | null;
  further_process: string | null;
}

/** Create an item plus its 8 (blank) pipeline stage rows. Returns the new id. */
export async function createEtItem(input: CreateEtItemInput): Promise<string> {
  const supabase = await getWriteClient();

  const { data: item, error } = await supabase
    .from("et_items")
    .insert([
      {
        title: input.title,
        type: input.type,
        board: input.board,
        received_date: input.received_date,
        word_count: input.word_count,
        delivery_date: input.delivery_date,
        final_email_date: input.final_email_date,
        priority: input.priority,
        status: input.final_email_date ? "completed" : "pending_assignment",
        further_process: input.further_process,
      },
    ])
    .select("id")
    .single();

  if (error) throw error;
  const itemId = item.id as string;

  const stageRows = blankStages(input.type).map((s) => ({ ...s, item_id: itemId }));
  const { error: stageError } = await supabase.from("et_stages").insert(stageRows);
  if (stageError) throw stageError;

  return itemId;
}

export type UpdateEtItemInput = Partial<
  Pick<
    EtItem,
    "title" | "type" | "board" | "received_date" | "word_count" | "delivery_date" | "final_email_date" | "priority" | "further_process"
  >
>;

export async function updateEtItem(itemId: string, input: UpdateEtItemInput): Promise<void> {
  const supabase = await getWriteClient();
  const { error } = await supabase.from("et_items").update(input).eq("id", itemId);
  if (error) throw error;
}

/**
 * Save the free-text comment / note for an item. Used by the Books section
 * (and reused as the item's "Notes / Further process"). Reuses further_process
 * so no schema change is needed.
 */
export async function setEtItemComment(itemId: string, comment: string | null): Promise<void> {
  const supabase = await getWriteClient();
  const { error } = await supabase
    .from("et_items")
    .update({ further_process: comment?.trim() || null })
    .eq("id", itemId);
  if (error) throw error;
}

export async function deleteEtItem(itemId: string): Promise<void> {
  const supabase = await getWriteClient();
  // et_stages cascade-delete via FK.
  const { error } = await supabase.from("et_items").delete().eq("id", itemId);
  if (error) throw error;
}

/** Stop (skip) or resume a project. */
export async function setEtStopped(itemId: string, stopped: boolean): Promise<void> {
  const supabase = await getWriteClient();
  const { error } = await supabase.from("et_items").update({ stopped }).eq("id", itemId);
  if (error) throw error;
}

export interface StageUpsert {
  stage: StageCode;
  person: string | null;
  sent_date: string | null;
  received_back_date: string | null;
  not_applicable: boolean;
  merged: boolean;
}

/**
 * Save all pipeline stages for an item in one call, then recompute and store
 * the item's derived status. Relies on UNIQUE(item_id, stage).
 *
 * The final email date is saved alongside the stages: when set, the item counts
 * as complete (final email sent), regardless of any skipped stage. Pass
 * `undefined` to leave it untouched, or a date / null to set / clear it.
 */
export async function saveEtStages(
  itemId: string,
  stages: StageUpsert[],
  finalEmailDate?: string | null,
  finalEmailDate2?: string | null
): Promise<void> {
  const supabase = await getWriteClient();

  const rows = stages.map((s) => ({
    item_id: itemId,
    stage: s.stage,
    seq: STAGE_BY_CODE[s.stage].seq,
    person: s.person?.trim() || null,
    sent_date: s.sent_date || null,
    received_back_date: s.received_back_date || null,
    not_applicable: !!s.not_applicable,
    merged: !!s.merged,
  }));

  const { error } = await supabase
    .from("et_stages")
    .upsert(rows, { onConflict: "item_id,stage" });
  if (error) throw error;

  // Recompute status from the just-saved stage data (+ the final email dates).
  const itemUpdate: Record<string, unknown> = {
    status: deriveStatus(rows as unknown as EtStage[], finalEmailDate ?? null, finalEmailDate2 ?? null),
  };
  // Only write the final email dates when the caller actually provided them.
  if (finalEmailDate !== undefined) itemUpdate.final_email_date = finalEmailDate || null;
  if (finalEmailDate2 !== undefined) itemUpdate.final_email_date_2 = finalEmailDate2 || null;

  const { error: statusError } = await supabase
    .from("et_items")
    .update(itemUpdate)
    .eq("id", itemId);
  if (statusError) throw statusError;
}

/** Add a "return to complete missing part" entry for an item. */
export async function addEtReturn(itemId: string, input: AddEtReturnInput): Promise<void> {
  const supabase = await getWriteClient();
  const { error } = await supabase.from("et_returns").insert([
    {
      item_id: itemId,
      stage: input.stage,
      note: input.note?.trim() || null,
      person: input.person?.trim() || null,
      sent_date: input.sent_date || null,
      received_back_date: input.received_back_date || null,
    },
  ]);
  if (error) throw error;
}

/** Mark an existing return as completed (its received-back date). */
export async function updateEtReturn(
  returnId: string,
  patch: { received_back_date?: string | null }
): Promise<void> {
  const supabase = await getWriteClient();
  const { error } = await supabase
    .from("et_returns")
    .update({ received_back_date: patch.received_back_date || null })
    .eq("id", returnId);
  if (error) throw error;
}

/** Delete a return entry. */
export async function deleteEtReturn(returnId: string): Promise<void> {
  const supabase = await getWriteClient();
  const { error } = await supabase.from("et_returns").delete().eq("id", returnId);
  if (error) throw error;
}

// ============================================
// Workforce (et_people) — the single source of truth for holder names.
// ============================================

export interface EtPersonInput {
  name: string;
  skills: string | null;
  email: string | null;
  working_hours: string | null;
  active: boolean;
}

/** Add a new workforce member. */
export async function addEtPerson(input: EtPersonInput): Promise<void> {
  const supabase = await getWriteClient();
  const { error } = await supabase.from("et_people").insert([
    {
      name: input.name.trim(),
      skills: input.skills?.trim() || null,
      email: input.email?.trim() || null,
      working_hours: input.working_hours?.trim() || null,
      active: input.active,
    },
  ]);
  if (error) throw error;
}

/**
 * Update a workforce member. When the name changes, the new name is cascaded to
 * every stage holder and return entry that used the old name, so editing a
 * person here flows through to the whole site automatically.
 */
export async function updateEtPerson(
  personId: string,
  prevName: string,
  input: EtPersonInput
): Promise<void> {
  const supabase = await getWriteClient();
  const newName = input.name.trim();

  const { error } = await supabase
    .from("et_people")
    .update({
      name: newName,
      skills: input.skills?.trim() || null,
      email: input.email?.trim() || null,
      working_hours: input.working_hours?.trim() || null,
      active: input.active,
    })
    .eq("id", personId);
  if (error) throw error;

  // Cascade the rename so existing work history points at the new name.
  if (prevName && newName && prevName !== newName) {
    const { error: stageErr } = await supabase
      .from("et_stages")
      .update({ person: newName })
      .eq("person", prevName);
    if (stageErr) throw stageErr;
    // et_returns may not exist yet on older databases — ignore if missing.
    try {
      await supabase.from("et_returns").update({ person: newName }).eq("person", prevName);
    } catch (err) {
      console.error("Cascade rename on et_returns skipped:", err);
    }
  }
}

/** Remove a workforce member (does not touch their past work history). */
export async function deleteEtPerson(personId: string): Promise<void> {
  const supabase = await getWriteClient();
  const { error } = await supabase.from("et_people").delete().eq("id", personId);
  if (error) throw error;
}

export interface StagePatch {
  stage: StageCode;
  person?: string | null;
  sent_date?: string | null;
  received_back_date?: string | null;
}

/**
 * Patch one or more stages (only the provided fields) and recompute the item's
 * status. Used by the quick "advance to next step" control on the item page.
 */
export async function patchEtStages(itemId: string, patches: StagePatch[]): Promise<void> {
  const supabase = await getWriteClient();

  for (const p of patches) {
    const patch: Record<string, unknown> = {};
    if ("person" in p) patch.person = p.person?.trim() || null;
    if ("sent_date" in p) patch.sent_date = p.sent_date || null;
    if ("received_back_date" in p) patch.received_back_date = p.received_back_date || null;
    if (Object.keys(patch).length === 0) continue;

    const { error } = await supabase
      .from("et_stages")
      .update(patch)
      .eq("item_id", itemId)
      .eq("stage", p.stage);
    if (error) throw error;
  }

  // Recompute the stored status from the item's full, current stage set.
  const { data: stages, error } = await supabase
    .from("et_stages")
    .select("stage, seq, person, sent_date, received_back_date, not_applicable, merged")
    .eq("item_id", itemId);
  if (error) throw error;

  const { data: item } = await supabase
    .from("et_items")
    .select("final_email_date, final_email_date_2")
    .eq("id", itemId)
    .maybeSingle();

  const status = deriveStatus(
    (stages || []) as EtStage[],
    item?.final_email_date ?? null,
    item?.final_email_date_2 ?? null
  );
  const { error: statusError } = await supabase.from("et_items").update({ status }).eq("id", itemId);
  if (statusError) throw statusError;
}
