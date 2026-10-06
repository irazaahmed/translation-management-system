import { NextResponse } from "next/server";
import { apiError, requireApiKey } from "@/lib/api/auth";
import { UUID_RE, noteError, readJsonObject } from "@/lib/api/common";
import {
  loadLanguage,
  meetingOut,
  parseMeetingFields,
  revalidateQuran,
  scheduleInfo,
  syncLastMeetingAt,
  writeAudit,
} from "@/lib/api/quran";
import { updateMeeting } from "@/lib/mutations";
import { createAdminClient } from "@/lib/supabase/admin";
import { supabase } from "@/lib/supabaseClient";
import type { Meeting } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/v1/quran/meetings/:id — one meeting record. */
export async function GET(request: Request, { params }: Ctx) {
  const auth = await requireApiKey(request, "quran:read");
  if (auth.response) return auth.response;

  const { id } = await params;
  if (!UUID_RE.test(id)) return apiError(400, "Meeting id must be a UUID.");
  try {
    const { data, error } = await supabase
      .from("meetings")
      .select("*, languages:language_id ( language, country )")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return apiError(404, "Meeting not found.");
    return NextResponse.json(meetingOut(data as unknown as Parameters<typeof meetingOut>[0]));
  } catch (err) {
    console.error("GET /api/v1/quran/meetings/[id] failed:", err);
    return apiError(500, "Failed to load meeting.");
  }
}

/** PATCH /api/v1/quran/meetings/:id — edit a meeting (same write as the edit form). */
export async function PATCH(request: Request, { params }: Ctx) {
  const auth = await requireApiKey(request, "quran:write");
  if (auth.response) return auth.response;

  const { id } = await params;
  if (!UUID_RE.test(id)) return apiError(400, "Meeting id must be a UUID.");
  const body = await readJsonObject(request);
  if (!body) return apiError(400, "Body must be a JSON object.");
  const badNote = noteError(body.note);
  if (badNote) return apiError(400, badNote);
  const parsed = parseMeetingFields(body, false);
  if ("error" in parsed) return apiError(400, parsed.error, parsed.details);

  try {
    const admin = createAdminClient();
    const { data: existing, error } = await admin.from("meetings").select("id, language_id").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!existing) return apiError(404, "Meeting not found.");
    const languageId = existing.language_id as string;

    const meeting = (await updateMeeting(id, parsed.fields, admin)) as Meeting;
    await syncLastMeetingAt(admin, languageId);

    revalidateQuran(languageId);
    const note = typeof body.note === "string" ? body.note : null;
    await writeAudit(admin, auth.key, {
      languageId,
      action: "quran.meeting.patch",
      request: { ...body, note: undefined, meeting_id: id },
      note,
    });

    const lang = (await loadLanguage(admin, languageId))!;
    return NextResponse.json({
      ok: true,
      note,
      meeting: meetingOut(meeting),
      language: { id: lang.id, language: lang.language, ...scheduleInfo(lang, lang.last_meeting_at) },
    });
  } catch (err) {
    console.error("PATCH /api/v1/quran/meetings/[id] failed:", err);
    return apiError(500, "Failed to update the meeting.");
  }
}
