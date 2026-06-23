"use server";

import { cache } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  EtItem,
  EtItemWithStages,
  EtStage,
  EtPerson,
  EtReturn,
  computeCurrentStep,
  computeAdvance,
  type CurrentStep,
  type ItemAdvance,
  type ItemStatus,
} from "@/lib/et";

// ============================================
// English Translation (ET) cached data layer
// ============================================

const ITEM_COLUMNS =
  "id, title, type, board, received_date, word_count, delivery_date, final_email_date, stopped, priority, status, further_process, created_at, updated_at";
const STAGE_COLUMNS =
  "id, item_id, stage, seq, person, sent_date, received_back_date, not_applicable, merged, created_at, updated_at";

/** A list row: the item plus its computed current step (stages omitted to keep payload small). */
export interface EtItemRow extends EtItem {
  current: CurrentStep;
  /** Lifecycle status derived live from the stages (overrides the stored field). */
  derivedStatus: ItemStatus;
  /** Quick "advance to next step" data (null when completed). */
  advance: ItemAdvance | null;
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

  return (data || []).map((row: any) => ({
    ...(row as EtItem),
    stages: sortStages((row.et_stages || []) as EtStage[]),
  }));
});

/** Lightweight list rows with computed current step (no stage arrays). */
export const getCachedEtItemRows = cache(async (): Promise<EtItemRow[]> => {
  const items = await getCachedEtItemsWithStages();
  return items.map(({ stages, ...item }) => {
    const current = computeCurrentStep(stages, item.final_email_date);
    const derivedStatus: ItemStatus = current.completed
      ? "completed"
      : current.unassigned
        ? "pending_assignment"
        : "in_progress";
    const advance = computeAdvance(stages, item.final_email_date);
    return { ...(item as EtItem), current, derivedStatus, advance };
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

/** Workforce people. */
export const getCachedEtPeople = cache(async (): Promise<EtPerson[]> => {
  const { data, error } = await supabase
    .from("et_people")
    .select("id, name, skills, email, working_hours, dpr_link, notes, active, created_at")
    .order("name", { ascending: true });

  if (error) throw error;
  return data || [];
});
