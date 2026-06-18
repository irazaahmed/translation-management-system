import "server-only";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { createMeeting, upsertStageProgress } from "@/lib/mutations";
import { getCachedLanguageProgress } from "@/lib/progressData";
import { getLatestMeetingByLanguage } from "@/lib/supabase";
import {
  ALL_STAGE_KEYS,
  clampPara,
  getStageKeysForLanguage,
  getStagesForLanguage,
  getStageMeta,
  type StageKey,
} from "@/lib/progress";

/**
 * Tool layer for the AI assistant. The model decides which of these to call;
 * we run them against Supabase. READ tools are open; WRITE tools call
 * requireStaff() so only logged-in admin/editor can mutate data — even if the
 * model is told otherwise.
 *
 * Every function returns a plain JSON-serializable object that is fed back to
 * the model as the tool result.
 */

// ---- Function declarations sent to Gemini (its tool catalogue) ----

export const functionDeclarations = [
  {
    name: "get_language_progress",
    description:
      "Get how far each para has reached in every stage for one language (Translation, Comparison, etc.). Use when the user asks how much work is done / what stage a language is at.",
    parameters: {
      type: "object",
      properties: {
        language_id: {
          type: "string",
          description: "The exact id of the language from the provided languages list.",
        },
      },
      required: ["language_id"],
    },
  },
  {
    name: "get_last_meeting",
    description:
      "Get the most recent meeting recorded for one language (date, participants, what was discussed, action items). Use when the user asks about the last/previous meeting of a language.",
    parameters: {
      type: "object",
      properties: {
        language_id: {
          type: "string",
          description: "The exact id of the language from the provided languages list.",
        },
      },
      required: ["language_id"],
    },
  },
  {
    name: "update_stage_progress",
    description:
      "Set how many paras have reached a particular stage for a language (e.g. 10 paras Final Proof Reading). Writes to the database. Requires the user to be logged-in staff.",
    parameters: {
      type: "object",
      properties: {
        language_id: {
          type: "string",
          description: "The exact id of the language from the provided languages list.",
        },
        stage: {
          type: "string",
          enum: ALL_STAGE_KEYS as unknown as string[],
          description:
            "Stage key. One of: translation, comparison, formation, convert_into_braille, tafteesh, designing, final_proof_reading. Use convert_into_braille only for Braille languages.",
        },
        para: {
          type: "integer",
          description: "Number of paras (0-30) that have reached this stage.",
        },
        notes: {
          type: "string",
          description: "Optional short note (e.g. 'on hold').",
        },
      },
      required: ["language_id", "stage", "para"],
    },
  },
  {
    name: "log_meeting",
    description:
      "Record a new meeting for a language with what was discussed. Writes to the database. Requires the user to be logged-in staff.",
    parameters: {
      type: "object",
      properties: {
        language_id: {
          type: "string",
          description: "The exact id of the language from the provided languages list.",
        },
        meeting_date: {
          type: "string",
          description: "Meeting date as YYYY-MM-DD. If the user didn't say, use today's date.",
        },
        discussion_points: {
          type: "string",
          description: "A clean, well-written summary of what was discussed in the meeting.",
        },
        participants: {
          type: "string",
          description: "Optional: who attended.",
        },
        action_items: {
          type: "string",
          description: "Optional: next actions / decisions taken.",
        },
        next_meeting_date: {
          type: "string",
          description: "Optional next meeting date as YYYY-MM-DD.",
        },
      },
      required: ["language_id", "meeting_date", "discussion_points"],
    },
  },
];

// ---- Implementations ----

type ToolArgs = Record<string, unknown>;

function str(v: unknown): string | undefined {
  if (typeof v === "string" && v.trim()) return v.trim();
  return undefined;
}

async function getLanguageProgress(args: ToolArgs) {
  const languageId = str(args.language_id);
  if (!languageId) return { error: "language_id is required." };

  const progress = await getCachedLanguageProgress(languageId);
  if (!progress) return { error: "No language found for that id." };

  const stages = getStagesForLanguage(progress.language).map((meta) => ({
    stage: meta.label,
    para_reached: progress.stages[meta.key]?.current_para ?? 0,
    since: progress.stages[meta.key]?.since_date ?? null,
  }));

  return {
    language: progress.language,
    country: progress.country,
    completion_percent: progress.pipelinePercent,
    paras_fully_complete: progress.finishedParas,
    total_paras: 30,
    stages,
  };
}

