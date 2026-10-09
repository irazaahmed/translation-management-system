import { NextResponse } from "next/server";
import { apiError, requireApiKey } from "@/lib/api/auth";
import { noteError, readJsonObject } from "@/lib/api/common";
import { auditEt, parsePerson, personOut, revalidateEtAll } from "@/lib/api/etWrite";
import { getCachedEtItemRows, getCachedEtPeople } from "@/lib/etData";
import { addEtPerson } from "@/lib/etMutations";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/people — the English workforce (the holder list), with how many
 * items each person currently holds. Filter: active=true|false.
 */
export async function GET(request: Request) {
  const auth = await requireApiKey(request, "items:read");
  if (auth.response) return auth.response;

  const active = new URL(request.url).searchParams.get("active");
  if (active && active !== "true" && active !== "false") {
    return apiError(400, "Invalid query parameters.", ["active must be true or false."]);
  }
  try {
    const [people, rows] = await Promise.all([getCachedEtPeople(), getCachedEtItemRows()]);
    const holding = new Map<string, number>();
    for (const r of rows) {
      if (r.current.holder && !r.stopped) holding.set(r.current.holder, (holding.get(r.current.holder) ?? 0) + 1);
    }
    const out = people
      .filter((p) => !active || p.active === (active === "true"))
      .map((p) => ({ ...personOut(p), notes: p.notes, items_held: holding.get(p.name) ?? 0 }));
    return NextResponse.json({ total: out.length, people: out });
  } catch (err) {
    console.error("GET /api/v1/people failed:", err);
    return apiError(500, "Failed to load the workforce.");
  }
}

/** POST /api/v1/people — add a workforce member (same as the Workforce page's Add). */
export async function POST(request: Request) {
  const auth = await requireApiKey(request, "items:write");
  if (auth.response) return auth.response;

  const body = await readJsonObject(request);
  if (!body) return apiError(400, "Body must be a JSON object.");
  const badNote = noteError(body.note);
  if (badNote) return apiError(400, badNote);
  const parsed = parsePerson(body, null);
  if ("error" in parsed) return apiError(parsed.status ?? 400, parsed.error, parsed.details);

  try {
    const admin = createAdminClient();
    // Holder names must be unique — they're how stages refer to people.
    const { data: same, error } = await admin.from("et_people").select("id, name").ilike("name", parsed.input.name.replace(/[\\%_]/g, "\\$&"));
    if (error) throw error;
    if (same && same.length) {
      return apiError(409, "A workforce member with this name already exists.", { existing: same });
    }

    await addEtPerson(parsed.input, admin);
    revalidateEtAll();
    const note = typeof body.note === "string" ? body.note : null;
    await auditEt(admin, auth.key, { itemId: null, action: "person.create", request: parsed.input, note });

    const { data: created } = await admin
      .from("et_people")
      .select("id, name, skills, email, working_hours, active, created_at")
      .eq("name", parsed.input.name)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    return NextResponse.json({ ok: true, person: created ? personOut(created) : null }, { status: 201 });
  } catch (err) {
    console.error("POST /api/v1/people failed:", err);
    return apiError(500, "Failed to add the person.");
  }
}
