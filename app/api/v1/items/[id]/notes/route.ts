import { NextResponse } from "next/server";
import { apiError, requireApiKey } from "@/lib/api/auth";
import { UUID_RE, applyAliases, isIsoDate, noteError, readJsonObject, unknownFieldsMessage } from "@/lib/api/common";
import { auditEt, revalidateEtAll } from "@/lib/api/etWrite";
import { loadItemFresh, loadNotesFresh } from "@/lib/api/items";
import { getCachedEtItem, getCachedEtItemNotesByItem } from "@/lib/etData";
import { addEtItemNote } from "@/lib/etMutations";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };
const ALLOWED = ["body", "date", "api_note"];

const out = (n: { id: string; body: string; note_date: string; created_by: string | null; created_at: string }) => ({
  id: n.id,
  body: n.body,
  date: n.note_date,
  by: n.created_by,
  created_at: n.created_at,
});

/** GET /api/v1/items/:id/notes — the item's comment / note history, newest first. */
export async function GET(request: Request, { params }: Ctx) {
  const auth = await requireApiKey(request, "items:read");
  if (auth.response) return auth.response;

  const { id } = await params;
  if (!UUID_RE.test(id)) return apiError(400, "Item id must be a UUID.");
  try {
    const [item, notes] = await Promise.all([getCachedEtItem(id), getCachedEtItemNotesByItem()]);
    if (!item) return apiError(404, "Item not found.");
    const list = notes.get(id) ?? [];
    return NextResponse.json({ item_id: id, title: item.title, latest: item.further_process, total: list.length, notes: list.map(out) });
  } catch (err) {
    console.error("GET /api/v1/items/[id]/notes failed:", err);
    return apiError(500, "Failed to load notes.");
  }
}

/**
 * POST /api/v1/items/:id/notes — add a comment / note (the Books card's "Add
 * note"). Earlier notes are kept; this one becomes the item's latest comment.
 * Body: { "body": "...", "date"?: "YYYY-MM-DD" }. "text" / "comment" are
 * accepted for "body"; "api_note" is the audit note.
 */
export async function POST(request: Request, { params }: Ctx) {
  const auth = await requireApiKey(request, "items:write");
  if (auth.response) return auth.response;

  const { id } = await params;
  if (!UUID_RE.test(id)) return apiError(400, "Item id must be a UUID.");
  const raw = await readJsonObject(request);
  if (!raw) return apiError(400, "Body must be a JSON object.");
  const body = applyAliases(raw, { text: "body", comment: "body", note_text: "body", note_date: "date" });
  const badNote = noteError(body.api_note);
  if (badNote) return apiError(400, badNote.replace('"note"', '"api_note"'));

  const problems: string[] = [];
  const unknown = Object.keys(body).filter((k) => !ALLOWED.includes(k));
  if (unknown.length) problems.push(unknownFieldsMessage(unknown, ALLOWED));
  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (!text) problems.push('"body" (the comment text) is required.');
  else if (text.length > 5000) problems.push('"body" must be at most 5000 characters.');
  if (body.date !== undefined && body.date !== null && !isIsoDate(body.date)) problems.push('"date" must be YYYY-MM-DD.');
  if (problems.length) return apiError(400, "Invalid request.", problems);

  try {
    const admin = createAdminClient();
    const item = await loadItemFresh(admin, id);
    if (!item) return apiError(404, "Item not found.");

    const note = await addEtItemNote(
      id,
      { body: text, note_date: (body.date as string | null | undefined) ?? null, author: `API · ${auth.key.name}` },
      admin
    );
    revalidateEtAll(id);
    await auditEt(admin, auth.key, {
      itemId: id,
      action: "note.create",
      request: { note_id: note.id, body: text, date: note.note_date },
      note: typeof body.api_note === "string" ? body.api_note : null,
    });

    const notes = await loadNotesFresh(admin, id);
    return NextResponse.json({ ok: true, note: out(note), total: notes.length, notes: notes.map(out) }, { status: 201 });
  } catch (err) {
    console.error("POST /api/v1/items/[id]/notes failed:", err);
    return apiError(500, "Failed to add the note.");
  }
}
