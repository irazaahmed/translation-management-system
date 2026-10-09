import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { apiError, requireApiKey } from "@/lib/api/auth";
import { UUID_RE, buildPipelinePatches, itemDetail, loadItemFresh, loadReturnsFresh } from "@/lib/api/items";
import { patchEtStages, saveEtStages, type StageUpsert } from "@/lib/etMutations";
import { createAdminClient } from "@/lib/supabase/admin";
import { ET_CACHE_TAG } from "@/lib/et";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/v1/items/:id/pipeline — advance or edit an item's pipeline.
 * Writes go through patchEtStages(), the same function behind the item page's
 * "Move →" button, then the ET caches are dropped exactly as the UI does.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiKey(request, "items:write");
  if (auth.response) return auth.response;

  const { id } = await params;
  if (!UUID_RE.test(id)) return apiError(400, "Item id must be a UUID.");

  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    body = parsed as Record<string, unknown>;
  } catch {
    return apiError(400, "Body must be a JSON object.");
  }
  if (body.note !== undefined && (typeof body.note !== "string" || body.note.length > 1000)) {
    return apiError(400, '"note" must be a string (max 1000 chars).');
  }

  try {
    const admin = createAdminClient();
    const item = await loadItemFresh(admin, id);
    if (!item) return apiError(404, "Item not found.");
    if (item.stopped) {
      return apiError(409, "This item is stopped. Resume it in TMS before changing its pipeline.");
    }

    const { data: peopleRows, error: peopleError } = await admin.from("et_people").select("name");
    if (peopleError) throw peopleError;
    const people = (peopleRows || []).map((p) => p.name as string);

    const built = buildPipelinePatches(item, body, people);
    if ("error" in built) return apiError(built.status ?? 400, built.error, built.details);

    if (built.patches.some((p) => "not_applicable" in p || "merged" in p)) {
      // N/A / Merged flags only exist in the full pipeline editor's save
      // (saveEtStages): send every stage, with this request's edits applied,
      // and keep the item's final email dates so its status stays correct.
      const byStage = new Map(built.patches.map((p) => [p.stage, p]));
      const rows: StageUpsert[] = item.stages.map((s) => {
        const p = byStage.get(s.stage);
        return {
          stage: s.stage,
          person: p && "person" in p ? p.person ?? null : s.person,
          sent_date: p && "sent_date" in p ? p.sent_date ?? null : s.sent_date,
          received_back_date: p && "received_back_date" in p ? p.received_back_date ?? null : s.received_back_date,
          not_applicable: p?.not_applicable ?? s.not_applicable,
          merged: p?.merged ?? s.merged,
        };
      });
      await saveEtStages(id, rows, item.final_email_date, item.final_email_date_2, admin);
    } else {
      await patchEtStages(id, built.patches, admin);
    }

    // Same cache drop as the UI's server actions (revalidateEt in etActions.ts).
    revalidateTag(ET_CACHE_TAG, { expire: 0 });
    revalidatePath("/et");
    revalidatePath("/et/items");
    revalidatePath(`/et/items/${id}`);

    const note = typeof body.note === "string" ? body.note : null;
    const { error: auditError } = await admin.from("api_audit_log").insert({
      key_id: auth.key.id,
      key_name: auth.key.name,
      item_id: id,
      action: "pipeline.patch",
      request: { advance_to: body.advance_to, stages: body.stages, holder: body.holder, date: body.date, applied: built.patches },
      note,
    });
    if (auditError) console.error("api_audit_log insert failed:", auditError.message);

    const [fresh, returns] = await Promise.all([loadItemFresh(admin, id), loadReturnsFresh(admin, id)]);
    const detail = itemDetail(fresh!, returns);
    return NextResponse.json({
      ok: true,
      applied: built.patches,
      note,
      currently_at: detail.currently_at,
      item: detail,
    });
  } catch (err) {
    console.error("PATCH /api/v1/items/[id]/pipeline failed:", err);
    return apiError(500, "Failed to update the pipeline.");
  }
}
