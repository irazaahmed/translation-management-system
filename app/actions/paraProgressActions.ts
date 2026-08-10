"use server";

import { requireStaff } from "@/lib/auth";
import { revalidatePath, revalidateTag } from "next/cache";
import {
  addQuranPerson,
  updateQuranPerson,
  deleteQuranPerson,
  saveParaStage,
  type QuranPersonInput,
  type ParaStageRowInput,
} from "@/lib/paraProgressMutations";
import { QURAN_CACHE_TAG, type StageKey } from "@/lib/progress";

export interface ParaActionState {
  error?: string;
  success?: boolean;
}

// `{ expire: 0 }` = immediate expiry with read-your-own-writes, matching the
// pattern already used for ET_CACHE_TAG in app/actions/etActions.ts.
const QURAN_CACHE_PURGE = { expire: 0 };

function revalidateQuranProgress(languageId?: string) {
  revalidateTag(QURAN_CACHE_TAG, QURAN_CACHE_PURGE);
  revalidatePath("/progress");
  if (languageId) revalidatePath(`/progress/${languageId}`);
  revalidatePath("/progress/people");
  revalidatePath("/reports/paras");
  revalidatePath("/languages");
  if (languageId) revalidatePath(`/languages/${languageId}`);
}

// ============================================
// Workforce actions
// ============================================

function validatePerson(input: QuranPersonInput): string | null {
  if (!input.name?.trim()) return "Name is required.";
  return null;
}

export async function addQuranPersonAction(input: QuranPersonInput): Promise<ParaActionState> {
  const invalid = validatePerson(input);
  if (invalid) return { error: invalid };
  try {
    await requireStaff();
    await addQuranPerson(input);
    revalidateQuranProgress();
    return { success: true };
  } catch (error) {
    console.error("Failed to add person:", error);
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return { error: "You don't have permission to manage the workforce." };
    }
    return { error: "Failed to add. Has the add_para_progress migration been run?" };
  }
}

export async function updateQuranPersonAction(
  personId: string,
  input: QuranPersonInput
): Promise<ParaActionState> {
  const invalid = validatePerson(input);
  if (invalid) return { error: invalid };
  try {
    await requireStaff();
    await updateQuranPerson(personId, input);
    revalidateQuranProgress();
    return { success: true };
  } catch (error) {
    console.error("Failed to update person:", error);
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return { error: "You don't have permission to manage the workforce." };
    }
    return { error: "Failed to save. Please try again." };
  }
}

export async function deleteQuranPersonAction(personId: string): Promise<ParaActionState> {
  try {
    await requireStaff();
    await deleteQuranPerson(personId);
    revalidateQuranProgress();
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
// Per-para progress actions
// ============================================

/** Batch-save one stage's full 1..30 table in a single action — the editor's "Save changes" button. */
export async function saveParaStageAction(
  languageId: string,
  stage: StageKey,
  rows: ParaStageRowInput[]
): Promise<ParaActionState> {
  try {
    await requireStaff();
    await saveParaStage(languageId, stage, rows);
    revalidateQuranProgress(languageId);
    return { success: true };
  } catch (error) {
    console.error("Failed to save para stage:", error);
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return { error: "You don't have permission to edit progress." };
    }
    return { error: "Failed to save. Has the add_para_progress migration been run?" };
  }
}
