import { NextResponse } from "next/server";
import { apiError, requireApiKey } from "@/lib/api/auth";
import { CATEGORY_SLUGS, categorySlug } from "@/lib/api/items";
import { getCachedEtPeople } from "@/lib/etData";
import { CATEGORY_LABELS, STAGE_BY_CODE, TYPE_LABELS, stagesForType, type StageCode } from "@/lib/et";

export const dynamic = "force-dynamic";

/** GET /api/v1/meta — stage codes, per-type pipelines, types, categories, holders. */
export async function GET(request: Request) {
  const auth = await requireApiKey(request, "items:read");
  if (auth.response) return auth.response;

  try {
    const people = await getCachedEtPeople();
    return NextResponse.json({
      stages: (Object.keys(STAGE_BY_CODE) as StageCode[]).map((code) => ({
        code,
        name: STAGE_BY_CODE[code].name,
      })),
      types: Object.entries(TYPE_LABELS).map(([code, label]) => ({
        code,
        label,
        category: categorySlug(code),
        pipeline: stagesForType(code).map((s) => s.code),
      })),
      categories: Object.entries(CATEGORY_SLUGS).map(([slug, cat]) => ({ slug, label: CATEGORY_LABELS[cat] })),
      holders: people.map((p) => ({ name: p.name, active: p.active })),
    });
  } catch (err) {
    console.error("GET /api/v1/meta failed:", err);
    return apiError(500, "Failed to load metadata.");
  }
}
