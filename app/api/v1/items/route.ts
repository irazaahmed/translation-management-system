import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { apiError, requireApiKey } from "@/lib/api/auth";
import { noteError, readJsonObject } from "@/lib/api/common";
import {
  CATEGORY_SLUGS,
  isStageCode,
  itemDetail,
  listItem,
  loadItemFresh,
  parseCreateItem,
} from "@/lib/api/items";
import { getCachedEtItemRows, type EtItemRow } from "@/lib/etData";
import { createEtItem } from "@/lib/etMutations";
import { createAdminClient } from "@/lib/supabase/admin";
import { ET_CACHE_TAG, TYPE_LABELS, itemCategory } from "@/lib/et";

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

/**
 * POST /api/v1/items — create a work item, through createEtItem(), the same
 * function behind the "New item" form (blank pipeline stages for its type).
 */
export async function POST(request: Request) {
  const auth = await requireApiKey(request, "items:write");
  if (auth.response) return auth.response;

  const body = await readJsonObject(request);
  if (!body) return apiError(400, "Body must be a JSON object.");
  const badNote = noteError(body.note);
  if (badNote) return apiError(400, badNote);
  const parsed = parseCreateItem(body);
  if ("error" in parsed) return apiError(400, parsed.error, parsed.details);
  const { input } = parsed;

  try {
    const admin = createAdminClient();

    // Guard against accidental double-creates (e.g. a retried request).
    if (body.allow_duplicate !== true) {
      const { data: same, error } = await admin.from("et_items").select("id, title").ilike("title", input.title.replace(/[\\%_]/g, "\\$&"));
      if (error) throw error;
      if (same && same.length > 0) {
        return apiError(409, "An item with this title already exists. Send \"allow_duplicate\": true to create it anyway.", {
          existing: same.map((s) => ({ id: s.id, title: s.title })),
        });
      }
    }

    const id = await createEtItem(input, admin);

    // Same cache drop as the UI's server actions (revalidateEt in etActions.ts).
    revalidateTag(ET_CACHE_TAG, { expire: 0 });
    revalidatePath("/et");
    revalidatePath("/et/items");

    const note = typeof body.note === "string" ? body.note : null;
    const { error: auditError } = await admin.from("api_audit_log").insert({
      key_id: auth.key.id,
      key_name: auth.key.name,
      item_id: id,
      action: "item.create",
      request: { ...body, note: undefined },
      note,
    });
    if (auditError) console.error("api_audit_log insert failed:", auditError.message);

    const item = await loadItemFresh(admin, id);
    return NextResponse.json({ ok: true, note, item: itemDetail(item!, []) }, { status: 201 });
  } catch (err) {
    console.error("POST /api/v1/items failed:", err);
    return apiError(500, "Failed to create the item.");
  }
}
