import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath, revalidateTag } from "next/cache";
import {
  QURAN_CACHE_TAG,
  TOTAL_PARAS,
  buildParaCells,
  buildParaCountRows,
  buildStageMapFromParaRows,
  computePipelinePercent,
  getStageKeysForLanguage,
  getStagesForLanguage,
  isBrailleLanguage,
  stagePercent,
  type ParaCell,
  type ParaRow,
  type StageKey,
} from "@/lib/progress";
import { WEEKDAYS, computeScheduleStatus, nextOccurrenceOf, type Weekday } from "@/lib/schedule";
import type { ParaStageRowInput } from "@/lib/paraProgressMutations";
import type { CreateLanguageInput, Language, Meeting, UpdateLanguageInput } from "@/lib/supabase";
import { isIsoDate, todayPk } from "./common";

/**
 * Shared shaping/validation for the Quranic part of the REST API
 * (/api/v1/quran). Every rule comes from the same modules the web UI uses —
 * lib/progress.ts (stages, Braille pipeline, "paras reached" rows),
 * lib/schedule.ts (weekly cadence) — so nothing is re-implemented here.
 */

export const WORK_STATUSES = ["not_started", "in_progress", "completed"] as const;
export const PRIORITIES = ["low", "medium", "high"] as const;

/** Text fields on a meeting record (all optional, nullable). */
export const MEETING_TEXT_FIELDS = [
  "meeting_type",
  "participants",
  "discussion_points",
  "translation_progress",
  "action_items",
  "meeting_notes",
] as const;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days between two dates, ignoring time of day (same as lib/schedule.ts). */
function daysBetween(from: Date, to: Date): number {
  const a = new Date(from);
  a.setHours(0, 0, 0, 0);
  const b = new Date(to);
  b.setHours(0, 0, 0, 0);
  return Math.round((b.getTime() - a.getTime()) / DAY_MS);
}

function ymd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** First 10 chars of a timestamp/date, or null. */
function dateOnly(v: string | null | undefined): string | null {
  return v ? v.slice(0, 10) : null;
}

// ============================================================
// Schedule / attention
// ============================================================

/**
 * Where a language stands on its weekly meeting cadence. `needs_attention`
 * matches the dashboard's "Needs Attention" count: an in-progress language
 * with no meeting in the last 14 days (or never).
 */
export function scheduleInfo(
  lang: { work_status: string; assigned_day: string | null },
  lastMeeting: string | null,
  now: Date = new Date()
) {
  const status = computeScheduleStatus(lang.assigned_day, lastMeeting, now);
  const daysSince = lastMeeting ? daysBetween(new Date(lastMeeting), now) : null;
  const fourteenDaysAgo = new Date(now.getTime() - 14 * DAY_MS);
  const needsAttention =
    lang.work_status === "in_progress" && (!lastMeeting || new Date(lastMeeting) < fourteenDaysAgo);
  const day = lang.assigned_day && WEEKDAYS.includes(lang.assigned_day as Weekday) ? (lang.assigned_day as Weekday) : null;
  const nextExpected = !day ? null : status.state === "today" ? ymd(now) : ymd(nextOccurrenceOf(day, now));
  return {
    assigned_day: lang.assigned_day,
    last_meeting_at: dateOnly(lastMeeting),
    days_since_last_meeting: daysSince,
    schedule_state: status.state,
    schedule_label: status.label,
    next_expected_meeting: nextExpected,
    needs_attention: needsAttention,
  };
}

// ============================================================
// Para progress
// ============================================================

function stageSummaries(languageName: string, rows: ParaRow[]) {
  const keys = getStageKeysForLanguage(languageName);
  const map = buildStageMapFromParaRows(rows, keys);
  const stages = getStagesForLanguage(languageName).map((m) => ({
    stage: m.key,
    label: m.label,
    paras_finished: map[m.key].current_para,
    paras_in_progress: rows.filter((r) => r.stage === m.key && r.startedAt && !r.finishedAt).length,
    percent: stagePercent(map[m.key].current_para),
    last_activity: map[m.key].since_date,
  }));
  return { stages, pipelinePercent: computePipelinePercent(map, keys), finished: map[keys[keys.length - 1]].current_para };
}

