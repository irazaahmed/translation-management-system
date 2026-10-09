import { NextResponse } from "next/server";
import { apiError, requireApiKey } from "@/lib/api/auth";
import { UUID_RE, noteError, readJsonObject } from "@/lib/api/common";
import { auditEt, parsePerson, personOut, revalidateEtAll } from "@/lib/api/etWrite";
import { deleteEtPerson, updateEtPerson } from "@/lib/etMutations";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const COLS = "id, name, skills, email, working_hours, active, created_at";

/**
 * PATCH /api/v1/people/:id — edit a workforce member. Renaming cascades the new
 * name to every stage holder and return that used the old one (updateEtPerson,
 * same as the Workforce page).
 */
export async function PATCH(request: Request, { params }: Ctx) {
  const auth = await requireApiKey(request, "items:write");
  if (auth.response) return auth.response;

  const { id } = await params;
  if (!UUID_RE.test(id)) return apiError(400, "Person id must be a UUID.");
  const body = await readJsonObject(request);
  if (!body) return apiError(400, "Body must be a JSON object.");
  const badNote = noteError(body.note);
  if (badNote) return apiError(400, badNote);

  try {
    const admin = createAdminClient();
    const { data: current, error } = await admin.from("et_people").select(COLS).eq("id", id).maybeSingle();
    if (error) throw error;
    if (!current) return apiError(404, "Person not found.");

    const parsed = parsePerson(body, current);
    if ("error" in parsed) return apiError(parsed.status ?? 400, parsed.error, parsed.details);
    if (parsed.input.name.toLowerCase() !== current.name.toLowerCase()) {
      const { data: clash } = await admin
        .from("et_people")
        .select("id")
        .ilike("name", parsed.input.name.replace(/[\\%_]/g, "\\$&"))
        .neq("id", id);
      if (clash && clash.length) return apiError(409, "Another workforce member already has this name.");
    }

    await updateEtPerson(id, current.name, parsed.input, admin);
    revalidateEtAll();
    const note = typeof body.note === "string" ? body.note : null;
    await auditEt(admin, auth.key, {
      itemId: null,
      action: "person.patch",
      request: { person_id: id, previous_name: current.name, ...parsed.input },
      note,
    });

    const { data: fresh } = await admin.from("et_people").select(COLS).eq("id", id).single();
    return NextResponse.json({
      ok: true,
      renamed: current.name !== parsed.input.name ? { from: current.name, to: parsed.input.name } : null,
      person: fresh ? personOut(fresh) : null,
    });
  } catch (err) {
    console.error("PATCH /api/v1/people/[id] failed:", err);
    return apiError(500, "Failed to update the person.");
  }
}

/** DELETE /api/v1/people/:id — remove a workforce member; past work history is kept (scope items:delete). */
export async function DELETE(request: Request, { params }: Ctx) {
  const auth = await requireApiKey(request, "items:delete");
  if (auth.response) return auth.response;

  const { id } = await params;
  if (!UUID_RE.test(id)) return apiError(400, "Person id must be a UUID.");
  try {
    const admin = createAdminClient();
    const { data: current, error } = await admin.from("et_people").select(COLS).eq("id", id).maybeSingle();
    if (error) throw error;
    if (!current) return apiError(404, "Person not found.");

    await deleteEtPerson(id, admin);
    revalidateEtAll();
    await auditEt(admin, auth.key, {
      itemId: null,
      action: "person.delete",
      request: { deleted: current },
      note: new URL(request.url).searchParams.get("note")?.slice(0, 1000) ?? null,
    });
    return NextResponse.json({ ok: true, deleted: { id, name: current.name } });
  } catch (err) {
    console.error("DELETE /api/v1/people/[id] failed:", err);
    return apiError(500, "Failed to delete the person.");
  }
}
