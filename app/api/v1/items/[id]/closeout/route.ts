import { NextResponse } from "next/server";
import { apiError, requireApiKey } from "@/lib/api/auth";
import { UUID_RE, noteError, readJsonObject, unknownFieldsMessage } from "@/lib/api/common";
import { auditEt, normalizeCloseoutBody, planItemPatch, revalidateEtAll } from "@/lib/api/etWrite";
import { itemDetail, loadItemFresh, loadReturnsFresh } from "@/lib/api/items";
import { setEtCloseout } from "@/lib/etMutations";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };
const ALLOWED = ["delivery_link", "delivery_remarks", "note"];

/**
 * PATCH /api/v1/items/:id/closeout — the item page's "Link / Remarks" card:
 * record where the delivered work lives (online / SharePoint link) and/or a
 * remark. After the final email, either one completes the item; clearing both
 * sends it back to "link_missing". Saved through setEtCloseout(), same as the UI.
 *
 * Accepts { delivery_link, delivery_remarks }, { link, remarks } or
 * { closeout: { link, remarks } }. A bare domain gets "https://" added.
 */
export async function PATCH(request: Request, { params }: Ctx) {
  const auth = await requireApiKey(request, "items:write");
  if (auth.response) return auth.response;

  const { id } = await params;
  if (!UUID_RE.test(id)) return apiError(400, "Item id must be a UUID.");
  const raw = await readJsonObject(request);
  if (!raw) return apiError(400, "Body must be a JSON object.");
  const badNote = noteError(raw.note);
  if (badNote) return apiError(400, badNote);

  const body = normalizeCloseoutBody(raw);
  const unknown = Object.keys(body).filter((k) => !ALLOWED.includes(k));
  if (unknown.length) return apiError(400, "Invalid request.", [unknownFieldsMessage(unknown, ALLOWED)]);
  if (!("delivery_link" in body) && !("delivery_remarks" in body)) {
    return apiError(400, "Send delivery_link and/or delivery_remarks (or link / remarks).");
  }

  try {
    const admin = createAdminClient();
    const item = await loadItemFresh(admin, id);
    if (!item) return apiError(404, "Item not found.");

    const built = planItemPatch(item, body);
    if ("error" in built) return apiError(built.status ?? 400, built.error, built.details);
    const closeout = built.plan.closeout!;

    await setEtCloseout(id, closeout, admin);
    revalidateEtAll(id);
    const note = typeof body.note === "string" ? body.note : null;
    await auditEt(admin, auth.key, { itemId: id, action: "item.closeout", request: closeout, note });

    const [fresh, returns] = await Promise.all([loadItemFresh(admin, id), loadReturnsFresh(admin, id)]);
    const detail = itemDetail(fresh!, returns);
    return NextResponse.json({
      ok: true,
      note,
      status: detail.status,
      closeout: detail.closeout,
      hint: !fresh!.final_email_date
        ? "Saved. The final email isn't recorded yet, so this item isn't complete; it completes once the final email date is set."
        : undefined,
      currently_at: detail.currently_at,
      item: detail,
    });
  } catch (err) {
    console.error("PATCH /api/v1/items/[id]/closeout failed:", err);
    return apiError(500, "Failed to save the link / remarks.");
  }
}