/** Compact list row for GET /quran/languages. */
export function languageListRow(lang: Language, projectName: string | null, rows: ParaRow[], now = new Date()) {
  const { stages, pipelinePercent, finished } = stageSummaries(lang.language, rows);
  return {
    id: lang.id,
    language: lang.language,
    country: lang.country,
    braille: isBrailleLanguage(lang.language),
    responsible_person: lang.responsible_person,
    priority: lang.priority,
    work_status: lang.work_status,
    project: lang.project_id ? { id: lang.project_id, name: projectName } : null,
    pipeline_percent: pipelinePercent,
    paras_fully_finished: finished,
    stages: stages.map(({ stage, label, paras_finished, percent }) => ({ stage, label, paras_finished, percent })),
    ...scheduleInfo(lang, lang.last_meeting_at, now),
  };
}

function meetingOut(m: Meeting & { next_action?: string | null; languages?: { language: string; country: string } | null }) {
  return {
    id: m.id,
    language_id: m.language_id,
    ...(m.languages ? { language: m.languages.language, country: m.languages.country } : {}),
    meeting_date: dateOnly(m.meeting_date),
    meeting_type: m.meeting_type,
    participants: m.participants,
    discussion_points: m.discussion_points,
    translation_progress: m.translation_progress,
    progress_percentage: m.progress_percentage,
    action_items: m.action_items,
    next_action: m.next_action ?? null,
    next_meeting_date: dateOnly(m.next_meeting_date),
    meeting_notes: m.meeting_notes,
    created_at: m.created_at,
    updated_at: m.updated_at,
  };
}
export { meetingOut };

/** Full detail for GET /quran/languages/{id} (and write responses). */
export function languageDetail(
  lang: Language,
  projectName: string | null,
  rows: ParaRow[],
  meetings: Meeting[],
  now = new Date()
) {
  const { stages, pipelinePercent, finished } = stageSummaries(lang.language, rows);
  const today = ymd(now);
  const upcoming = meetings
    .map((m) => dateOnly(m.next_meeting_date))
    .filter((d): d is string => !!d && d >= today)
    .sort()[0] ?? null;
  return {
    id: lang.id,
    language: lang.language,
    country: lang.country,
    braille: isBrailleLanguage(lang.language),
    responsible_person: lang.responsible_person,
    priority: lang.priority,
    work_status: lang.work_status,
    project: lang.project_id ? { id: lang.project_id, name: projectName } : null,
    pipeline: getStageKeysForLanguage(lang.language),
    pipeline_percent: pipelinePercent,
    paras_fully_finished: finished,
    ...scheduleInfo(lang, lang.last_meeting_at, now),
    next_scheduled_meeting: upcoming,
    stages: stages.map((s) => ({
      ...s,
      paras: buildParaCells(rows, s.stage).map((c) => ({
        para: c.paraNumber,
        status: c.status,
        person_id: c.personId,
        person: c.personName,
        started_at: c.startedAt,
        finished_at: c.finishedAt,
      })),
    })),
    meetings: [...meetings]
      .sort((a, b) => (b.meeting_date ?? "").localeCompare(a.meeting_date ?? "") || b.created_at.localeCompare(a.created_at))
      .map(meetingOut),
    created_at: lang.created_at,
    updated_at: lang.updated_at,
  };
}

// ============================================================
// Fresh (uncached) loads for the write path
// ============================================================

const LANGUAGE_COLUMNS =
  "id, country, language, responsible_person, priority, work_status, last_meeting_at, assigned_day, project_id, created_at, updated_at, projects:project_id ( name )";

export type LanguageWithProject = Language & { projects: { name: string } | null };

