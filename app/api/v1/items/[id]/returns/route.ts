import { NextResponse } from "next/server";
import { apiError, requireApiKey } from "@/lib/api/auth";
import { UUID_RE, noteError, readJsonObject } from "@/lib/api/common";
import { auditEt, parseReturn, revalidateEtAll } from "@/lib/api/etWrite";
import { itemDetail, loadItemFresh, loadReturnsFresh } from "@/lib/api/items";
import { getCachedEtItem, getCachedEtReturns } from "@/lib/etData";
import { addEtReturn, type AddEtReturnInput } from "@/lib/etMutations";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/v1/items/:id/returns — the item's "sent back to complete" entries, newest first. */
export async function GET(request: Request, { params }: Ctx) {
  const auth = await requireApiKey(request, "items:read");
  if (auth.response) return auth.response;

  const { id } = await params;
  if (!UUID_RE.test(id)) return apiError(400, "Item id must be a UUID.");
  try {
    const [item, returns] = await Promise.all([getCachedEtItem(id), getCachedEtReturns(id)]);
    if (!item) return apiError(404, "Item not found.");
    return NextResponse.json({ item_id: id, title: item.title, returns: itemDetail(item, returns).returns });
  } catch (err) {
    console.error("GET /api/v1/items/[id]/returns failed:", err);
    return apiError(500, "Failed to load returns.");
  }
}

/**
 * POST /api/v1/items/:id/returns — log a return ("go back and complete a
 * missing part"), through addEtReturn(), same as the item page's Returns box.
 * Body fields: stage, note, holder, sent_date, received_date; "api_note" is
 * the audit note (since "note" is the return's own text).
 */
export async function POST(request: Request, { params }: Ctx) {
  const auth = await requireApiKey(request, "items:write");
  if (auth.response) return auth.response;

  const { id } = await params;
  if (!UUID_RE.test(id)) return apiError(400, "Item id must be a UUID.");
  const body = await readJsonObject(request);
  if (!body) return apiError(400, "Body must be a JSON object.");
  const badNote = noteError(body.api_note);
  if (badNote) return apiError(400, badNote.replace('"note"', '"api_note"'));

  try {
    const admin = createAdminClient();
    const item = await loadItemFresh(admin, id);
    if (!item) return apiError(404, "Item not found.");
    const { data: peopleRows, error: pe } = await admin.from("et_people").select("name");
    if (pe) throw pe;

    const parsed = parseReturn(item, body, (peopleRows || []).map((p) => p.name as string), true);
    if ("error" in parsed) return apiError(parsed.status ?? 400, parsed.error, parsed.details);

    await addEtReturn(id, parsed.input as AddEtReturnInput, admin);
    revalidateEtAll(id);
    const apiNote = typeof body.api_note === "string" ? body.api_note : null;
    await auditEt(admin, auth.key, { itemId: id, action: "return.create", request: parsed.input, note: apiNote });

    const [fresh, returns] = await Promise.all([loadItemFresh(admin, id), loadReturnsFresh(admin, id)]);
    const detail = itemDetail(fresh!, returns);
    return NextResponse.json({ ok: true, return: detail.returns[0], returns: detail.returns }, { status: 201 });
  } catch (err) {
    console.error("POST /api/v1/items/[id]/returns failed:", err);
    return apiError(500, "Failed to add the return.");
  }
}
