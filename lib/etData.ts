"use server";

import { cache } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  EtItem,
  EtItemWithStages,
  EtStage,
  EtPerson,
  EtReturn,
  EtAssignment,
  activeStages,
  computeCurrentStep,
  computeAdvance,
  isQuranType,
  type CurrentStep,
  type ItemAdvance,
  type ItemStatus,
  type StageCode,
} from "@/lib/et";

// ============================================
// English Translation (ET) cached data layer
// ============================================

const ITEM_COLUMNS =
  "id, title, type, board, received_date, word_count, delivery_date, final_email_date, final_email_date_2, stopped, priority, status, further_process, created_at, updated_at";
const STAGE_COLUMNS =
  "id, item_id, stage, seq, person, sent_date, received_back_date, not_applicable, merged, created_at, updated_at";

/** A list row: the item plus its computed current step (stages omitted to keep payload small). */
export interface EtItemRow extends EtItem {
  current: CurrentStep;
  /** Lifecycle status derived live from the stages (overrides the stored field). */
  derivedStatus: ItemStatus;
  /** Quick "advance to next step" data (null when completed). */
  advance: ItemAdvance | null;
  /**
   * Codes of every stage the item is *actively* at right now (sent, not yet
   * returned). Usually one; two+ when a person is running stages in parallel
   * (e.g. TR + CM). Lets cards show all active stages, not just the last.
   */
  activeStageCodes: StageCode[];
}

function sortStages(stages: EtStage[]): EtStage[] {
  return [...stages].sort((a, b) => a.seq - b.seq);
}

/** All items with their stages, fully loaded. */
export const getCachedEtItemsWithStages = cache(async (): Promise<EtItemWithStages[]> => {
  const { data, error } = await supabase
    .from("et_items")
    .select(`${ITEM_COLUMNS}, et_stages(${STAGE_COLUMNS})`)
    .order("created_at", { ascending: true });

  if (error) throw error;

  return (data || [])
    .map((row: any) => ({
      ...(row as EtItem),
      stages: sortStages((row.et_stages || []) as EtStage[]),
    }))
    // Quran-e-Pak items live in the Quranic module — hide them from English.
    .filter((item) => !isQuranType(item.type));
});

/** Lightweight list rows with computed current step (no stage arrays). */
export const getCachedEtItemRows = cache(async (): Promise<EtItemRow[]> => {
  const items = await getCachedEtItemsWithStages();
  return items.map(({ stages, ...item }) => {
    const current = computeCurrentStep(stages, item.final_email_date, item.final_email_date_2);
    const derivedStatus: ItemStatus = current.completed
      ? "completed"
      : current.unassigned
        ? "pending_assignment"
        : "in_progress";
    const advance = computeAdvance(stages, item.final_email_date, item.final_email_date_2);
    const activeStageCodes = activeStages(stages).map((s) => s.stage);
    return { ...(item as EtItem), current, derivedStatus, advance, activeStageCodes };
  });
});

/** A single item with its stages, or null. */
export const getCachedEtItem = cache(async (id: string): Promise<EtItemWithStages | null> => {
  const { data, error } = await supabase
    .from("et_items")
    .select(`${ITEM_COLUMNS}, et_stages(${STAGE_COLUMNS})`)
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  // Quran-e-Pak items belong to the Quranic module — not visible in English.
  if (isQuranType((data as EtItem).type)) return null;

  return {
    ...(data as EtItem),
    stages: sortStages(((data as any).et_stages || []) as EtStage[]),
  };
});

/**
 * The "return to complete missing part" entries for an item, newest first.
 * Tolerant of the et_returns table not existing yet (returns [] so the item
 * page still loads before the migration is run).
 */
export const getCachedEtReturns = cache(async (itemId: string): Promise<EtReturn[]> => {
  try {
    const { data, error } = await supabase
      .from("et_returns")
      .select("id, item_id, stage, note, person, sent_date, received_back_date, created_at")
      .eq("item_id", itemId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data || []) as EtReturn[];
  } catch (err) {
    console.error("Failed to fetch ET returns (has the migration been run?):", err);
    return [];
  }
});

/** A return record joined with its item's title/type/stopped, for reports. */
export interface EtReturnRow extends EtReturn {
  item_title: string;
  item_type: string | null;
  item_stopped: boolean;
}

/**
 * Every "return to fix a missing part" record across all items, newest first,
 * joined with its item's title/type. Used by the Reports page to list items that
 * were sent back and drill into a single item's full return history. Tolerant of
 * the et_returns table not existing yet (returns []).
 */
export const getCachedEtAllReturns = cache(async (): Promise<EtReturnRow[]> => {
  try {
    const { data, error } = await supabase
      .from("et_returns")
      .select("id, item_id, stage, note, person, sent_date, received_back_date, created_at, et_items(title, type, stopped)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data || []).map((row: any) => ({
      id: row.id,
      item_id: row.item_id,
      stage: row.stage ?? null,
      note: row.note ?? null,
      person: row.person ?? null,
      sent_date: row.sent_date ?? null,
      received_back_date: row.received_back_date ?? null,
      created_at: row.created_at,
      item_title: row.et_items?.title ?? "(deleted item)",
      item_type: row.et_items?.type ?? null,
      item_stopped: !!row.et_items?.stopped,
    })) as EtReturnRow[];
  } catch (err) {
    console.error("Failed to fetch all ET returns (has the migration been run?):", err);
    return [];
  }
});

/** Workforce people. */
export const getCachedEtPeople = cache(async (): Promise<EtPerson[]> => {
  const { data, error } = await supabase
    .from("et_people")
    .select("id, name, skills, email, working_hours, dpr_link, notes, active, created_at")
    .order("name", { ascending: true });

  if (error) throw error;
  return data || [];
});

/**
 * Planned work assignments (managing board), oldest position first. Each row is
 * joined with its item's title/type for display. Tolerant of the et_assignments
 * table not existing yet (returns [] so the Workforce page still loads before
 * the migration is run).
 */
export const getCachedEtAssignments = cache(async (): Promise<EtAssignment[]> => {
  try {
    const { data, error } = await supabase
      .from("et_assignments")
      .select("id, person_id, item_id, note, position, done, et_items(title, type)")
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data || []).map((row: any) => ({
      id: row.id,
      person_id: row.person_id,
      item_id: row.item_id,
      note: row.note ?? null,
      position: row.position ?? 0,
      done: !!row.done,
      item_title: row.et_items?.title ?? "(deleted item)",
      item_type: row.et_items?.type ?? null,
    })) as EtAssignment[];
  } catch (err) {
    console.error("Failed to fetch ET assignments (has the migration been run?):", err);
    return [];
  }
});
