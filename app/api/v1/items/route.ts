import { NextResponse } from "next/server";
import { apiError, requireApiKey } from "@/lib/api/auth";
import { CATEGORY_SLUGS, isStageCode, listItem } from "@/lib/api/items";
import { getCachedEtItemRows, type EtItemRow } from "@/lib/etData";
import { TYPE_LABELS, itemCategory } from "@/lib/et";

export const dynamic = "force-dynamic";

const STATUSES = ["active", "completed", "stopped"];
const SORTS = ["at-step-since", "delivery-date"];

/** Oldest first; rows without the date go last. */
function byDate(pick: (r: EtItemRow) => string | null) {
  return (a: EtItemRow, b: EtItemRow) => (pick(a) ?? "9999").localeCompare(pick(b) ?? "9999");
}

/** GET /api/v1/items — filtered, sorted, paginated work-item list. */
export async function GET(request: Request) {
  const auth = await requireApiKey(request, "items:read");
  if (auth.response) return auth.response;

  const q = new URL(request.url).searchParams;
  const problems: string[] = [];

  const category = q.get("category");
  if (category && !(category in CATEGORY_SLUGS)) {
    problems.push(`category must be one of: ${Object.keys(CATEGORY_SLUGS).join(", ")}.`);
  }
  const status = q.get("status");
  if (status && !STATUSES.includes(status)) problems.push(`status must be one of: ${STATUSES.join(", ")}.`);
  const type = q.get("type")?.toLowerCase() ?? null;
  if (type && !(type in TYPE_LABELS)) {
    problems.push(`type must be one of: ${Object.keys(TYPE_LABELS).join(", ")}.`);
  }
  const stage = q.get("stage")?.toUpperCase() ?? null;
  if (stage && !isStageCode(stage)) problems.push(`Unknown stage code "${q.get("stage")}".`);
  const sort = q.get("sort");
  if (sort && !SORTS.includes(sort)) problems.push(`sort must be one of: ${SORTS.join(", ")}.`);
  const page = q.has("page") ? Number(q.get("page")) : 1;
  const limit = q.has("limit") ? Number(q.get("limit")) : 50;
  if (!Number.isInteger(page) || page < 1) problems.push("page must be an integer >= 1.");
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) problems.push("limit must be an integer 1-200.");
  if (problems.length) return apiError(400, "Invalid query parameters.", problems);

  const holder = q.get("holder")?.trim().toLowerCase() || null;

  try {
    let rows = (await getCachedEtItemRows()).filter((r) => {
      if (category && itemCategory(r.type) !== CATEGORY_SLUGS[category]) return false;
      if (type && (r.type || "").toLowerCase() !== type) return false;
      if (status === "completed" && r.derivedStatus !== "completed") return false;
      if (status === "active" && (r.derivedStatus === "completed" || r.stopped)) return false;
      if (status === "stopped" && !r.stopped) return false;
      if (holder && (r.current.holder || "").toLowerCase() !== holder) return false;
      if (stage && r.current.stage !== stage) return false;
      return true;
    });
    if (sort === "at-step-since") rows = [...rows].sort(byDate((r) => r.current.since));
    if (sort === "delivery-date") rows = [...rows].sort(byDate((r) => r.delivery_date));

    const total = rows.length;
    const items = rows.slice((page - 1) * limit, page * limit).map(listItem);
    return NextResponse.json({ total, page, limit, items });
  } catch (err) {
    console.error("GET /api/v1/items failed:", err);
    return apiError(500, "Failed to load items.");
  }
}
