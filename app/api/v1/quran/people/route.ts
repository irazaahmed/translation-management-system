import { NextResponse } from "next/server";
import { apiError, requireApiKey } from "@/lib/api/auth";
import { noteError, readJsonObject } from "@/lib/api/common";
import { parseQuranPerson, revalidateQuran, writeAudit } from "@/lib/api/quran";
import { getCachedActiveParaCounts, getCachedQuranPeople } from "@/lib/paraProgressData";
import { addQuranPerson } from "@/lib/paraProgressMutations";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** GET /api/v1/quran/people — the Quran workforce, with each person's in-progress para count. */
export async function GET(request: Request) {
  const auth = await requireApiKey(request, "quran:read");
  if (auth.response) return auth.response;

  const active = new URL(request.url).searchParams.get("active");
  if (active && active !== "true" && active !== "false") {
    return apiError(400, "Invalid query parameters.", ["active must be true or false."]);
  }
  try {
    const [people, counts] = await Promise.all([getCachedQuranPeople(), getCachedActiveParaCounts()]);
    const out = people
      .filter((p) => !active || p.active === (active === "true"))
      .map((p) => ({ id: p.id, name: p.name, active: p.active, notes: p.notes, paras_in_progress: counts[p.id] ?? 0, created_at: p.created_at }));
    return NextResponse.json({ total: out.length, people: out });
  } catch (err) {
    console.error("GET /api/v1/quran/people failed:", err);
    return apiError(500, "Failed to load the workforce.");
  }
}

/** POST /api/v1/quran/people — add a Quran workforce member (same as the Workforce page). */
export async function POST(request: Request) {
  const auth = await requireApiKey(request, "quran:write");
  if (auth.response) return auth.response;

  const body = await readJsonObject(request);
  if (!body) return apiError(400, "Body must be a JSON object.");
  const badNote = noteError(body.note);
  if (badNote) return apiError(400, badNote);
  const parsed = parseQuranPerson(body, null);
  if ("error" in parsed) return apiError(400, parsed.error, parsed.details);

  try {
    const admin = createAdminClient();
    const { data: same, error } = await admin
      .from("quran_people")
      .select("id, name")
      .ilike("name", parsed.input.name.replace(/[\\%_]/g, "\\$&"));
    if (error) throw error;
    if (same && same.length) return apiError(409, "A workforce member with this name already exists.", { existing: same });

    await addQuranPerson(parsed.input, admin);
    revalidateQuran();
    const { data: created } = await admin
      .from("quran_people")
      .select("id, name, active, notes, created_at")
      .eq("name", parsed.input.name)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    const note = typeof body.note === "string" ? body.note : null;
    await writeAudit(admin, auth.key, { languageId: created?.id ?? null, action: "quran.person.create", request: parsed.input, note });
    return NextResponse.json({ ok: true, person: created }, { status: 201 });
  } catch (err) {
    console.error("POST /api/v1/quran/people failed:", err);
    return apiError(500, "Failed to add the person.");
  }
}
