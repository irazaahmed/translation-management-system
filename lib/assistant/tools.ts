import "server-only";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { createMeeting, upsertStageProgress } from "@/lib/mutations";
import { getCachedLanguageProgress } from "@/lib/progressData";
import { getCachedScheduleData } from "@/lib/cachedData";
import { getLatestMeetingByLanguage, searchLanguages } from "@/lib/supabase";
import {
  ALL_STAGE_KEYS,
  clampPara,
  getStageKeysForLanguage,
  getStagesForLanguage,
  getStageMeta,
  type StageKey,
} from "@/lib/progress";
import { WEEKDAYS, computeScheduleStatus, weekdayName } from "@/lib/schedule";
import {
  getCachedEtItemRows,
  getCachedEtItemsWithStages,
} from "@/lib/etData";
import { computeCurrentStep, daysSince, effectiveWordCount, reminderInfo, stageName, typeLabel, wsbDeduction } from "@/lib/et";

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
    name: "find_language",
    description:
      "Find a language and get its id. Call this FIRST whenever the user names a language, before any other tool. Search by the language word (e.g. 'English'); results include the project so you can pick the right row when the user also named a project.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Language name or keyword, e.g. 'English', 'Chinese', 'Bangla'.",
        },
      },
      required: ["query"],
    },
  },
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
    name: "get_schedule",
    description:
      "Get the recurring WEEKLY meeting schedule — which languages are assigned to meet on each weekday, and whether each has been met this week, is due today, or is overdue. Use this for questions about who/what meetings are planned, e.g. 'who do I have a meeting with today', 'aaj kis se meeting hai', 'Monday ko kin se meeting hai', 'is hafte ka schedule'. Without a day it returns TODAY's scheduled meetings. This is NOT the same as a past meeting — for the last recorded meeting of a specific language use get_last_meeting.",
    parameters: {
      type: "object",
      properties: {
        day: {
          type: "string",
          description:
            "Optional. A weekday name (Monday, Tuesday, … Sunday) to get that day's scheduled meetings, or 'week' for the whole week grouped by day. Omit to get today's schedule.",
        },
      },
      required: [],
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
  // ---- English Translation (ET) module tools ----
  {
    name: "get_et_overview",
    description:
      "English Translation module summary: total/active/completed/unassigned work items, how many are due within 7 days, and the items stuck longest at their current step. Use for questions like 'English translation ka kya haal hai', 'how many books are in progress', 'overall English work status'. The English Translation module is a separate production pipeline (TR→IF→CM→ED→NR→ST→FF→FPR) — NOT the Quranic languages.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_et_workload",
    description:
      "Who is holding English Translation items right now. With NO person it returns each holder with their item COUNT only (use for 'kis ke paas kitne items', 'who is busiest', 'kitne item abhi kis ke paas hain'), plus total_held_items and unassigned_items. With a person name it returns that person's actual items (title, step, days_at_step, delivery) — use this when the user names a person or asks WHICH items someone has.",
    parameters: {
      type: "object",
      properties: {
        person: { type: "string", description: "Optional person name to filter to (e.g. 'Sagheer')." },
      },
      required: [],
    },
  },
  {
    name: "get_et_reminders",
    description:
      "English Translation deliveries by due date. Returns next_delivery (the single nearest upcoming item with its step + holder — use for 'next delivery konsa item / kis step par hai'), an overdue list, and a due_within list bounded by within_days (use for 'delivery 10 din se kam waale kitne items', 'is hafte kya deliver karna hai', 'kya overdue hai'). Pass within_days to match the user's window (e.g. 10).",
    parameters: {
      type: "object",
      properties: {
        within_days: { type: "integer", description: "Horizon in days for the due_within list (default 14). Set it to the number the user mentions, e.g. 10. Overdue and next_delivery are always returned regardless." },
      },
      required: [],
    },
  },
  {
    name: "find_et_item",
    description:
      "Find English Translation work item(s) by title keyword and get their id + current pipeline step. Call this FIRST when the user names a specific book/bayan/article in the English module, before get_et_item.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Keyword from the item title, e.g. 'Bahar e Dua', 'Tafseer Talimul Quran'." },
      },
      required: ["query"],
    },
  },
  {
    name: "get_et_item",
    description:
      "Full pipeline of one English Translation item: every stage (TR→FPR) with its person and sent/received dates, plus the current step/holder. Use after find_et_item when the user asks about a specific item's status.",
    parameters: {
      type: "object",
      properties: {
        item_id: { type: "string", description: "The exact id from find_et_item." },
      },
      required: ["item_id"],
    },
  },
];

// ---- Implementations ----

type ToolArgs = Record<string, unknown>;

function str(v: unknown): string | undefined {
  if (typeof v === "string" && v.trim()) return v.trim();
  return undefined;
}