export async function loadLanguage(client: SupabaseClient, id: string): Promise<LanguageWithProject | null> {
  const { data, error } = await client.from("languages").select(LANGUAGE_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as unknown as LanguageWithProject) ?? null;
}

export async function loadParaRows(client: SupabaseClient, languageId: string): Promise<ParaRow[]> {
  const { data, error } = await client
    .from("para_progress")
    .select("stage, para_number, person_id, started_at, finished_at, notes, quran_people(name)")
    .eq("language_id", languageId);
  if (error) throw error;
  return ((data || []) as unknown as {
    stage: StageKey;
    para_number: number;
    person_id: string | null;
    started_at: string | null;
    finished_at: string | null;
    notes: string | null;
    quran_people: { name: string } | null;
  }[]).map((r) => ({
    stage: r.stage,
    paraNumber: r.para_number,
    personId: r.person_id,
    personName: r.quran_people?.name ?? null,
    startedAt: r.started_at,
    finishedAt: r.finished_at,
    notes: r.notes,
  }));
}

export async function loadMeetings(client: SupabaseClient, languageId: string): Promise<Meeting[]> {
  const { data, error } = await client
    .from("meetings")
    .select("*")
    .eq("language_id", languageId)
    .order("meeting_date", { ascending: false });
  if (error) throw error;
  return (data || []) as Meeting[];
}

/** Full detail straight from the DB (used after a write). */
export async function loadLanguageDetailFresh(client: SupabaseClient, id: string) {
  const [lang, rows, meetings] = await Promise.all([
    loadLanguage(client, id),
    loadParaRows(client, id),
    loadMeetings(client, id),
  ]);
  return lang ? languageDetail(lang, lang.projects?.name ?? null, rows, meetings) : null;
}

/**
 * Keep languages.last_meeting_at equal to the latest meeting_date. The DB
 * trigger copies the *written* meeting's date, which is wrong when an older
 * meeting is added or edited, so the API re-syncs to the true maximum.
 */
export async function syncLastMeetingAt(client: SupabaseClient, languageId: string): Promise<void> {
  const { data, error } = await client
    .from("meetings")
    .select("meeting_date")
    .eq("language_id", languageId)
    .order("meeting_date", { ascending: false })
    .limit(1);
  if (error) throw error;
  const latest = data?.[0]?.meeting_date ?? null;
  const { error: upErr } = await client.from("languages").update({ last_meeting_at: latest }).eq("id", languageId);
  if (upErr) throw upErr;
}

// ============================================================
// Cache / audit
// ============================================================

/** Drop the same caches the UI's server actions drop after a Quranic change. */
export function revalidateQuran(languageId?: string) {
  revalidateTag(QURAN_CACHE_TAG, { expire: 0 });
  for (const p of ["/", "/languages", "/meetings", "/schedule", "/progress", "/progress/people", "/reports/paras"]) {
    revalidatePath(p);
  }
  if (languageId) {
    revalidatePath(`/languages/${languageId}`);
    revalidatePath(`/progress/${languageId}`);
  }
}

export async function writeAudit(
  client: SupabaseClient,
  key: { id: string; name: string },
  /** languageId = the affected record (a language, or a workforce member for quran.person.* actions). */
  entry: { languageId: string | null; action: string; request: unknown; note: string | null }
) {
  const { error } = await client.from("api_audit_log").insert({
    key_id: key.id,
    key_name: key.name,
    item_id: entry.languageId,
    action: entry.action,
    request: entry.request,
    note: entry.note,
  });
  if (error) console.error("api_audit_log insert failed:", error.message);
}

// ============================================================
// PATCH /quran/languages/{id} — validation + planning
// ============================================================

const LANGUAGE_PATCH_KEYS = new Set([
  "language",
  "responsible_person",
  "priority",
  "work_status",
  "country",
  "assigned_day",
  "para_progress",
  "note",
]);

