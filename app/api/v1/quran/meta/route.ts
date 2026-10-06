import { NextResponse } from "next/server";
import { apiError, requireApiKey } from "@/lib/api/auth";
import { PRIORITIES, WORK_STATUSES } from "@/lib/api/quran";
import { getCachedProjects } from "@/lib/cachedData";
import { getCachedQuranPeople } from "@/lib/paraProgressData";
import { ALL_STAGE_KEYS, TOTAL_PARAS, getStageMeta, getStagesForLanguage } from "@/lib/progress";
import { WEEKDAYS } from "@/lib/schedule";

export const dynamic = "force-dynamic";

/** GET /api/v1/quran/meta — stages, pipelines (standard vs Braille), enums, workforce, projects. */
export async function GET(request: Request) {
  const auth = await requireApiKey(request, "quran:read");
  if (auth.response) return auth.response;

  try {
    const [people, projects] = await Promise.all([getCachedQuranPeople(), getCachedProjects()]);
    const pipeline = (name: string) => getStagesForLanguage(name).map((s) => ({ stage: s.key, label: s.label }));
    return NextResponse.json({
      total_paras: TOTAL_PARAS,
      stages: ALL_STAGE_KEYS.map((key) => ({ stage: key, label: getStageMeta(key).label })),
      pipelines: {
        standard: pipeline(""),
        braille: pipeline("Braille"),
      },
      braille_rule: 'A language uses the Braille pipeline when its name contains "braille" (case-insensitive).',
      ordering_rule:
        "Comparison can't be ahead of Translation, and no other stage can be ahead of either of them (by paras finished).",
      work_statuses: WORK_STATUSES,
      priorities: PRIORITIES,
      weekdays: WEEKDAYS,
      workforce: people.map((p) => ({ id: p.id, name: p.name, active: p.active })),
      projects: projects.map((p) => ({ id: p.id, name: p.name })),
    });
  } catch (err) {
    console.error("GET /api/v1/quran/meta failed:", err);
    return apiError(500, "Failed to load metadata.");
  }
}
