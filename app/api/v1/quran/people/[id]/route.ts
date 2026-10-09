import { NextResponse } from "next/server";
import { apiError, requireApiKey } from "@/lib/api/auth";
import { UUID_RE, noteError, readJsonObject } from "@/lib/api/common";
import { parseQuranPerson, revalidateQuran, writeAudit } from "@/lib/api/quran";
import { deleteQuranPerson, updateQuranPerson } from "@/lib/paraProgressMutations";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };
const COLS = "id, name, active, notes, created_at";

/** PATCH /api/v1/quran/people/:id — edit a Quran workforce member (name, active, notes). */
export async function PATCH(request: Request, { params }: Ctx) {
  const auth = await requireApiKey(request, "quran:write");
  if (auth.response) return auth.response;

  const { id } = await params;
  if (!UUID_RE.test(id)) return apiError(400, "Person id must be a UUID.");
  const body = await readJsonObject(request);
  if (!body) return apiError(400, "Body must be a JSON object.");
  const badNote = noteError(body.note);
  if (badNote) return apiError(400, badNote);

  try {
    const admin = createAdminClient();
    const { data: current, error } = await admin.from("quran_people").select(COLS).eq("id", id).maybeSingle();
    if (error) throw error;
    if (!current) return apiError(404, "Person not found.");
    const parsed = parseQuranPerson(body, current);
    if ("error" in parsed) return apiError(400, parsed.error, parsed.details);
    if (parsed.input.name.toLowerCase() !== current.name.toLowerCase()) {
      const { data: clash } = await admin
        .from("quran_people")
        .select("id")
        .ilike("name", parsed.input.name.replace(/[\\%_]/g, "\\$&"))
        .neq("id", id);
      if (clash && clash.length) return apiError(409, "Another workforce member already has this name.");
    }

    await updateQuranPerson(id, parsed.input, admin);
    revalidateQuran();
    await writeAudit(admin, auth.key, {
      languageId: id,
      action: "quran.person.patch",
      request: { previous: current, ...parsed.input },
      note: typeof body.note === "string" ? body.note : null,
    });
    const { data: fresh } = await admin.from("quran_people").select(COLS).eq("id", id).single();
    return NextResponse.json({ ok: true, person: fresh });
  } catch (err) {
    console.error("PATCH /api/v1/quran/people/[id] failed:", err);
    return apiError(500, "Failed to update the person.");
  }
}

/** DELETE /api/v1/quran/people/:id — remove a member; their para history stays, unassigned (scope quran:delete). */
export async function DELETE(request: Request, { params }: Ctx) {
  const auth = await requireApiKey(request, "quran:delete");
  if (auth.response) return auth.response;

  const { id } = await params;
  if (!UUID_RE.test(id)) return apiError(400, "Person id must be a UUID.");
  try {
    const admin = createAdminClient();
    const { data: current, error } = await admin.from("quran_people").select(COLS).eq("id", id).maybeSingle();
    if (error) throw error;
    if (!current) return apiError(404, "Person not found.");

    await deleteQuranPerson(id, admin);
    revalidateQuran();
    await writeAudit(admin, auth.key, {
      languageId: id,
      action: "quran.person.delete",
      request: { deleted: current },
      note: new URL(request.url).searchParams.get("note")?.slice(0, 1000) ?? null,
    });
    return NextResponse.json({ ok: true, deleted: { id, name: current.name } });
  } catch (err) {
    console.error("DELETE /api/v1/quran/people/[id] failed:", err);
    return apiError(500, "Failed to delete the person.");
  }
}
