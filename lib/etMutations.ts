import "server-only";
import { createClient as createServerSupabase } from "./supabase/server";
import {
  blankStages,
  deriveStatus,
  STAGES,
  type EtItem,
  type EtStage,
  type ItemBoard,
  type ItemPriority,
  type ItemStatus,
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

  const stageRows = blankStages().map((s) => ({ ...s, item_id: itemId }));
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
 */
export async function saveEtStages(itemId: string, stages: StageUpsert[]): Promise<void> {
  const supabase = await getWriteClient();
  const seqByCode = Object.fromEntries(STAGES.map((s) => [s.code, s.seq]));

  const rows = stages.map((s) => ({
    item_id: itemId,
    stage: s.stage,
    seq: seqByCode[s.stage],
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

  // Recompute status from the just-saved stage data.
  const status: ItemStatus = deriveStatus(rows as unknown as EtStage[]);
  const { error: statusError } = await supabase
    .from("et_items")
    .update({ status })
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
    .select("final_email_date")
    .eq("id", itemId)
    .maybeSingle();

  const status = deriveStatus((stages || []) as EtStage[], item?.final_email_date ?? null);
  const { error: statusError } = await supabase.from("et_items").update({ status }).eq("id", itemId);
  if (statusError) throw statusError;
}