async function findLanguage(args: ToolArgs) {
  const q = str(args.query);
  if (!q) return { error: "query is required." };

  // Try the whole phrase first (cheap for single words like "Chinese"); if
  // nothing matches, fall back to searching the individual words so a phrase
  // like "Sirat ul Jinan English" still surfaces the English rows.
  let matches = await searchLanguages(q);
  if (matches.length === 0) {
    const tokens = q.split(/\s+/).filter((t) => t.length > 2).slice(0, 3);
    const seen = new Set<string>();
    const merged: typeof matches = [];
    for (const t of tokens) {
      for (const r of await searchLanguages(t)) {
        if (!seen.has(r.id)) {
          seen.add(r.id);
          merged.push(r);
        }
      }
    }
    matches = merged;
  }

  if (matches.length === 0) return { matches: [], message: "No language matched that name." };

  return {
    matches: matches.slice(0, 8).map((l) => ({
      id: l.id,
      language: l.language,
      country: l.country,
      project: l.project?.name ?? null,
    })),
  };
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

async function getSchedule(args: ToolArgs) {
  const today = new Date();
  const todayName = weekdayName(today);

  const dayArg = str(args.day);
  const wantWeek = !!dayArg && /^(all|week|full|whole)/i.test(dayArg);
  const matchedDay = dayArg
    ? WEEKDAYS.find((d) => d.toLowerCase() === dayArg.toLowerCase()) ?? null
    : null;
  // No day -> today; an unrecognised, non-"week" word also falls back to today.
  const filterDay = wantWeek ? null : matchedDay ?? todayName;

  const entries = await getCachedScheduleData();
  const withStatus = entries.map((e) => ({
    e,
    status: computeScheduleStatus(e.assigned_day, e.lastMeeting, today),
  }));

  const fmt = (it: (typeof withStatus)[number]) => ({
    language: it.e.language,
    country: it.e.country,
    project: it.e.projectName,
    responsible_person: it.e.responsible_person,
    assigned_day: it.e.assigned_day,
    status: it.status.label, // "Due today" | "Met this week" | "N days overdue" | ...
    last_meeting: it.e.lastMeeting,
  });

  if (wantWeek) {
    const week: Record<string, ReturnType<typeof fmt>[]> = {};
    for (const day of WEEKDAYS) {
      week[day] = withStatus.filter((it) => it.e.assigned_day === day).map(fmt);
    }
    return { today: todayName, week };
  }

  const meetings = withStatus.filter((it) => it.e.assigned_day === filterDay).map(fmt);
  return {
    day: filterDay,
    is_today: filterDay === todayName,
    today: todayName,
    count: meetings.length,
    meetings,
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

// ---- English Translation tool implementations ----

async function getEtOverview() {
  const rows = (await getCachedEtItemRows()).filter((r) => !r.stopped);
  const active = rows.filter((r) => r.derivedStatus !== "completed");
  const dueSoon = active.filter((r) => {
    const d = reminderInfo(r).daysLeft;
    return d != null && d <= 7;
  }).length;

  const stuck = active
    .filter((r) => r.current.since)
    .sort((a, b) => new Date(a.current.since!).getTime() - new Date(b.current.since!).getTime())
    .slice(0, 5)
    .map((r) => ({
      title: r.title,
      current_step: r.current.label,
      holder: r.current.holder,
      days_at_step: daysSince(r.current.since),
    }));

  return {
    total_items: rows.length,
    active: active.length,
    completed: rows.filter((r) => r.derivedStatus === "completed").length,
    unassigned: rows.filter((r) => r.derivedStatus === "pending_assignment").length,
    due_within_7_days: dueSoon,
    longest_at_step: stuck,
  };
}

async function getEtWorkload(args: ToolArgs) {
  const person = str(args.person);
  const active = (await getCachedEtItemRows()).filter(
    (r) => !r.stopped && r.derivedStatus !== "completed"
  );
  const held = active.filter((r) => r.current.holder);

  // One person: list exactly which items they hold, with step + delivery.
  if (person) {
    const items = held
      .filter((r) => r.current.holder!.toLowerCase().includes(person.toLowerCase()))
      .map((r) => {
        const info = reminderInfo(r);
        return {
          title: r.title,
          type: typeLabel(r.type),
          current_step: r.current.label,
          days_at_step: daysSince(r.current.since),
          delivery_date: info.delivery,
          days_left: info.daysLeft,
        };
      });
    return { person, count: items.length, items };
  }

  // Everyone: just each holder with their item COUNT (kept compact so the
  // request stays within the model's per-minute token budget). To see WHICH
  // items a person holds, call again with that person's name.
  const counts = new Map<string, number>();
  for (const r of held) counts.set(r.current.holder!, (counts.get(r.current.holder!) || 0) + 1);
  const workload = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([person, active_items]) => ({ person, active_items }));

  return {
    people: workload.length,
    total_held_items: held.length,
    unassigned_items: active.filter((r) => !r.current.holder).length,
    workload,
    note: "Per-person counts only. For the actual item titles of one person, call get_et_workload with that person's name.",
  };
}

async function getEtReminders(args: ToolArgs) {
  const within = typeof args.within_days === "number" ? (args.within_days as number) : 14;
  const rows = await getCachedEtItemRows();
  const all = rows
    .filter((r) => !r.stopped && r.derivedStatus !== "completed")
    .map((r) => ({ r, info: reminderInfo(r) }))
    .filter((x) => x.info.delivery != null)
    .sort((a, b) => (a.info.daysLeft ?? 0) - (b.info.daysLeft ?? 0));

  const shape = ({ r, info }: (typeof all)[number]) => ({
    title: r.title,
    type: typeLabel(r.type),
    delivery_date: info.delivery,
    days_left: info.daysLeft,
    urgency: info.urgency,
    current_step: r.current.label,
    holder: r.current.holder,
  });

  const overdue = all.filter((x) => (x.info.daysLeft ?? 0) < 0);
  const upcoming = all.filter((x) => (x.info.daysLeft ?? 0) >= 0);
  const dueWithin = upcoming.filter((x) => (x.info.daysLeft ?? 0) <= within);

  // Cap the lists so the payload stays within the model's token budget; the
  // counts are always exact even when the lists are trimmed.
  const CAP = 15;
  return {
    within_days: within,
    // The single nearest future delivery — answers "next delivery konsa item".
    next_delivery: upcoming.length ? shape(upcoming[0]) : null,
    overdue_count: overdue.length,
    overdue: overdue.slice(0, CAP).map(shape),
    due_within_count: dueWithin.length,
    due_within: dueWithin.slice(0, CAP).map(shape),
  };
}

async function findEtItem(args: ToolArgs) {
  const q = str(args.query);
  if (!q) return { error: "query is required." };
  const ql = q.toLowerCase();
  const rows = await getCachedEtItemRows();
  const matches = rows
    .filter((r) => r.title.toLowerCase().includes(ql))
    .slice(0, 8)
    .map((r) => {
      const info = reminderInfo(r);
      return {
        id: r.id,
        title: r.title,
        type: typeLabel(r.type),
        current_step: r.current.label,
        holder: r.current.holder,
        status: r.derivedStatus,
        delivery_date: info.delivery,
        days_left: info.daysLeft,
      };
    });
  if (matches.length === 0) return { matches: [], message: "No English Translation item matched that title." };
  return { matches };
}

async function getEtItem(args: ToolArgs) {
  const id = str(args.item_id);
  if (!id) return { error: "item_id is required." };
  const items = await getCachedEtItemsWithStages();
  const item = items.find((i) => i.id === id);
  if (!item) return { error: "No item found for that id." };

  // Pass the final-email dates so an item completed by its final email shows as
  // completed (wsb completes on the SECOND final email).
  const current = computeCurrentStep(item.stages, item.final_email_date, item.final_email_date_2);
  const info = reminderInfo(item);
  return {
    title: item.title,
    type: typeLabel(item.type),
    // Net countable words (wsb has its fixed pre-translated sections removed);
    // raw_word_count keeps the real entered total when they differ.
    word_count: effectiveWordCount(item.type, item.word_count),
    ...(wsbDeduction(item.type, item.word_count) > 0
      ? { raw_word_count: item.word_count, pretranslated_deducted: wsbDeduction(item.type, item.word_count) }
      : {}),
    status: current.completed ? "completed" : current.unassigned ? "pending_assignment" : "in_progress",
    current_step: current.label,
    current_holder: current.holder,
    at_step_since: current.since,
    days_at_step: daysSince(current.since),
    progress: `${current.doneCount}/${current.totalCount}`,
    received_date: item.received_date,
    delivery_date: info.delivery,
    days_left: info.daysLeft,
    final_email_date: item.final_email_date_2 || item.final_email_date,
    stages: item.stages.map((s) => ({
      stage: stageName(s.stage),
      code: s.stage,
      person: s.person,
      sent: s.sent_date,
      received_back: s.received_back_date,
      not_applicable: s.not_applicable,
      merged: s.merged,
    })),
  };
}

/** Dispatch a tool call by name. Always resolves (errors are returned, not thrown). */
export async function executeTool(name: string, args: ToolArgs): Promise<unknown> {
  try {
    switch (name) {
      case "find_language":
        return await findLanguage(args);
      case "get_language_progress":
        return await getLanguageProgress(args);
      case "get_last_meeting":
        return await getLastMeeting(args);
      case "get_schedule":
        return await getSchedule(args);
      case "update_stage_progress":
        return await updateStageProgress(args);
      case "log_meeting":
        return await logMeeting(args);
      case "get_et_overview":
        return await getEtOverview();
      case "get_et_workload":
        return await getEtWorkload(args);
      case "get_et_reminders":
        return await getEtReminders(args);
      case "find_et_item":
        return await findEtItem(args);
      case "get_et_item":
        return await getEtItem(args);
      default:
        return { error: `Unknown tool "${name}".` };
    }
  } catch (err) {
    console.error(`Assistant tool "${name}" failed:`, err);
    return { error: "The action failed unexpectedly. Please try again." };
  }
}
