import "server-only";
import { createClient as createServerSupabase } from "./supabase/server";
import type { StageKey } from "./progress";

/**
 * Write operations for Quranic per-para progress. Server-only; uses the
 * request-scoped Supabase client bound to the logged-in user's session so RLS
 * applies. Callers (server actions) must gate with requireStaff().
 */
async function getWriteClient() {
  return await createServerSupabase();
}

// ============================================
// Workforce — quran_people
// ============================================

export interface QuranPersonInput {
  name: string;
  active: boolean;
  notes: string | null;
}

export async function addQuranPerson(input: QuranPersonInput): Promise<void> {
  const supabase = await getWriteClient();
  const { error } = await supabase.from("quran_people").insert([
    { name: input.name.trim(), active: input.active, notes: input.notes?.trim() || null },
  ]);
  if (error) throw error;
}

export async function updateQuranPerson(personId: string, input: QuranPersonInput): Promise<void> {
  const supabase = await getWriteClient();
  const { error } = await supabase
    .from("quran_people")
    .update({ name: input.name.trim(), active: input.active, notes: input.notes?.trim() || null })
    .eq("id", personId);
  if (error) throw error;
}

/** Remove a workforce member (does not touch their past para history — person_id just goes null). */
export async function deleteQuranPerson(personId: string): Promise<void> {
  const supabase = await getWriteClient();
  const { error } = await supabase.from("quran_people").delete().eq("id", personId);
  if (error) throw error;
}

// ============================================
// Per-para progress — para_progress
// ============================================

/** Assign a para to a person and start it (or restart it, clearing any prior finish). */
export async function assignPara(
  languageId: string,
  stage: StageKey,
  paraNumber: number,
  personId: string | null,
  startedAt: string
): Promise<void> {
  const supabase = await getWriteClient();
  const { error } = await supabase.from("para_progress").upsert(
    [
      {
        language_id: languageId,
        stage,
        para_number: paraNumber,
        person_id: personId,
        started_at: startedAt,
        finished_at: null,
      },
    ],
    { onConflict: "language_id,stage,para_number" }
  );
  if (error) throw error;
}

/** Mark a para finished. If it was never explicitly started, backfills started_at with the finish date. */
export async function finishPara(
  languageId: string,
  stage: StageKey,
  paraNumber: number,
  finishedAt: string
): Promise<void> {
  const supabase = await getWriteClient();

  // Common case (para was started first): a single UPDATE, no extra round trip.
  const { data: updated, error: updateErr } = await supabase
    .from("para_progress")
    .update({ finished_at: finishedAt })
    .eq("language_id", languageId)
    .eq("stage", stage)
    .eq("para_number", paraNumber)
    .select("para_number");
  if (updateErr) throw updateErr;
  if (updated && updated.length > 0) return;

  // Rare case: marked finished with no prior row — insert one, backfilling
  // started_at with the finish date since it was never explicitly started.
  const { error: insertErr } = await supabase.from("para_progress").insert([
    {
      language_id: languageId,
      stage,
      para_number: paraNumber,
      person_id: null,
      started_at: finishedAt,
      finished_at: finishedAt,
    },
  ]);
  if (insertErr) throw insertErr;
}

/** Move a finished para back to in-progress. */
export async function reopenPara(languageId: string, stage: StageKey, paraNumber: number): Promise<void> {
  const supabase = await getWriteClient();
  const { error } = await supabase
    .from("para_progress")
    .update({ finished_at: null })
    .eq("language_id", languageId)
    .eq("stage", stage)
    .eq("para_number", paraNumber);
  if (error) throw error;
}

/** Unassign a para entirely — back to not-started. */
export async function clearPara(languageId: string, stage: StageKey, paraNumber: number): Promise<void> {
  const supabase = await getWriteClient();
  const { error } = await supabase
    .from("para_progress")
    .delete()
    .eq("language_id", languageId)
    .eq("stage", stage)
    .eq("para_number", paraNumber);
  if (error) throw error;
}

/**
 * Bulk convenience for the AI assistant's "set stage to para N" tool: ensures
 * paras 1..count for a stage are marked finished (today, unassigned unless
 * already assigned), without touching paras beyond count or clobbering
 * already-recorded people/start dates on paras that were already finished.
 */
export async function setStageParaCountFinished(
  languageId: string,
  stage: StageKey,
  count: number,
  finishedAt: string
): Promise<void> {
  if (count <= 0) return;
  const supabase = await getWriteClient();
  const { data: existing, error: selErr } = await supabase
    .from("para_progress")
    .select("para_number, started_at, person_id, finished_at")
    .eq("language_id", languageId)
    .eq("stage", stage)
    .lte("para_number", count);
  if (selErr) throw selErr;

  const existingByNumber = new Map(
    (existing ?? []).map((r: any) => [r.para_number as number, r])
  );
  const rows: {
    language_id: string;
    stage: StageKey;
    para_number: number;
    person_id: string | null;
    started_at: string;
    finished_at: string;
  }[] = [];
  for (let n = 1; n <= count; n++) {
    const row = existingByNumber.get(n);
    if (row?.finished_at) continue; // already finished, leave as-is
    rows.push({
      language_id: languageId,
      stage,
      para_number: n,
      person_id: row?.person_id ?? null,
      started_at: row?.started_at ?? finishedAt,
      finished_at: finishedAt,
    });
  }
  if (rows.length === 0) return;
  const { error } = await supabase
    .from("para_progress")
    .upsert(rows, { onConflict: "language_id,stage,para_number" });
  if (error) throw error;
}
