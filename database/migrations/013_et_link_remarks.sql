-- ============================================================
-- Migration 013: "Link / remark missing" step after the final email
-- ------------------------------------------------------------
-- Sending the final email no longer completes an item. It moves to a new
-- status, 'link_missing' (the "Link / Remarks" tab), until the delivered
-- work's online / SharePoint link or a remark is recorded. Either one
-- then completes it.
--
-- Adds to et_items:
--   link_required    — this item needs a link / remark after its final email
--   delivery_link    — online or SharePoint link of the delivered work
--   delivery_remarks — remarks (instead of, or as well as, a link)
--   closeout_date    — when the link / remark was recorded
--
-- Applies to in-progress and new items only: items that are already
-- completed (or already have their completing final email) are marked
-- link_required = false and stay completed exactly as they are.
--
-- Run this whole file in the Supabase SQL Editor BEFORE deploying.
-- ============================================================

BEGIN;

ALTER TABLE public.et_items ADD COLUMN IF NOT EXISTS link_required BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.et_items ADD COLUMN IF NOT EXISTS delivery_link TEXT;
ALTER TABLE public.et_items ADD COLUMN IF NOT EXISTS delivery_remarks TEXT;
ALTER TABLE public.et_items ADD COLUMN IF NOT EXISTS closeout_date DATE;

-- Already-finished items keep their Completed status (no link needed).
-- wsb completes on its 2nd (Islamic Sisters) final email; every other type
-- on its final email.
UPDATE public.et_items
SET link_required = false
WHERE status = 'completed'
   OR (lower(coalesce(type, '')) = 'wsb' AND final_email_date_2 IS NOT NULL)
   OR (lower(coalesce(type, '')) <> 'wsb' AND final_email_date IS NOT NULL);

-- Allow the new stored status. The original CHECK was declared inline, so
-- find it by its definition rather than relying on its generated name.
DO $$
DECLARE c text;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.et_items'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%pending_assignment%'
  LOOP
    EXECUTE format('ALTER TABLE public.et_items DROP CONSTRAINT %I', c);
  END LOOP;
END $$;

ALTER TABLE public.et_items ADD CONSTRAINT et_items_status_check
  CHECK (status IN ('pending_assignment', 'in_progress', 'completed', 'link_missing'));

COMMIT;

-- ============================================================
-- Verify:
--   SELECT link_required, status, count(*) FROM public.et_items GROUP BY 1, 2 ORDER BY 1, 2;
--   -- Right after this runs no item is 'link_missing' yet: in-progress items
--   -- enter "Link / Remarks" when their final email is sent.
-- ============================================================
