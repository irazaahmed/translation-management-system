"use server";

import { requireStaff } from "@/lib/auth";
import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import {
  createEtItem,
  updateEtItem,
  deleteEtItem,
  setEtStopped,
  setEtItemComment,
  saveEtStages,
  patchEtStages,
  addEtReturn,
  updateEtReturn,
  deleteEtReturn,
  addEtPerson,
  updateEtPerson,
  deleteEtPerson,
  addEtAssignment,
  updateEtAssignment,
  deleteEtAssignment,
  reorderEtAssignments,
  type StageUpsert,
  type StagePatch,
  type EtPersonInput,
} from "@/lib/etMutations";
import { parseTitleDate, ET_CACHE_TAG, type ItemPriority, type StageCode } from "@/lib/et";

export interface EtFormState {
  error?: string;
  success?: boolean;
}

const VALID_PRIORITIES: ItemPriority[] = ["low", "normal", "urgent"];

function parsePriority(v: string | null): ItemPriority | null {
  return VALID_PRIORITIES.includes(v as ItemPriority) ? (v as ItemPriority) : null;
}
function parseInt0(v: string | null): number | null {
  if (!v || !v.trim()) return null;
  const n = parseInt(v.replace(/[^0-9]/g, ""), 10);
  return Number.isNaN(n) ? null : n;
}

// `{ expire: 0 }` = immediate expiry with read-your-own-writes, so a mutation's
// re-render sees fresh rows at once (a string profile would be stale-while-
// revalidate; a bare tag is deprecated in Next 16 and only allowed in actions).
const ET_CACHE_PURGE = { expire: 0 };

function revalidateEt(itemId?: string) {
  // Drop the shared ET data cache so the next read hits Supabase for fresh rows.
  revalidateTag(ET_CACHE_TAG, ET_CACHE_PURGE);
  revalidatePath("/et");
  revalidatePath("/et/items");
  if (itemId) revalidatePath(`/et/items/${itemId}`);
}

function revalidateWorkforce() {
  revalidateTag(ET_CACHE_TAG, ET_CACHE_PURGE);
  revalidatePath("/et/workforce");
  revalidatePath("/et");
  revalidatePath("/et/items");
}

/** Save a per-item comment / note (used by the Books section). */
export async function saveEtItemCommentAction(
  itemId: string,
  comment: string | null
): Promise<{ error?: string; success?: boolean }> {
  if (!itemId) return { error: "Missing item id" };
  try {
    await requireStaff();
    await setEtItemComment(itemId, comment);
    revalidatePath("/et/books");
    revalidateEt(itemId);
    return { success: true };
  } catch (error) {
    console.error("Failed to save comment:", error);
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return { error: "You don't have permission to edit this." };
    }
    return { error: "Failed to save. Please try again." };
  }
}

export async function createEtItemAction(
  _prev: EtFormState,
  formData: FormData
): Promise<EtFormState> {
  const title = (formData.get("title") as string)?.trim();
  if (!title) return { error: "Title is required" };

  // Auto-fetch delivery date from a title ending in e.g. "(20-07-26)".
  const delivery_date = (formData.get("delivery_date") as string) || parseTitleDate(title) || null;

  let newId: string;
  try {
    await requireStaff();
    newId = await createEtItem({
      title,
      type: (formData.get("type") as string)?.trim() || null,
      board: "main_2026",
      received_date: (formData.get("received_date") as string) || null,
      word_count: parseInt0(formData.get("word_count") as string),
      delivery_date,
      final_email_date: (formData.get("final_email_date") as string) || null,
      priority: parsePriority(formData.get("priority") as string),
      further_process: (formData.get("further_process") as string)?.trim() || null,
    });
    revalidateEt();
  } catch (error) {
    console.error("Failed to create ET item:", error);
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return { error: "You don't have permission to add items." };
    }
    return { error: "Failed to create item. Please try again." };
  }
  redirect(`/et/items/${newId}`);
}