export interface LanguagePatchPlan {
  meta: UpdateLanguageInput | null;
  /** Changed para rows per stage, ready for saveParaStage(). */
  paraWrites: { stage: StageKey; rows: ParaStageRowInput[] }[];
  /** finished-para count per stage, before → after (touched stages only). */
  counts: Record<string, { before: number; after: number }>;
}

type PlanResult = { plan: LanguagePatchPlan } | { error: string; details?: unknown };

function finishedCount(cells: ParaCell[]): number {
  return cells.filter((c) => c.finishedAt).length;
}

/**
 * Validate a PATCH body against the language's current (fresh) state and turn
 * it into writes. Nothing is written here; if anything is invalid the caller
 * gets every problem at once.
 */
export function planLanguagePatch(
  lang: Language,
  rows: ParaRow[],
  body: Record<string, unknown>,
  personIds: Set<string>
): PlanResult {
  const problems: string[] = [];
  const unknown = Object.keys(body).filter((k) => !LANGUAGE_PATCH_KEYS.has(k));
  if (unknown.length) {
    return {
      error: "Unknown field(s).",
      details: [`Unknown: ${unknown.join(", ")}. Allowed: ${[...LANGUAGE_PATCH_KEYS].join(", ")}.`],
    };
  }

  // ---- meta ----
  const meta: UpdateLanguageInput = {};
  if ("language" in body) {
    const v = body.language;
    if (typeof v === "string" && v.trim() && v.trim().length <= 100) meta.language = v.trim();
    else problems.push("language must be a non-empty string (max 100).");
    // A rename can switch the pipeline (e.g. adding "Braille"), so keep it
    // separate from para edits, which are checked against the current pipeline.
    if ("para_progress" in body) problems.push("Rename the language in its own request, not together with para_progress.");
  }
  if ("responsible_person" in body) {
    const v = body.responsible_person;
    if (v === null || v === "") meta.responsible_person = null;
    else if (typeof v === "string" && v.trim().length <= 200) meta.responsible_person = v.trim();
    else problems.push("responsible_person must be a string (max 200) or null.");
  }
  if ("priority" in body) {
    const v = body.priority;
    if (v === null) meta.priority = null;
    else if (PRIORITIES.includes(v as (typeof PRIORITIES)[number])) meta.priority = v as Language["priority"];
    else problems.push(`priority must be one of ${PRIORITIES.join(", ")} or null.`);
  }
  if ("work_status" in body) {
    const v = body.work_status;
    if (WORK_STATUSES.includes(v as (typeof WORK_STATUSES)[number])) meta.work_status = v as Language["work_status"];
    else problems.push(`work_status must be one of ${WORK_STATUSES.join(", ")}.`);
  }
  if ("country" in body) {
    const v = body.country;
    if (typeof v === "string" && v.trim()) meta.country = v.trim();
    else problems.push("country must be a non-empty string.");
  }
  if ("assigned_day" in body) {
    const v = body.assigned_day;
    const day = typeof v === "string" ? WEEKDAYS.find((d) => d.toLowerCase() === v.trim().toLowerCase()) : undefined;
    if (v === null || v === "") meta.assigned_day = null;
    else if (day) meta.assigned_day = day;
    else problems.push(`assigned_day must be one of ${WEEKDAYS.join(", ")} or null.`);
  }

  // ---- para progress ----
  const stageKeys = getStageKeysForLanguage(lang.language);
  const original = new Map<StageKey, ParaCell[]>(stageKeys.map((k) => [k, buildParaCells(rows, k)]));
  const working = new Map<StageKey, ParaCell[]>(stageKeys.map((k) => [k, original.get(k)!.map((c) => ({ ...c }))]));
  const touched = new Set<StageKey>();

  if ("para_progress" in body) {
    const list = body.para_progress;
    if (!Array.isArray(list) || list.length === 0 || list.length > 20) {
      problems.push("para_progress must be a non-empty array (max 20).");
    } else {
      list.forEach((raw, i) => {
        const at = `para_progress[${i}]`;
        if (!raw || typeof raw !== "object") return void problems.push(`${at} must be an object.`);
        const e = raw as Record<string, unknown>;
        const stage = e.stage as StageKey;
        if (typeof e.stage !== "string" || !stageKeys.includes(stage)) {
          return void problems.push(
            `${at}.stage "${String(e.stage)}" is not a stage of ${lang.language} (${stageKeys.join(", ")}).`
          );
        }
        const cells = working.get(stage)!;

        if ("paras_finished" in e) {
          // "Para reached" — exactly what the progress editor's Save does.
          const n = e.paras_finished;
          if (!Number.isInteger(n) || (n as number) < 0 || (n as number) > TOTAL_PARAS) {
            return void problems.push(`${at}.paras_finished must be an integer 0-${TOTAL_PARAS}.`);
          }
          const date = e.date === undefined ? todayPk() : e.date;
          if (!isIsoDate(date)) return void problems.push(`${at}.date must be YYYY-MM-DD.`);
          const current = finishedCount(cells);
          if ((n as number) < current && e.allow_decrease !== true) {
            return void problems.push(
              `${at}: ${stage} already has ${current} paras finished; lowering it to ${n} clears paras ${(n as number) + 1}-${current}. Send "allow_decrease": true to do that.`
            );
          }
          const next = buildParaCountRows(cells, n as number, date);
          next.forEach((r, idx) => Object.assign(cells[idx], r));
          touched.add(stage);
          return;
        }

        if ("para" in e) {
          const para = e.para;
          if (!Number.isInteger(para) || (para as number) < 1 || (para as number) > TOTAL_PARAS) {
            return void problems.push(`${at}.para must be an integer 1-${TOTAL_PARAS}.`);
          }
          const cell = cells[(para as number) - 1];
          const edits = ["person_id", "started_at", "finished_at"].filter((f) => f in e);
          if (edits.length === 0) {
            return void problems.push(`${at} has nothing to change (person_id / started_at / finished_at).`);
          }
          if ("person_id" in e) {
            const v = e.person_id;
            if (v === null) cell.personId = null;
            else if (typeof v === "string" && personIds.has(v)) cell.personId = v;
            else return void problems.push(`${at}.person_id is not a workforce member (see GET /api/v1/quran/meta).`);
          }
          for (const [field, prop] of [["started_at", "startedAt"], ["finished_at", "finishedAt"]] as const) {
            if (!(field in e)) continue;
            const v = e[field];
            if (v === null) cell[prop] = null;
            else if (isIsoDate(v)) cell[prop] = v;
            else return void problems.push(`${at}.${field} must be YYYY-MM-DD or null.`);
          }
          if (cell.startedAt && cell.finishedAt && cell.startedAt > cell.finishedAt) {
            return void problems.push(`${at}: started_at is after finished_at.`);
          }
          touched.add(stage);
          return;
        }

        problems.push(`${at} needs either "paras_finished" or "para".`);
      });
    }
  }

  // ---- ordering rule (lib/progress.ts) ----
  // Comparison can't be ahead of Translation, and no other stage can be ahead
  // of either of them. Only checked where this request touches the stages
  // involved, so an old inconsistency elsewhere doesn't block unrelated edits.
  if (touched.size > 0) {
    const count = (k: StageKey) => finishedCount(working.get(k) ?? []);
    const t = count("translation");
    const c = count("comparison");
    const firstTouched = touched.has("translation") || touched.has("comparison");
    if (firstTouched && c > t) {
      problems.push(`Comparison (${c} paras) can't be ahead of Translation (${t} paras).`);
    }
    for (const k of stageKeys) {
      if (k === "translation" || k === "comparison") continue;
      if (!(firstTouched || touched.has(k))) continue;
      const n = count(k);
      if (n > Math.min(t, c)) {
        problems.push(
          `${k} (${n} paras) can't be ahead of Translation (${t}) or Comparison (${c}).`
        );
      }
    }
  }

  if (problems.length) return { error: "Invalid request.", details: problems };

  const paraWrites: LanguagePatchPlan["paraWrites"] = [];
  const counts: LanguagePatchPlan["counts"] = {};
  for (const stage of touched) {
    const before = original.get(stage)!;
    const after = working.get(stage)!;
    const changed = after.filter((c, i) => {
      const b = before[i];
      return b.personId !== c.personId || b.startedAt !== c.startedAt || b.finishedAt !== c.finishedAt;
    });
    counts[stage] = { before: finishedCount(before), after: finishedCount(after) };
    if (changed.length) {
      paraWrites.push({
        stage,
        rows: changed.map((c) => ({
          paraNumber: c.paraNumber,
          personId: c.personId,
          startedAt: c.startedAt,
          finishedAt: c.finishedAt,
        })),
      });
    }
  }

  const hasMeta = Object.keys(meta).length > 0;
  if (!hasMeta && touched.size === 0) {
    return { error: "Nothing to change. Send meta fields and/or para_progress." };
  }
  return { plan: { meta: hasMeta ? meta : null, paraWrites, counts } };
}

