import { NextResponse } from "next/server";
import { apiError, requireApiKey } from "@/lib/api/auth";
import { UUID_RE, noteError, readJsonObject } from "@/lib/api/common";
import {
  languageDetail,
  loadLanguage,
  loadLanguageDetailFresh,
  loadMeetings,
  loadParaRows,
  planLanguagePatch,
  revalidateQuran,
  writeAudit,
} from "@/lib/api/quran";
import { deleteLanguage, updateLanguage } from "@/lib/mutations";
import { saveParaStage } from "@/lib/paraProgressMutations";
import { getCachedParaRowsForLanguage } from "@/lib/paraProgressData";
import { createAdminClient } from "@/lib/supabase/admin";
import { supabase } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/v1/quran/languages/:id — meta, per-stage para progress, meetings, schedule. */
export async function GET(request: Request, { params }: Ctx) {
  const auth = await requireApiKey(request, "quran:read");
  if (auth.response) return auth.response;

  const { id } = await params;
  if (!UUID_RE.test(id)) return apiError(400, "Language id must be a UUID.");

  try {
    // Same reads as the language/progress pages: languages + meetings live,
    // para rows from the tagged Quran data cache.
    const [lang, rows, meetings] = await Promise.all([
      loadLanguage(supabase, id),
      getCachedParaRowsForLanguage(id),
      loadMeetings(supabase, id),
    ]);
    if (!lang) return apiError(404, "Language not found.");
    return NextResponse.json(languageDetail(lang, lang.projects?.name ?? null, rows, meetings));
  } catch (err) {
    console.error("GET /api/v1/quran/languages/[id] failed:", err);
    return apiError(500, "Failed to load language.");
  }
}

/**
 * PATCH /api/v1/quran/languages/:id — edit meta and/or para progress.
 * Writes go through updateLanguage() and saveParaStage(), the same functions
 * behind the language edit form and the progress editor.
 */
export async function PATCH(request: Request, { params }: Ctx) {
  const auth = await requireApiKey(request, "quran:write");
  if (auth.response) return auth.response;

  const { id } = await params;
  if (!UUID_RE.test(id)) return apiError(400, "Language id must be a UUID.");
  const body = await readJsonObject(request);
  if (!body) return apiError(400, "Body must be a JSON object.");
  const badNote = noteError(body.note);
  if (badNote) return apiError(400, badNote);

  try {
    const admin = createAdminClient();
    const [lang, rows, people] = await Promise.all([
      loadLanguage(admin, id),
      loadParaRows(admin, id),
      admin.from("quran_people").select("id"),
    ]);
    if (!lang) return apiError(404, "Language not found.");
    if (people.error) throw people.error;

    const built = planLanguagePatch(lang, rows, body, new Set((people.data || []).map((p) => p.id as string)));
    if ("error" in built) return apiError(400, built.error, built.details);
    const { meta, paraWrites, counts } = built.plan;

    if (meta) await updateLanguage(id, meta, admin);
    for (const w of paraWrites) await saveParaStage(id, w.stage, w.rows, admin);

    revalidateQuran(id);
    const note = typeof body.note === "string" ? body.note : null;
    await writeAudit(admin, auth.key, {
      languageId: id,
      action: "quran.language.patch",
      request: { ...body, note: undefined, applied: { meta, counts } },
      note,
    });

    return NextResponse.json({
      ok: true,
      applied: { meta, para_counts: counts },
      note,
      language: await loadLanguageDetailFresh(admin, id),
    });
  } catch (err) {
    console.error("PATCH /api/v1/quran/languages/[id] failed:", err);
    return apiError(500, "Failed to update the language.");
  }
}

/**
 * DELETE /api/v1/quran/languages/:id — delete a language; its meetings and
 * para progress go with it (scope quran:delete).
 */
export async function DELETE(request: Request, { params }: Ctx) {
  const auth = await requireApiKey(request, "quran:delete");
  if (auth.response) return auth.response;

  const { id } = await params;
  if (!UUID_RE.test(id)) return apiError(400, "Language id must be a UUID.");
  try {
    const admin = createAdminClient();
    const lang = await loadLanguage(admin, id);
    if (!lang) return apiError(404, "Language not found.");

    await deleteLanguage(id, admin);
    revalidateQuran(id);
    await writeAudit(admin, auth.key, {
      languageId: id,
      action: "quran.language.delete",
      request: { language: lang.language, country: lang.country, project_id: lang.project_id },
      note: new URL(request.url).searchParams.get("note")?.slice(0, 1000) ?? null,
    });
    return NextResponse.json({ ok: true, deleted: { id, language: lang.language, country: lang.country } });
  } catch (err) {
    console.error("DELETE /api/v1/quran/languages/[id] failed:", err);
    return apiError(500, "Failed to delete the language.");
  }
}
