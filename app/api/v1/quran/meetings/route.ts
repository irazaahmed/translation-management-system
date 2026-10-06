import { NextResponse } from "next/server";
import { apiError, requireApiKey } from "@/lib/api/auth";
import { UUID_RE, isIsoDate, noteError, parsePaging, readJsonObject } from "@/lib/api/common";
import {
  loadLanguage,
  meetingOut,
  parseMeetingFields,
  revalidateQuran,
  scheduleInfo,
  syncLastMeetingAt,
  writeAudit,
} from "@/lib/api/quran";
import { createMeeting } from "@/lib/mutations";
import { createAdminClient } from "@/lib/supabase/admin";
import { supabase } from "@/lib/supabaseClient";
import type { Meeting } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/** GET /api/v1/quran/meetings — meetings newest first, optionally per language / date range. */
export async function GET(request: Request) {
  const auth = await requireApiKey(request, "quran:read");
  if (auth.response) return auth.response;

  const q = new URL(request.url).searchParams;
  const problems: string[] = [];
  const languageId = q.get("language_id");
  if (languageId && !UUID_RE.test(languageId)) problems.push("language_id must be a UUID.");
  const from = q.get("from");
  const to = q.get("to");
  if (from && !isIsoDate(from)) problems.push("from must be YYYY-MM-DD.");
  if (to && !isIsoDate(to)) problems.push("to must be YYYY-MM-DD.");
  const { page, limit } = parsePaging(q, problems);
  if (problems.length) return apiError(400, "Invalid query parameters.", problems);

  try {
    let query = supabase
      .from("meetings")
      .select("*, languages:language_id ( language, country )", { count: "exact" })
      .order("meeting_date", { ascending: false })
      .order("created_at", { ascending: false })
      .range((page - 1) * limit, page * limit - 1);
    if (languageId) query = query.eq("language_id", languageId);
    if (from) query = query.gte("meeting_date", `${from}T00:00:00Z`);
    if (to) query = query.lte("meeting_date", `${to}T23:59:59.999Z`);
    const { data, error, count } = await query;
    if (error) throw error;
    return NextResponse.json({
      total: count ?? 0,
      page,
      limit,
      meetings: (data || []).map((m) => meetingOut(m as unknown as Parameters<typeof meetingOut>[0])),
    });
  } catch (err) {
    console.error("GET /api/v1/quran/meetings failed:", err);
    return apiError(500, "Failed to load meetings.");
  }
}

/** POST /api/v1/quran/meetings — record a meeting (same write as the "Add meeting" form). */
export async function POST(request: Request) {
  const auth = await requireApiKey(request, "quran:write");
  if (auth.response) return auth.response;

  const body = await readJsonObject(request);
  if (!body) return apiError(400, "Body must be a JSON object.");
  const badNote = noteError(body.note);
  if (badNote) return apiError(400, badNote);
  if (typeof body.language_id !== "string" || !UUID_RE.test(body.language_id)) {
    return apiError(400, "language_id (UUID) is required.");
  }
  const parsed = parseMeetingFields(body, true);
  if ("error" in parsed) return apiError(400, parsed.error, parsed.details);
  const languageId = body.language_id;

  try {
    const admin = createAdminClient();
    if (!(await loadLanguage(admin, languageId))) return apiError(404, "Language not found.");

    const meeting = (await createMeeting(
      { language_id: languageId, ...parsed.fields, meeting_date: parsed.fields.meeting_date! },
      admin
    )) as Meeting;
    await syncLastMeetingAt(admin, languageId);

    revalidateQuran(languageId);
    const note = typeof body.note === "string" ? body.note : null;
    await writeAudit(admin, auth.key, {
      languageId,
      action: "quran.meeting.create",
      request: { ...body, note: undefined, meeting_id: meeting.id },
      note,
    });

    const lang = (await loadLanguage(admin, languageId))!;
    return NextResponse.json(
      { ok: true, note, meeting: meetingOut(meeting), language: { id: lang.id, language: lang.language, ...scheduleInfo(lang, lang.last_meeting_at) } },
      { status: 201 }
    );
  } catch (err) {
    console.error("POST /api/v1/quran/meetings failed:", err);
    return apiError(500, "Failed to record the meeting.");
  }
}
