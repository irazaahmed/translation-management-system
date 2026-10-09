import { NextResponse } from "next/server";
import { apiError, requireApiKey } from "@/lib/api/auth";
import { UUID_RE, noteError, readJsonObject } from "@/lib/api/common";
import { auditEt, parseReturn, revalidateEtAll } from "@/lib/api/etWrite";
import { itemDetail, loadItemFresh, loadReturnsFresh } from "@/lib/api/items";
import { deleteEtReturn, updateEtReturn } from "@/lib/etMutations";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; returnId: string }> };

async function loadPair(id: string, returnId: string) {
  const admin = createAdminClient();
  const [item, returns] = await Promise.all([loadItemFresh(admin, id), loadReturnsFresh(admin, id)]);
  return { admin, item, ret: returns.find((r) => r.id === returnId) ?? null };
}

/**
 * PATCH /api/v1/items/:id/returns/:returnId — complete a return (send
 * "received_date") or edit any of its fields (stage, note, holder, sent_date).
 * Only sent fields change; null clears. "api_note" is the audit note.
 */
export async function PATCH(request: Request, { params }: Ctx) {
  const auth = await requireApiKey(request, "items:write");
  if (auth.response) return auth.response;

  const { id, returnId } = await params;
  if (!UUID_RE.test(id) || !UUID_RE.test(returnId)) return apiError(400, "Item id and return id must be UUIDs.");
  const body = await readJsonObject(request);
  if (!body) return apiError(400, "Body must be a JSON object.");
  const badNote = noteError(body.api_note);
  if (badNote) return apiError(400, badNote.replace('"note"', '"api_note"'));

  try {
    const { admin, item, ret } = await loadPair(id, returnId);
    if (!item) return apiError(404, "Item not found.");
    if (!ret) return apiError(404, "Return not found on this item.");
    const { data: peopleRows, error: pe } = await admin.from("et_people").select("name");
    if (pe) throw pe;

    const parsed = parseReturn(item, body, (peopleRows || []).map((p) => p.name as string), false);
    if ("error" in parsed) return apiError(parsed.status ?? 400, parsed.error, parsed.details);
    const nextNote = "note" in parsed.input ? parsed.input.note : ret.note;
    const nextPerson = "person" in parsed.input ? parsed.input.person : ret.person;
    if (!nextNote && !nextPerson) {
      return apiError(400, "A return needs a note of what's missing, or who it went to (holder).");
    }

    await updateEtReturn(returnId, parsed.input, admin);
    revalidateEtAll(id);
    const apiNote = typeof body.api_note === "string" ? body.api_note : null;
    await auditEt(admin, auth.key, {
      itemId: id,
      action: "return.patch",
      request: { return_id: returnId, ...parsed.input },
      note: apiNote,
    });

    const [fresh, returns] = await Promise.all([loadItemFresh(admin, id), loadReturnsFresh(admin, id)]);
    const detail = itemDetail(fresh!, returns);
    return NextResponse.json({ ok: true, return: detail.returns.find((r) => r.id === returnId), item: detail });
  } catch (err) {
    console.error("PATCH /api/v1/items/[id]/returns/[returnId] failed:", err);
    return apiError(500, "Failed to update the return.");
  }
}

/** DELETE /api/v1/items/:id/returns/:returnId — remove a return entry (scope items:delete). */
export async function DELETE(request: Request, { params }: Ctx) {
  const auth = await requireApiKey(request, "items:delete");
  if (auth.response) return auth.response;

  const { id, returnId } = await params;
  if (!UUID_RE.test(id) || !UUID_RE.test(returnId)) return apiError(400, "Item id and return id must be UUIDs.");
  try {
    const { admin, item, ret } = await loadPair(id, returnId);
    if (!item) return apiError(404, "Item not found.");
    if (!ret) return apiError(404, "Return not found on this item.");

    await deleteEtReturn(returnId, admin);
    revalidateEtAll(id);
    await auditEt(admin, auth.key, {
      itemId: id,
      action: "return.delete",
      request: { return_id: returnId, deleted: ret },
      note: new URL(request.url).searchParams.get("note")?.slice(0, 1000) ?? null,
    });
    return NextResponse.json({ ok: true, deleted: { id: returnId } });
  } catch (err) {
    console.error("DELETE /api/v1/items/[id]/returns/[returnId] failed:", err);
    return apiError(500, "Failed to delete the return.");
  }
}