// ============================================================
// Meetings — body validation (POST + PATCH)
// ============================================================

const MEETING_KEYS = new Set<string>([
  "language_id",
  "meeting_date",
  "progress_percentage",
  "next_meeting_date",
  "note",
  ...MEETING_TEXT_FIELDS,
]);

export type MeetingFields = {
  meeting_date?: string;
  progress_percentage?: number | null;
  next_meeting_date?: string | null;
} & Partial<Record<(typeof MEETING_TEXT_FIELDS)[number], string | null>>;

/**
 * Validate meeting fields. `creating` makes meeting_date default to today
 * (Pakistan time); on edit only sent fields are returned.
 */
export function parseMeetingFields(
  body: Record<string, unknown>,
  creating: boolean
): { fields: MeetingFields } | { error: string; details?: unknown } {
  const problems: string[] = [];
  const unknown = Object.keys(body).filter((k) => !MEETING_KEYS.has(k) || (!creating && k === "language_id"));
  if (unknown.length) problems.push(`Unknown or read-only field(s): ${unknown.join(", ")}.`);

  const fields: MeetingFields = {};
  if ("meeting_date" in body || creating) {
    const v = body.meeting_date === undefined ? todayPk() : body.meeting_date;
    // Stored like the UI does: new Date("YYYY-MM-DD").toISOString().
    if (isIsoDate(v)) fields.meeting_date = new Date(v).toISOString();
    else problems.push("meeting_date must be YYYY-MM-DD.");
  }
  if ("next_meeting_date" in body) {
    const v = body.next_meeting_date;
    if (v === null || v === "") fields.next_meeting_date = null;
    else if (isIsoDate(v)) fields.next_meeting_date = v;
    else problems.push("next_meeting_date must be YYYY-MM-DD or null.");
  }
  if ("progress_percentage" in body) {
    const v = body.progress_percentage;
    if (v === null) fields.progress_percentage = null;
    else if (Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 100) fields.progress_percentage = v as number;
    else problems.push("progress_percentage must be an integer 0-100 or null.");
  }
  for (const f of MEETING_TEXT_FIELDS) {
    if (!(f in body)) continue;
    const v = body[f];
    if (v === null || v === "") fields[f] = null;
    else if (typeof v === "string" && v.length <= 5000) fields[f] = v.trim() || null;
    else problems.push(`${f} must be a string (max 5000) or null.`);
  }
  if (problems.length) return { error: "Invalid request.", details: problems };
  if (!creating && Object.keys(fields).length === 0) return { error: "Nothing to change." };
  return { fields };
}