export async function updateEtItemAction(
  _prev: EtFormState,
  formData: FormData
): Promise<EtFormState> {
  const itemId = formData.get("item_id") as string;
  const title = (formData.get("title") as string)?.trim();
  if (!itemId) return { error: "Missing item id" };
  if (!title) return { error: "Title is required" };

  // Auto-fetch delivery date from a title ending in e.g. "(20-07-26)".
  const delivery_date = (formData.get("delivery_date") as string) || parseTitleDate(title) || null;

  try {
    await requireStaff();
    await updateEtItem(itemId, {
      title,
      type: (formData.get("type") as string)?.trim() || null,
      received_date: (formData.get("received_date") as string) || null,
      word_count: parseInt0(formData.get("word_count") as string),
      delivery_date,
      final_email_date: (formData.get("final_email_date") as string) || null,
      priority: parsePriority(formData.get("priority") as string),
      further_process: (formData.get("further_process") as string)?.trim() || null,
    });
    revalidateEt(itemId);
  } catch (error) {
    console.error("Failed to update ET item:", error);
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return { error: "You don't have permission to edit items." };
    }
    return { error: "Failed to update item. Please try again." };
  }
  redirect(`/et/items/${itemId}`);
}

/** Save the full pipeline (called from the client pipeline editor). */
export async function saveEtStagesAction(
  itemId: string,
  stages: StageUpsert[],
  finalEmailDate?: string | null,
  finalEmailDate2?: string | null
): Promise<{ error?: string; success?: boolean }> {
  try {
    await requireStaff();
    await saveEtStages(itemId, stages, finalEmailDate, finalEmailDate2);
    revalidateEt(itemId);
    return { success: true };
  } catch (error) {
    console.error("Failed to save stages:", error);
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return { error: "You don't have permission to update the pipeline." };
    }
    return { error: "Failed to save. Please try again." };
  }
}

/** Quick advance: patch a couple of stages (mark returned / assign next) from the item summary. */
export async function patchEtStagesAction(
  itemId: string,
  patches: StagePatch[]
): Promise<{ error?: string; success?: boolean }> {
  try {
    await requireStaff();
    await patchEtStages(itemId, patches);
    revalidateEt(itemId);
    return { success: true };
  } catch (error) {
    console.error("Failed to advance stage:", error);
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return { error: "You don't have permission to update the pipeline." };
    }
    return { error: "Failed to save. Please try again." };
  }
}

/** Add a "return to complete missing part" entry. */
export async function addEtReturnAction(
  itemId: string,
  input: {
    stage: StageCode | null;
    note: string | null;
    person: string | null;
    sent_date: string | null;
    received_back_date: string | null;
  }
): Promise<{ error?: string; success?: boolean }> {
  if (!input.note?.trim() && !input.person?.trim()) {
    return { error: "Add a note of what's missing, or who it went to." };
  }
  try {
    await requireStaff();
    await addEtReturn(itemId, input);
    revalidateEt(itemId);
    return { success: true };
  } catch (error) {
    console.error("Failed to add return:", error);
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return { error: "You don't have permission to update this item." };
    }
    return { error: "Failed to save. Has the et_returns migration been run?" };
  }
}

/** Mark a return as completed (received back), or clear it. */
export async function updateEtReturnAction(
  itemId: string,
  returnId: string,
  received_back_date: string | null
): Promise<{ error?: string; success?: boolean }> {
  try {
    await requireStaff();
    await updateEtReturn(returnId, { received_back_date });
    revalidateEt(itemId);
    return { success: true };
  } catch (error) {
    console.error("Failed to update return:", error);
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return { error: "You don't have permission to update this item." };
    }
    return { error: "Failed to save. Please try again." };
  }
}

/** Delete a return entry. */
export async function deleteEtReturnAction(
  itemId: string,
  returnId: string
): Promise<{ error?: string; success?: boolean }> {
  try {
    await requireStaff();
    await deleteEtReturn(returnId);
    revalidateEt(itemId);
    return { success: true };
  } catch (error) {
    console.error("Failed to delete return:", error);
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return { error: "You don't have permission to update this item." };
    }
    return { error: "Failed to delete. Please try again." };
  }
}

export async function setEtStoppedAction(
  itemId: string,
  stopped: boolean
): Promise<{ error?: string; success?: boolean }> {
  try {
    await requireStaff();
    await setEtStopped(itemId, stopped);
    revalidateEt(itemId);
    return { success: true };
  } catch (error) {
    console.error("Failed to set stopped:", error);
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return { error: "You don't have permission to change this." };
    }
    return { error: "Failed to save. Please try again." };
  }
}

// ============================================
// Workforce actions
// ============================================

