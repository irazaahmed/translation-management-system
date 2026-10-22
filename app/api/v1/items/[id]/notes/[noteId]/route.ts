import { NextResponse } from "next/server";
import { apiError, requireApiKey } from "@/lib/api/auth";
import { UUID_RE } from "@/lib/api/common";
import { auditEt, revalidateEtAll } from "@/lib/api/etWrite";
import { deleteEtItemNote } from "@/lib/etMutations";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; noteId: string }> };

/**
 * DELETE /api/v1/items/:id/notes/:noteId — remove one note from the history
 * (scope items:delete). The item's latest comment falls back to the newest
 * remaining note.
 */
export async function DELETE(request: Request, { params }: Ctx) {
  const auth = await requireApiKey(request, "items:delete");
  if (auth.response) return auth.response;

  const { id, noteId } = await params;
  if (!UUID_RE.test(id) || !UUID_RE.test(noteId)) return apiError(400, "Item id and note id must be UUIDs.");
  try {
    const admin = createAdminClient();
    const { data: note, error } = await admin.from("et_item_notes").select("*").eq("id", noteId).eq("item_id", id).maybeSingle();
    if (error) throw error;
    if (!note) return apiError(404, "Note not found on this item.");

    await deleteEtItemNote(noteId, admin);
    revalidateEtAll(id);
    await auditEt(admin, auth.key, {
      itemId: id,
      action: "note.delete",
      request: { deleted: note },
      note: new URL(request.url).searchParams.get("note")?.slice(0, 1000) ?? null,
    });
    return NextResponse.json({ ok: true, deleted: { id: noteId } });
  } catch (err) {
    console.error("DELETE /api/v1/items/[id]/notes/[noteId] failed:", err);
    return apiError(500, "Failed to delete the note.");
  }
}