// ============================================================
// POST /quran/languages — same rules as the "Add language" form
// ============================================================

const NEW_LANGUAGE_KEYS = new Set([
  "language",
  "country",
  "project",
  "responsible_person",
  "priority",
  "work_status",
  "assigned_day",
  "note",
]);

/**
 * Validate a new language: language, country and project are required
 * (project by id or name, as listed in GET /quran/meta); the rest optional.
 * createLanguage() itself rejects a duplicate language+country in a project.
 */
export function parseNewLanguage(
  body: Record<string, unknown>,
  projects: { id: string; name: string }[]
): { input: CreateLanguageInput } | { error: string; details?: unknown } {
  const problems: string[] = [];
  const unknown = Object.keys(body).filter((k) => !NEW_LANGUAGE_KEYS.has(k));
  if (unknown.length) problems.push(`Unknown field(s): ${unknown.join(", ")}.`);
  const str = (k: string, max: number) => (typeof body[k] === "string" && (body[k] as string).trim() && (body[k] as string).trim().length <= max ? (body[k] as string).trim() : null);

  const language = str("language", 100);
  if (!language) problems.push("language is required (max 100).");
  const country = str("country", 100);
  if (!country) problems.push("country is required (max 100).");
  const projRaw = typeof body.project === "string" ? body.project.trim().toLowerCase() : "";
  const project = projects.find((p) => p.id === projRaw || p.name.toLowerCase() === projRaw);
  if (!project) problems.push(`project is required: one of ${projects.map((p) => `"${p.name}"`).join(", ")} (name or id).`);

  // Reuse the PATCH validators for the optional fields.
  const optional = Object.fromEntries(
    ["responsible_person", "priority", "work_status", "assigned_day"].filter((k) => k in body).map((k) => [k, body[k]])
  );
  const planned = planLanguagePatch(
    { language: language ?? "" } as Language,
    [],
    optional,
    new Set()
  );
  let meta: UpdateLanguageInput = {};
  if ("error" in planned) {
    if (planned.error !== "Nothing to change. Send meta fields and/or para_progress.") {
      problems.push(...((planned.details as string[] | undefined) ?? [planned.error]));
    }
  } else meta = planned.plan.meta ?? {};

  if (problems.length) return { error: "Invalid request.", details: problems };
  return {
    input: {
      language: language!,
      country: country!,
      project_id: project!.id,
      responsible_person: meta.responsible_person ?? null,
      priority: meta.priority ?? null,
      work_status: meta.work_status ?? "not_started",
      assigned_day: meta.assigned_day ?? null,
    },
  };
}

