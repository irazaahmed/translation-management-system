-- ============================================================
-- Migration 005: Harden RLS on the English Translation (ET)
-- tables + stage_progress
-- ------------------------------------------------------------
-- These tables were created with wide-open "FOR ALL USING (true)"
-- policies, relying only on the app layer (requireStaff() /
-- requireAdmin() in lib/auth.ts) to block writes from non-staff.
-- This migration brings them in line with languages/meetings/
-- projects (migration 003/003b): public SELECT, staff-only
-- INSERT/UPDATE/DELETE, enforced by public.is_staff() at the
-- database level.
--
-- Requires public.is_staff() / public.is_admin() from migration
-- 003 (already applied). Idempotent — safe to re-run.
--
-- Run this whole file in the Supabase SQL Editor.
-- ============================================================

-- ET_PEOPLE -----------------------------------------------------
ALTER TABLE public.et_people ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on et_people"     ON public.et_people;
DROP POLICY IF EXISTS "et_people_public_read"      ON public.et_people;
DROP POLICY IF EXISTS "et_people_staff_insert"     ON public.et_people;
DROP POLICY IF EXISTS "et_people_staff_update"     ON public.et_people;
DROP POLICY IF EXISTS "et_people_staff_delete"     ON public.et_people;

CREATE POLICY "et_people_public_read"  ON public.et_people
  FOR SELECT USING (true);
CREATE POLICY "et_people_staff_insert" ON public.et_people
  FOR INSERT WITH CHECK (public.is_staff());
CREATE POLICY "et_people_staff_update" ON public.et_people
  FOR UPDATE USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "et_people_staff_delete" ON public.et_people
  FOR DELETE USING (public.is_staff());

-- ET_ITEMS --------------------------------------------------------
ALTER TABLE public.et_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on et_items"     ON public.et_items;
DROP POLICY IF EXISTS "et_items_public_read"      ON public.et_items;
DROP POLICY IF EXISTS "et_items_staff_insert"     ON public.et_items;
DROP POLICY IF EXISTS "et_items_staff_update"     ON public.et_items;
DROP POLICY IF EXISTS "et_items_staff_delete"     ON public.et_items;

CREATE POLICY "et_items_public_read"  ON public.et_items
  FOR SELECT USING (true);
CREATE POLICY "et_items_staff_insert" ON public.et_items
  FOR INSERT WITH CHECK (public.is_staff());
CREATE POLICY "et_items_staff_update" ON public.et_items
  FOR UPDATE USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "et_items_staff_delete" ON public.et_items
  FOR DELETE USING (public.is_staff());

-- ET_STAGES -------------------------------------------------------
ALTER TABLE public.et_stages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on et_stages"     ON public.et_stages;
DROP POLICY IF EXISTS "et_stages_public_read"      ON public.et_stages;
DROP POLICY IF EXISTS "et_stages_staff_insert"     ON public.et_stages;
DROP POLICY IF EXISTS "et_stages_staff_update"     ON public.et_stages;
DROP POLICY IF EXISTS "et_stages_staff_delete"     ON public.et_stages;

CREATE POLICY "et_stages_public_read"  ON public.et_stages
  FOR SELECT USING (true);
CREATE POLICY "et_stages_staff_insert" ON public.et_stages
  FOR INSERT WITH CHECK (public.is_staff());
CREATE POLICY "et_stages_staff_update" ON public.et_stages
  FOR UPDATE USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "et_stages_staff_delete" ON public.et_stages
  FOR DELETE USING (public.is_staff());

-- ET_RETURNS ------------------------------------------------------
ALTER TABLE public.et_returns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on et_returns"     ON public.et_returns;
DROP POLICY IF EXISTS "et_returns_public_read"      ON public.et_returns;
DROP POLICY IF EXISTS "et_returns_staff_insert"     ON public.et_returns;
DROP POLICY IF EXISTS "et_returns_staff_update"     ON public.et_returns;
DROP POLICY IF EXISTS "et_returns_staff_delete"     ON public.et_returns;

CREATE POLICY "et_returns_public_read"  ON public.et_returns
  FOR SELECT USING (true);
CREATE POLICY "et_returns_staff_insert" ON public.et_returns
  FOR INSERT WITH CHECK (public.is_staff());
CREATE POLICY "et_returns_staff_update" ON public.et_returns
  FOR UPDATE USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "et_returns_staff_delete" ON public.et_returns
  FOR DELETE USING (public.is_staff());

-- ET_ASSIGNMENTS ----------------------------------------------------
ALTER TABLE public.et_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on et_assignments"     ON public.et_assignments;
DROP POLICY IF EXISTS "et_assignments_public_read"      ON public.et_assignments;
DROP POLICY IF EXISTS "et_assignments_staff_insert"     ON public.et_assignments;
DROP POLICY IF EXISTS "et_assignments_staff_update"     ON public.et_assignments;
DROP POLICY IF EXISTS "et_assignments_staff_delete"     ON public.et_assignments;

CREATE POLICY "et_assignments_public_read"  ON public.et_assignments
  FOR SELECT USING (true);
CREATE POLICY "et_assignments_staff_insert" ON public.et_assignments
  FOR INSERT WITH CHECK (public.is_staff());
CREATE POLICY "et_assignments_staff_update" ON public.et_assignments
  FOR UPDATE USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "et_assignments_staff_delete" ON public.et_assignments
  FOR DELETE USING (public.is_staff());

-- STAGE_PROGRESS ----------------------------------------------------
ALTER TABLE public.stage_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations on stage_progress" ON public.stage_progress;
DROP POLICY IF EXISTS "stage_progress_public_read"             ON public.stage_progress;
DROP POLICY IF EXISTS "stage_progress_staff_insert"            ON public.stage_progress;
DROP POLICY IF EXISTS "stage_progress_staff_update"            ON public.stage_progress;
DROP POLICY IF EXISTS "stage_progress_staff_delete"            ON public.stage_progress;

CREATE POLICY "stage_progress_public_read"  ON public.stage_progress
  FOR SELECT USING (true);
CREATE POLICY "stage_progress_staff_insert" ON public.stage_progress
  FOR INSERT WITH CHECK (public.is_staff());
CREATE POLICY "stage_progress_staff_update" ON public.stage_progress
  FOR UPDATE USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "stage_progress_staff_delete" ON public.stage_progress
  FOR DELETE USING (public.is_staff());

-- ============================================================
-- Verify:
--   SELECT tablename, policyname, cmd FROM pg_policies
--   WHERE tablename IN ('et_people','et_items','et_stages',
--     'et_returns','et_assignments','stage_progress')
--   ORDER BY tablename, cmd;
-- ============================================================
