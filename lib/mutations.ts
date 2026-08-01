import "server-only";
import { createClient as createServerSupabase } from "./supabase/server";
import type {
  Language,
  CreateLanguageInput,
  UpdateLanguageInput,
  Meeting,
  CreateMeetingInput,
  UpdateMeetingInput,
} from "./supabase";

/**
 * Write operations. These run ONLY on the server (server actions) and use a
 * request-scoped Supabase client bound to the logged-in user's session cookie,
 * so RLS can enforce roles via auth.uid(). Keeping these out of lib/supabase.ts
 * prevents next/headers from leaking into client bundles.
 */
async function getWriteClient() {
  return await createServerSupabase();
}

// ---------------------------------------------------------------
// Languages
// ---------------------------------------------------------------

export async function createLanguage(
  input: CreateLanguageInput
): Promise<Language | null> {
  try {
    const supabase = await getWriteClient();

    if (!input.project_id) {
      throw new Error("Project is required");
    }

    // Check for duplicate language+country within the same project
    const { data: existing, error: checkError } = await supabase
      .from("languages")
      .select("id")
      .eq("project_id", input.project_id)
      .ilike("language", input.language)
      .ilike("country", input.country)
      .maybeSingle();

    if (checkError) throw checkError;
    if (existing) {
      throw new Error("Language already exists for this project");
    }

    const { data, error } = await supabase
      .from("languages")
      .insert([
        {
          country: input.country,
          language: input.language,
          responsible_person: input.responsible_person ?? null,
          priority: input.priority ?? null,
          work_status: input.work_status ?? "not_started",
          assigned_day: input.assigned_day ?? null,
          project_id: input.project_id ?? null,
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Error creating language:", error);
    throw error;
  }
}

/**
 * Set (or clear) a language's scheduled weekday. Used from the Schedule page.
 */
export async function setAssignedDay(
  languageId: string,
  assignedDay: string | null
): Promise<void> {
  try {
    const supabase = await getWriteClient();

    const { error } = await supabase
      .from("languages")
      .update({ assigned_day: assignedDay, updated_at: new Date().toISOString() })
      .eq("id", languageId);

    if (error) throw error;
  } catch (error) {
    console.error("Error setting assigned day:", error);
    throw error;
  }
}

export async function updateLanguage(
  languageId: string,
  input: UpdateLanguageInput
): Promise<Language | null> {
  try {
    const supabase = await getWriteClient();

    const updateData: Partial<Language> = {
      ...input,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("languages")
      .update(updateData)
      .eq("id", languageId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Error updating language:", error);
    throw error;
  }
}

export async function deleteLanguage(languageId: string): Promise<void> {
  try {
    const supabase = await getWriteClient();

    const { error } = await supabase
      .from("languages")
      .delete()
      .eq("id", languageId);

    if (error) throw error;
  } catch (error) {
    console.error("Error deleting language:", error);
    throw error;
  }
}

// ---------------------------------------------------------------
// Meetings
// ---------------------------------------------------------------

export async function createMeeting(
  input: CreateMeetingInput
): Promise<Meeting | null> {
  try {
    const supabase = await getWriteClient();

    const { data, error } = await supabase
      .from("meetings")
      .insert([
        {
          language_id: input.language_id,
          meeting_date: input.meeting_date,
          meeting_type: input.meeting_type ?? null,
          participants: input.participants ?? null,
          discussion_points: input.discussion_points ?? null,
          translation_progress: input.translation_progress ?? null,
          progress_percentage: input.progress_percentage ?? null,
          action_items: input.action_items ?? null,
          next_meeting_date: input.next_meeting_date ?? null,
          meeting_notes: input.meeting_notes ?? null,
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Error creating meeting:", error);
    throw error;
  }
}

export async function updateMeeting(
  meetingId: string,
  input: UpdateMeetingInput
): Promise<Meeting | null> {
  try {
    const supabase = await getWriteClient();

    const updateData: Partial<Meeting> = {
      ...input,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("meetings")
      .update(updateData)
      .eq("id", meetingId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Error updating meeting:", error);
    throw error;
  }
}

export async function deleteMeeting(meetingId: string): Promise<void> {
  try {
    const supabase = await getWriteClient();

    const { error } = await supabase.from("meetings").delete().eq("id", meetingId);

    if (error) throw error;
  } catch (error) {
    console.error("Error deleting meeting:", error);
    throw error;
  }
}

