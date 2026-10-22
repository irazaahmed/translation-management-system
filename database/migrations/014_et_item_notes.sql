-- ============================================================
-- Migration 014: Comment / note history for English items
-- ------------------------------------------------------------
-- An item's "Comment / note" (Books section) and "Notes / further
-- process" (item page) used to be one text field: saving a new comment
-- overwrote the old one. Every note is now kept as its own row, with the
-- date and who wrote it, so the full history stays visible.
--
-- et_items.further_process still holds the LATEST note, so lists,
-- search, exports and the API keep showing the current comment.
--
-- Existing comments are copied in as the first history entry. Their real
-- writing date was never stored, so the item's last-updated date is
-- used and they are labelled "Earlier comment".
--
-- Run this whole file in the Supabase SQL Editor BEFORE deploying.
-- Idempotent — safe to re-run.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.et_item_notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id     UUID NOT NULL REFERENCES public.et_items(id) ON DELETE CASCADE,
  body        TEXT NOT NULL CHECK (length(trim(body)) > 0),
  note_date   DATE NOT NULL DEFAULT ((now() AT TIME ZONE 'Asia/Karachi')::date),
  created_by  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS et_item_notes_item_idx ON public.et_item_notes (item_id, created_at DESC);

-- Same access as the other ET tables (migration 005): anyone can read,
-- only staff (admin / editor) can write.
ALTER TABLE public.et_item_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "et_item_notes_public_read"  ON public.et_item_notes;
DROP POLICY IF EXISTS "et_item_notes_staff_insert" ON public.et_item_notes;
DROP POLICY IF EXISTS "et_item_notes_staff_update" ON public.et_item_notes;
DROP POLICY IF EXISTS "et_item_notes_staff_delete" ON public.et_item_notes;
CREATE POLICY "et_item_notes_public_read"  ON public.et_item_notes FOR SELECT USING (true);
CREATE POLICY "et_item_notes_staff_insert" ON public.et_item_notes FOR INSERT WITH CHECK (public.is_staff());
CREATE POLICY "et_item_notes_staff_update" ON public.et_item_notes FOR UPDATE USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "et_item_notes_staff_delete" ON public.et_item_notes FOR DELETE USING (public.is_staff());

-- Seed: every existing comment becomes the first history entry (once).
INSERT INTO public.et_item_notes (item_id, body, note_date, created_by, created_at)
SELECT i.id,
       trim(i.further_process),
       (i.updated_at AT TIME ZONE 'Asia/Karachi')::date,
       'Earlier comment',
       i.updated_at
FROM public.et_items i
WHERE i.further_process IS NOT NULL
  AND trim(i.further_process) <> ''
  AND NOT EXISTS (SELECT 1 FROM public.et_item_notes n WHERE n.item_id = i.id);

COMMIT;

-- ============================================================
-- Verify:
--   SELECT count(*) FROM public.et_item_notes;   -- 76 on 2026-10-22
--   SELECT i.title, n.note_date, n.created_by, n.body
--   FROM public.et_item_notes n JOIN public.et_items i ON i.id = n.item_id
--   ORDER BY n.created_at DESC LIMIT 10;
-- ============================================================
