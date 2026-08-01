"use server";

import { requireStaff } from "@/lib/auth";
import { revalidatePath, revalidateTag } from "next/cache";
import {
  addQuranPerson,
  updateQuranPerson,
  deleteQuranPerson,
  assignPara,
  finishPara,
  reopenPara,
  clearPara,
  type QuranPersonInput,
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

export async function assignParaAction(
  languageId: string,
  stage: StageKey,
  paraNumber: number,
  personId: string | null,
  startedAt: string
): Promise<ParaActionState> {
  if (!languageId || !stage || !paraNumber) return { error: "Missing para reference." };
  try {
    await requireStaff();
    await assignPara(languageId, stage, paraNumber, personId, startedAt);
    revalidateQuranProgress(languageId);
    return { success: true };
  } catch (error) {
    console.error("Failed to assign para:", error);
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return { error: "You don't have permission to edit progress." };
    }
    return { error: "Failed to save. Has the add_para_progress migration been run?" };
  }
}

export async function finishParaAction(
  languageId: string,
  stage: StageKey,
  paraNumber: number,
  finishedAt: string
): Promise<ParaActionState> {
  if (!languageId || !stage || !paraNumber) return { error: "Missing para reference." };
  try {
    await requireStaff();
    await finishPara(languageId, stage, paraNumber, finishedAt);
    revalidateQuranProgress(languageId);
    return { success: true };
  } catch (error) {
    console.error("Failed to finish para:", error);
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return { error: "You don't have permission to edit progress." };
    }
    return { error: "Failed to save. Please try again." };
  }
}

export async function reopenParaAction(
  languageId: string,
  stage: StageKey,
  paraNumber: number
): Promise<ParaActionState> {
  try {
    await requireStaff();
    await reopenPara(languageId, stage, paraNumber);
    revalidateQuranProgress(languageId);
    return { success: true };
  } catch (error) {
    console.error("Failed to reopen para:", error);
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return { error: "You don't have permission to edit progress." };
    }
    return { error: "Failed to save. Please try again." };
  }
}

export async function clearParaAction(
  languageId: string,
  stage: StageKey,
  paraNumber: number
): Promise<ParaActionState> {
  try {
    await requireStaff();
    await clearPara(languageId, stage, paraNumber);
    revalidateQuranProgress(languageId);
    return { success: true };
  } catch (error) {
    console.error("Failed to clear para:", error);
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return { error: "You don't have permission to edit progress." };
    }
    return { error: "Failed to save. Please try again." };
  }
}
