import { NextResponse } from "next/server";
import { apiError, requireApiKey } from "@/lib/api/auth";
import { parsePaging } from "@/lib/api/common";
import { getCachedEtAllReturns } from "@/lib/etData";
import { daysSince, stageName } from "@/lib/et";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/returns — every return across all items (same data as the
 * returns views). Filters: open=true|false, holder, item_id; paging.
 */
export async function GET(request: Request) {
  const auth = await requireApiKey(request, "items:read");
  if (auth.response) return auth.response;

  const q = new URL(request.url).searchParams;
  const problems: string[] = [];
  const open = q.get("open");
  if (open && open !== "true" && open !== "false") problems.push("open must be true or false.");
  const { page, limit } = parsePaging(q, problems);
  if (problems.length) return apiError(400, "Invalid query parameters.", problems);
  const holder = q.get("holder")?.trim().toLowerCase() || null;
  const itemId = q.get("item_id");

  try {
    const rows = (await getCachedEtAllReturns())
      .map((r) => ({
        id: r.id,
        item_id: r.item_id,
        item_title: r.item_title,
        item_type: r.item_type,
        stage: r.stage,
        stage_name: r.stage ? stageName(r.stage) : null,
        note: r.note,
        holder: r.person,
        sent_date: r.sent_date,
        received_date: r.received_back_date,
        open: !!r.sent_date && !r.received_back_date,
        days_out: r.sent_date && !r.received_back_date ? daysSince(r.sent_date) : null,
      }))
      .filter((r) => {
        if (open && r.open !== (open === "true")) return false;
        if (holder && (r.holder || "").toLowerCase() !== holder) return false;
        if (itemId && r.item_id !== itemId) return false;
        return true;
      });
    return NextResponse.json({ total: rows.length, page, limit, returns: rows.slice((page - 1) * limit, page * limit) });
  } catch (err) {
    console.error("GET /api/v1/returns failed:", err);
    return apiError(500, "Failed to load returns.");
  }
}
