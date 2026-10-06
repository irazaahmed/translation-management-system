import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient as createServerSupabase } from "./supabase/server";
import type { StageKey } from "./progress";

/**
 * Write operations for Quranic per-para progress. Server-only; uses the
 * request-scoped Supabase client bound to the logged-in user's session so RLS
 * applies. Callers (server actions) must gate with requireStaff().
 */
async function getWriteClient(client?: SupabaseClient) {
  // `client` is only passed by the API-key routes (/api/v1/quran), which have
  // no user session and use the service-role client.
  return client ?? (await createServerSupabase());
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

export interface ParaStageRowInput {
  paraNumber: number;
  personId: string | null;
  startedAt: string | null;
  finishedAt: string | null;
}

/**
 * Batch-save every para (1..30) of one stage in a single round trip pair —
 * the editable-table equivalent of ET's saveEtStages. Rows with any data
 * (person/started/finished) are upserted together; rows that were cleared
 * back to empty are deleted together (back to "not started").
 */
export async function saveParaStage(
  languageId: string,
  stage: StageKey,
  rows: ParaStageRowInput[],
  client?: SupabaseClient
): Promise<void> {
  const supabase = await getWriteClient(client);

  const toUpsert = rows.filter((r) => r.personId || r.startedAt || r.finishedAt);
  const toDelete = rows.filter((r) => !r.personId && !r.startedAt && !r.finishedAt).map((r) => r.paraNumber);

  if (toUpsert.length > 0) {
    const { error } = await supabase.from("para_progress").upsert(
      toUpsert.map((r) => ({
        language_id: languageId,
        stage,
        para_number: r.paraNumber,
        person_id: r.personId,
        started_at: r.startedAt,
        finished_at: r.finishedAt,
      })),
      { onConflict: "language_id,stage,para_number" }
    );
    if (error) throw error;
  }

  if (toDelete.length > 0) {
    const { error } = await supabase
      .from("para_progress")
      .delete()
      .eq("language_id", languageId)
      .eq("stage", stage)
      .in("para_number", toDelete);
    if (error) throw error;
  }
}
