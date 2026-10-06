import { NextResponse } from "next/server";
import { apiError, requireApiKey } from "@/lib/api/auth";
import { scheduleInfo } from "@/lib/api/quran";
import { getCachedScheduleData } from "@/lib/cachedData";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/quran/schedule — the weekly meeting schedule (same data as the
 * /schedule page): every in-progress language, most overdue first.
 */
export async function GET(request: Request) {
  const auth = await requireApiKey(request, "quran:read");
  if (auth.response) return auth.response;

  try {
    const now = new Date();
    const rows = (await getCachedScheduleData()).map((e) => ({
      id: e.id,
      language: e.language,
      country: e.country,
      responsible_person: e.responsible_person,
      project: e.project_id ? { id: e.project_id, name: e.projectName } : null,
      ...scheduleInfo(e, e.lastMeeting, now),
      next_scheduled_meeting: e.nextMeeting ? e.nextMeeting.slice(0, 10) : null,
    }));
    // Never-met first, then the longest since the last meeting.
    rows.sort(
      (a, b) =>
        (b.days_since_last_meeting ?? Infinity) - (a.days_since_last_meeting ?? Infinity) ||
        a.language.localeCompare(b.language)
    );
    return NextResponse.json({ total: rows.length, schedule: rows });
  } catch (err) {
    console.error("GET /api/v1/quran/schedule failed:", err);
    return apiError(500, "Failed to load the schedule.");
  }
}