// ============================================================
// Quran workforce (quran_people)
// ============================================================

export function parseQuranPerson(
  body: Record<string, unknown>,
  current: { name: string; active: boolean; notes: string | null } | null
): { input: { name: string; active: boolean; notes: string | null } } | { error: string; details?: unknown } {
  const problems: string[] = [];
  const unknown = Object.keys(body).filter((k) => !["name", "active", "notes", "note"].includes(k));
  if (unknown.length) problems.push(`Unknown field(s): ${unknown.join(", ")}. (Use "notes" for the person's notes, "note" for the audit note.)`);
  const out = current ? { ...current } : { name: "", active: true, notes: null as string | null };
  if ("name" in body || !current) {
    const n = typeof body.name === "string" ? body.name.trim() : "";
    if (!n || n.length > 120) problems.push("name is required (max 120).");
    else out.name = n;
  }
  if ("active" in body) {
    if (typeof body.active === "boolean") out.active = body.active;
    else problems.push("active must be true or false.");
  }
  if ("notes" in body) {
    const v = body.notes;
    if (v === null || v === "") out.notes = null;
    else if (typeof v === "string" && v.length <= 1000) out.notes = v.trim();
    else problems.push("notes must be a string (max 1000) or null.");
  }
  if (current && Object.keys(body).filter((k) => k !== "note").length === 0) problems.push("Nothing to change.");
  if (problems.length) return { error: "Invalid request.", details: problems };
  return { input: out };
}