async function getLastMeeting(args: ToolArgs) {
  const languageId = str(args.language_id);
  if (!languageId) return { error: "language_id is required." };

  const meeting = await getLatestMeetingByLanguage(languageId);
  if (!meeting) return { found: false, message: "No meeting has been recorded for this language yet." };

  return {
    found: true,
    meeting_date: meeting.meeting_date,
    participants: meeting.participants,
    discussion_points: meeting.discussion_points,
    action_items: meeting.action_items,
    next_meeting_date: meeting.next_meeting_date,
  };
}

async function updateStageProgress(args: ToolArgs) {
  const languageId = str(args.language_id);
  const stage = str(args.stage) as StageKey | undefined;
  const paraRaw = args.para;
  const notes = str(args.notes) ?? null;

  if (!languageId || !stage) return { error: "language_id and stage are required." };
  if (!ALL_STAGE_KEYS.includes(stage)) return { error: `Unknown stage "${stage}".` };

  try {
    await requireStaff();
  } catch {
    return { error: "PERMISSION_DENIED: Only logged-in staff can update progress. Ask the user to log in." };
  }

  // Confirm the stage belongs to this language's pipeline (Braille differs).
  const progress = await getCachedLanguageProgress(languageId);
  if (!progress) return { error: "No language found for that id." };

  const validKeys = getStageKeysForLanguage(progress.language);
  if (!validKeys.includes(stage)) {
    return {
      error: `"${getStageMeta(stage).label}" is not a stage for ${progress.language}. Valid stages: ${validKeys
        .map((k) => getStageMeta(k).label)
        .join(", ")}.`,
    };
  }

  const para = clampPara(Number(paraRaw));

  await upsertStageProgress(languageId, [
    { stage, current_para: para, since_date: new Date().toISOString().slice(0, 10), notes },
  ]);

  revalidatePath("/progress");
  revalidatePath(`/progress/${languageId}`);
  revalidatePath(`/languages/${languageId}`);

  return {
    success: true,
    language: progress.language,
    stage: getStageMeta(stage).label,
    para_reached: para,
  };
}

async function logMeeting(args: ToolArgs) {
  const languageId = str(args.language_id);
  const discussion = str(args.discussion_points);
  if (!languageId || !discussion) {
    return { error: "language_id and discussion_points are required." };
  }

  try {
    await requireStaff();
  } catch {
    return { error: "PERMISSION_DENIED: Only logged-in staff can record meetings. Ask the user to log in." };
  }

  const dateStr = str(args.meeting_date) ?? new Date().toISOString().slice(0, 10);
  const meetingDate = new Date(dateStr);
  if (isNaN(meetingDate.getTime())) return { error: `Invalid meeting_date "${dateStr}".` };

  const nextDate = str(args.next_meeting_date);

  await createMeeting({
    language_id: languageId,
    meeting_date: meetingDate.toISOString(),
    participants: str(args.participants) ?? null,
    discussion_points: discussion,
    action_items: str(args.action_items) ?? null,
    next_meeting_date: nextDate ?? null,
  });

  revalidatePath("/");
  revalidatePath("/meetings");
  revalidatePath("/schedule");
  revalidatePath(`/languages/${languageId}`);

  return { success: true, meeting_date: meetingDate.toISOString().slice(0, 10) };
}

/** Dispatch a tool call by name. Always resolves (errors are returned, not thrown). */
export async function executeTool(name: string, args: ToolArgs): Promise<unknown> {
  try {
    switch (name) {
      case "get_language_progress":
        return await getLanguageProgress(args);
      case "get_last_meeting":
        return await getLastMeeting(args);
      case "update_stage_progress":
        return await updateStageProgress(args);
      case "log_meeting":
        return await logMeeting(args);
      default:
        return { error: `Unknown tool "${name}".` };
    }
  } catch (err) {
    console.error(`Assistant tool "${name}" failed:`, err);
    return { error: "The action failed unexpectedly. Please try again." };
  }
}
