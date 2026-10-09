import { NextResponse } from "next/server";
import { apiError, requireApiKey } from "@/lib/api/auth";
import { UUID_RE, noteError, readJsonObject } from "@/lib/api/common";
import { auditEt, revalidateEtAll } from "@/lib/api/etWrite";
import { getCachedEtAssignments, getCachedEtPeople } from "@/lib/etData";
import { addEtAssignment } from "@/lib/etMutations";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/assignments — planned work (the Workforce managing board): who
 * is lined up to do which item, in queue order. Filters: person_id, item_id,
 * done=true|false.
 */
export async function GET(request: Request) {
  const auth = await requireApiKey(request, "items:read");
  if (auth.response) return auth.response;

  const q = new URL(request.url).searchParams;
  const personId = q.get("person_id");
  const itemId = q.get("item_id");
  const done = q.get("done");
  const problems: string[] = [];
  if (personId && !UUID_RE.test(personId)) problems.push("person_id must be a UUID.");
  if (itemId && !UUID_RE.test(itemId)) problems.push("item_id must be a UUID.");
  if (done && done !== "true" && done !== "false") problems.push("done must be true or false.");
  if (problems.length) return apiError(400, "Invalid query parameters.", problems);

  try {
    const [rows, people] = await Promise.all([getCachedEtAssignments(), getCachedEtPeople()]);
    const nameById = new Map(people.map((p) => [p.id, p.name]));
    const out = rows
      .filter((a) => (!personId || a.person_id === personId) && (!itemId || a.item_id === itemId) && (!done || a.done === (done === "true")))
      .map((a) => ({
        id: a.id,
        person_id: a.person_id,
        person: nameById.get(a.person_id) ?? null,
        item_id: a.item_id,
        item_title: a.item_title,
        item_type: a.item_type,
        note: a.note,
        position: a.position,
        done: a.done,
      }));
    return NextResponse.json({ total: out.length, assignments: out });
  } catch (err) {
    console.error("GET /api/v1/assignments failed:", err);
    return apiError(500, "Failed to load assignments.");
  }
}

/** POST /api/v1/assignments — line up an item for a person (added to the end of their queue). */
export async function POST(request: Request) {
  const auth = await requireApiKey(request, "items:write");
  if (auth.response) return auth.response;

  const body = await readJsonObject(request);
  if (!body) return apiError(400, "Body must be a JSON object.");
  const badNote = noteError(body.api_note);
  if (badNote) return apiError(400, badNote.replace('"note"', '"api_note"'));
  const problems: string[] = [];
  const unknown = Object.keys(body).filter((k) => !["person_id", "item_id", "note", "api_note"].includes(k));
  if (unknown.length) problems.push(`Unknown field(s): ${unknown.join(", ")}.`);
  if (typeof body.person_id !== "string" || !UUID_RE.test(body.person_id)) problems.push("person_id (UUID) is required.");
  if (typeof body.item_id !== "string" || !UUID_RE.test(body.item_id)) problems.push("item_id (UUID) is required.");
  if (body.note !== undefined && body.note !== null && (typeof body.note !== "string" || body.note.length > 1000)) {
    problems.push("note must be a string (max 1000) or null.");
  }
  if (problems.length) return apiError(400, "Invalid request.", problems);
  const input = { person_id: body.person_id as string, item_id: body.item_id as string, note: (body.note as string | null) ?? null };

  try {
    const admin = createAdminClient();
    const [{ data: person }, { data: item }] = await Promise.all([
      admin.from("et_people").select("id, name").eq("id", input.person_id).maybeSingle(),
      admin.from("et_items").select("id, title").eq("id", input.item_id).maybeSingle(),
    ]);
    if (!person) return apiError(404, "Person not found.");
    if (!item) return apiError(404, "Item not found.");

    await addEtAssignment(input, admin);
    revalidateEtAll();
    const apiNote = typeof body.api_note === "string" ? body.api_note : null;
    await auditEt(admin, auth.key, { itemId: input.item_id, action: "assignment.create", request: input, note: apiNote });

    const { data: created } = await admin
      .from("et_assignments")
      .select("id, person_id, item_id, note, position, done")
      .eq("person_id", input.person_id)
      .eq("item_id", input.item_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    return NextResponse.json(
      { ok: true, assignment: created ? { ...created, person: person.name, item_title: item.title } : null },
      { status: 201 }
    );
  } catch (err) {
    console.error("POST /api/v1/assignments failed:", err);
    return apiError(500, "Failed to add the assignment.");
  }
}
