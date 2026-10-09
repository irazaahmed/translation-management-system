import { NextResponse } from "next/server";
import { apiError, requireApiKey } from "@/lib/api/auth";
import { UUID_RE, noteError, readJsonObject } from "@/lib/api/common";
import { auditEt, planItemPatch, revalidateEtAll } from "@/lib/api/etWrite";
import { itemDetail, loadItemFresh, loadReturnsFresh } from "@/lib/api/items";
import { getCachedEtItem, getCachedEtReturns } from "@/lib/etData";
import { deleteEtItem, saveEtStages, setEtStopped, updateEtItem, type StageUpsert } from "@/lib/etMutations";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/v1/items/:id — full item detail, pipeline, returns and tracking history. */
export async function GET(request: Request, { params }: Ctx) {
  const auth = await requireApiKey(request, "items:read");
  if (auth.response) return auth.response;

  const { id } = await params;
  if (!UUID_RE.test(id)) return apiError(400, "Item id must be a UUID.");

  try {
    const [item, returns] = await Promise.all([getCachedEtItem(id), getCachedEtReturns(id)]);
    if (!item) return apiError(404, "Item not found.");
    return NextResponse.json(itemDetail(item, returns));
  } catch (err) {
    console.error("GET /api/v1/items/[id] failed:", err);
    return apiError(500, "Failed to load item.");
  }
}

/**
 * PATCH /api/v1/items/:id — edit the item (same fields as the edit form), set
 * or clear the final email date(s), and stop / resume it. Writes go through
 * updateEtItem(), saveEtStages() (final email → status recomputed, like the
 * pipeline editor) and setEtStopped(), exactly as the UI does.
 */
export async function PATCH(request: Request, { params }: Ctx) {
  const auth = await requireApiKey(request, "items:write");
  if (auth.response) return auth.response;

  const { id } = await params;
  if (!UUID_RE.test(id)) return apiError(400, "Item id must be a UUID.");
  const body = await readJsonObject(request);
  if (!body) return apiError(400, "Body must be a JSON object.");
  const badNote = noteError(body.note);
  if (badNote) return apiError(400, badNote);

  try {
    const admin = createAdminClient();
    const item = await loadItemFresh(admin, id);
    if (!item) return apiError(404, "Item not found.");

    const built = planItemPatch(item, body);
    if ("error" in built) return apiError(built.status ?? 400, built.error, built.details);
    const { fields, finalEmail, stopped } = built.plan;

    if (Object.keys(fields).length) await updateEtItem(id, fields, admin);
    if (finalEmail) {
      const rows: StageUpsert[] = item.stages.map((s) => ({
        stage: s.stage,
        person: s.person,
        sent_date: s.sent_date,
        received_back_date: s.received_back_date,
        not_applicable: s.not_applicable,
        merged: s.merged,
      }));
      await saveEtStages(
        id,
        rows,
        "final_email_date" in finalEmail ? finalEmail.final_email_date : item.final_email_date,
        "final_email_date_2" in finalEmail ? finalEmail.final_email_date_2 : item.final_email_date_2,
        admin
      );
    }
    if (stopped !== null) await setEtStopped(id, stopped, admin);

    revalidateEtAll(id);
    const note = typeof body.note === "string" ? body.note : null;
    await auditEt(admin, auth.key, {
      itemId: id,
      action: "item.patch",
      request: { ...body, note: undefined },
      note,
    });

    const [fresh, returns] = await Promise.all([loadItemFresh(admin, id), loadReturnsFresh(admin, id)]);
    const detail = itemDetail(fresh!, returns);
    return NextResponse.json({ ok: true, note, currently_at: detail.currently_at, item: detail });
  } catch (err) {
    console.error("PATCH /api/v1/items/[id] failed:", err);
    return apiError(500, "Failed to update the item.");
  }
}

/** DELETE /api/v1/items/:id — delete the item and its stages (scope items:delete). */
export async function DELETE(request: Request, { params }: Ctx) {
  const auth = await requireApiKey(request, "items:delete");
  if (auth.response) return auth.response;

  const { id } = await params;
  if (!UUID_RE.test(id)) return apiError(400, "Item id must be a UUID.");
  const note = new URL(request.url).searchParams.get("note");

  try {
    const admin = createAdminClient();
    const item = await loadItemFresh(admin, id);
    if (!item) return apiError(404, "Item not found.");

    await deleteEtItem(id, admin);
    revalidateEtAll(id);
    await auditEt(admin, auth.key, {
      itemId: id,
      action: "item.delete",
      request: { title: item.title, type: item.type },
      note: note?.slice(0, 1000) ?? null,
    });
    return NextResponse.json({ ok: true, deleted: { id, title: item.title } });
  } catch (err) {
    console.error("DELETE /api/v1/items/[id] failed:", err);
    return apiError(500, "Failed to delete the item.");
  }
}
