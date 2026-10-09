import { NextResponse } from "next/server";
import { apiError, requireApiKey } from "@/lib/api/auth";
import { UUID_RE, noteError, readJsonObject } from "@/lib/api/common";
import { auditEt, revalidateEtAll } from "@/lib/api/etWrite";
import { deleteEtAssignment, updateEtAssignment } from "@/lib/etMutations";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };
const COLS = "id, person_id, item_id, note, position, done";

/** PATCH /api/v1/assignments/:id — edit the note and/or mark done (same as the managing board). */
export async function PATCH(request: Request, { params }: Ctx) {
  const auth = await requireApiKey(request, "items:write");
  if (auth.response) return auth.response;

  const { id } = await params;
  if (!UUID_RE.test(id)) return apiError(400, "Assignment id must be a UUID.");
  const body = await readJsonObject(request);
  if (!body) return apiError(400, "Body must be a JSON object.");
  const badNote = noteError(body.api_note);
  if (badNote) return apiError(400, badNote.replace('"note"', '"api_note"'));

  const problems: string[] = [];
  const unknown = Object.keys(body).filter((k) => !["note", "done", "api_note"].includes(k));
  if (unknown.length) problems.push(`Unknown field(s): ${unknown.join(", ")}.`);
  const patch: { note?: string | null; done?: boolean } = {};
  if ("note" in body) {
    if (body.note === null || (typeof body.note === "string" && body.note.length <= 1000)) patch.note = body.note as string | null;
    else problems.push("note must be a string (max 1000) or null.");
  }
  if ("done" in body) {
    if (typeof body.done === "boolean") patch.done = body.done;
    else problems.push("done must be true or false.");
  }
  if (!problems.length && Object.keys(patch).length === 0) problems.push("Nothing to change (note / done).");
  if (problems.length) return apiError(400, "Invalid request.", problems);

  try {
    const admin = createAdminClient();
    const { data: current, error } = await admin.from("et_assignments").select(COLS).eq("id", id).maybeSingle();
    if (error) throw error;
    if (!current) return apiError(404, "Assignment not found.");

    await updateEtAssignment(id, patch, admin);
    revalidateEtAll();
    const apiNote = typeof body.api_note === "string" ? body.api_note : null;
    await auditEt(admin, auth.key, { itemId: current.item_id, action: "assignment.patch", request: { assignment_id: id, ...patch }, note: apiNote });

    const { data: fresh } = await admin.from("et_assignments").select(COLS).eq("id", id).single();
    return NextResponse.json({ ok: true, assignment: fresh });
  } catch (err) {
    console.error("PATCH /api/v1/assignments/[id] failed:", err);
    return apiError(500, "Failed to update the assignment.");
  }
}

/** DELETE /api/v1/assignments/:id — remove a planned assignment (scope items:delete). */
export async function DELETE(request: Request, { params }: Ctx) {
  const auth = await requireApiKey(request, "items:delete");
  if (auth.response) return auth.response;

  const { id } = await params;
  if (!UUID_RE.test(id)) return apiError(400, "Assignment id must be a UUID.");
  try {
    const admin = createAdminClient();
    const { data: current, error } = await admin.from("et_assignments").select(COLS).eq("id", id).maybeSingle();
    if (error) throw error;
    if (!current) return apiError(404, "Assignment not found.");

    await deleteEtAssignment(id, admin);
    revalidateEtAll();
    await auditEt(admin, auth.key, {
      itemId: current.item_id,
      action: "assignment.delete",
      request: { deleted: current },
      note: new URL(request.url).searchParams.get("note")?.slice(0, 1000) ?? null,
    });
    return NextResponse.json({ ok: true, deleted: { id } });
  } catch (err) {
    console.error("DELETE /api/v1/assignments/[id] failed:", err);
    return apiError(500, "Failed to delete the assignment.");
  }
}
