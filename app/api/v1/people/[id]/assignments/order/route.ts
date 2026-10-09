import { NextResponse } from "next/server";
import { apiError, requireApiKey } from "@/lib/api/auth";
import { UUID_RE, noteError, readJsonObject } from "@/lib/api/common";
import { auditEt, revalidateEtAll } from "@/lib/api/etWrite";
import { reorderEtAssignments } from "@/lib/etMutations";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PUT /api/v1/people/:id/assignments/order — reorder a person's queue
 * (drag-and-drop on the managing board). Body: { "ordered_ids": [...] } with
 * every one of that person's assignment ids, in the new order.
 */
export async function PUT(request: Request, { params }: Ctx) {
  const auth = await requireApiKey(request, "items:write");
  if (auth.response) return auth.response;

  const { id } = await params;
  if (!UUID_RE.test(id)) return apiError(400, "Person id must be a UUID.");
  const body = await readJsonObject(request);
  if (!body) return apiError(400, "Body must be a JSON object.");
  const badNote = noteError(body.note);
  if (badNote) return apiError(400, badNote);
  const ids = body.ordered_ids;
  if (!Array.isArray(ids) || ids.length === 0 || !ids.every((x) => typeof x === "string" && UUID_RE.test(x))) {
    return apiError(400, '"ordered_ids" must be a non-empty array of assignment UUIDs.');
  }

  try {
    const admin = createAdminClient();
    const { data: mine, error } = await admin.from("et_assignments").select("id").eq("person_id", id);
    if (error) throw error;
    const own = new Set((mine || []).map((a) => a.id as string));
    const given = new Set(ids as string[]);
    if (own.size === 0) return apiError(404, "This person has no assignments.");
    if (given.size !== ids.length || given.size !== own.size || [...given].some((x) => !own.has(x))) {
      return apiError(400, "ordered_ids must list each of this person's assignments exactly once.", {
        expected: [...own],
      });
    }

    await reorderEtAssignments(id, ids as string[], admin);
    revalidateEtAll();
    await auditEt(admin, auth.key, {
      itemId: null,
      action: "assignment.reorder",
      request: { person_id: id, ordered_ids: ids },
      note: typeof body.note === "string" ? body.note : null,
    });
    return NextResponse.json({ ok: true, person_id: id, ordered_ids: ids });
  } catch (err) {
    console.error("PUT /api/v1/people/[id]/assignments/order failed:", err);
    return apiError(500, "Failed to reorder assignments.");
  }
}