function validatePerson(input: EtPersonInput): string | null {
  if (!input.name?.trim()) return "Name is required.";
  return null;
}

export async function addEtPersonAction(
  input: EtPersonInput
): Promise<{ error?: string; success?: boolean }> {
  const invalid = validatePerson(input);
  if (invalid) return { error: invalid };
  try {
    await requireStaff();
    await addEtPerson(input);
    revalidateWorkforce();
    return { success: true };
  } catch (error) {
    console.error("Failed to add person:", error);
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return { error: "You don't have permission to manage the workforce." };
    }
    return { error: "Failed to add person. Please try again." };
  }
}

export async function updateEtPersonAction(
  personId: string,
  prevName: string,
  input: EtPersonInput
): Promise<{ error?: string; success?: boolean }> {
  const invalid = validatePerson(input);
  if (invalid) return { error: invalid };
  try {
    await requireStaff();
    await updateEtPerson(personId, prevName, input);
    revalidateWorkforce();
    return { success: true };
  } catch (error) {
    console.error("Failed to update person:", error);
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return { error: "You don't have permission to manage the workforce." };
    }
    return { error: "Failed to save. Please try again." };
  }
}

export async function deleteEtPersonAction(
  personId: string
): Promise<{ error?: string; success?: boolean }> {
  try {
    await requireStaff();
    await deleteEtPerson(personId);
    revalidateWorkforce();
    return { success: true };
  } catch (error) {
    console.error("Failed to delete person:", error);
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return { error: "You don't have permission to manage the workforce." };
    }
    return { error: "Failed to delete. Please try again." };
  }
}

// ============================================
// Planned work assignments (managing board)
// ============================================

function revalidateAssignments() {
  revalidateTag(ET_CACHE_TAG, ET_CACHE_PURGE);
  revalidatePath("/et/workforce");
  revalidatePath("/et/workload");
  revalidatePath("/et/books");
  revalidatePath("/et/books/assignments");
}

export async function addEtAssignmentAction(input: {
  person_id: string;
  item_id: string;
  note: string | null;
}): Promise<{ error?: string; success?: boolean }> {
  if (!input.person_id || !input.item_id) return { error: "Pick an item to assign." };
  try {
    await requireStaff();
    await addEtAssignment(input);
    revalidateAssignments();
    return { success: true };
  } catch (error) {
    console.error("Failed to add assignment:", error);
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return { error: "You don't have permission to plan work." };
    }
    return { error: "Failed to save. Has the et_assignments migration been run?" };
  }
}

export async function updateEtAssignmentAction(
  assignmentId: string,
  patch: { note?: string | null; done?: boolean }
): Promise<{ error?: string; success?: boolean }> {
  try {
    await requireStaff();
    await updateEtAssignment(assignmentId, patch);
    revalidateAssignments();
    return { success: true };
  } catch (error) {
    console.error("Failed to update assignment:", error);
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return { error: "You don't have permission to plan work." };
    }
    return { error: "Failed to save. Please try again." };
  }
}

export async function deleteEtAssignmentAction(
  assignmentId: string
): Promise<{ error?: string; success?: boolean }> {
  try {
    await requireStaff();
    await deleteEtAssignment(assignmentId);
    revalidateAssignments();
    return { success: true };
  } catch (error) {
    console.error("Failed to delete assignment:", error);
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return { error: "You don't have permission to plan work." };
    }
    return { error: "Failed to delete. Please try again." };
  }
}

export async function reorderEtAssignmentsAction(
  personId: string,
  orderedIds: string[]
): Promise<{ error?: string; success?: boolean }> {
  try {
    await requireStaff();
    await reorderEtAssignments(personId, orderedIds);
    revalidateAssignments();
    return { success: true };
  } catch (error) {
    console.error("Failed to reorder assignments:", error);
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return { error: "You don't have permission to plan work." };
    }
    return { error: "Failed to save order. Please try again." };
  }
}

export async function deleteEtItemAction(itemId: string): Promise<{ error?: string }> {
  try {
    await requireStaff();
    await deleteEtItem(itemId);
    revalidateEt();
    return {};
  } catch (error) {
    console.error("Failed to delete ET item:", error);
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return { error: "You don't have permission to delete items." };
    }
    return { error: "Failed to delete item. Please try again." };
  }
}
