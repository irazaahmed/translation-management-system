-- ============================================================
-- Migration 008: Revert the offline-sync prep (005, 006, 007)
-- ------------------------------------------------------------
-- The PowerSync-based offline-first effort was abandoned. This
-- undoes everything migrations 005-007 changed, restoring the
-- exact previous behavior. Run this whole file in the Supabase
-- SQL Editor — and run it BEFORE using the app again, since the
-- application code has already been reverted to not set
-- `et_assignments.rank`, which is currently NOT NULL (from
-- migration 007) and would otherwise break every new assignment.
-- ============================================================

-- ------------------------------------------------------------
-- Revert 007: drop the rank column (and its index) from et_assignments.
-- ------------------------------------------------------------
DROP INDEX IF EXISTS idx_et_assignments_person_rank;
ALTER TABLE public.et_assignments DROP COLUMN IF EXISTS rank;

-- ------------------------------------------------------------
-- Revert 006: drop the languages uniqueness backstop.
-- ------------------------------------------------------------
DROP INDEX IF EXISTS languages_project_lang_country_uniq;

-- ------------------------------------------------------------
-- Revert 005: restore the original wide-open policies on the ET
-- tables + stage_progress (app-layer requireStaff()/requireAdmin()
-- checks in lib/auth.ts remain exactly as they always were).
-- ------------------------------------------------------------

-- ET_PEOPLE
DROP POLICY IF EXISTS "et_people_public_read"  ON public.et_people;
DROP POLICY IF EXISTS "et_people_staff_insert" ON public.et_people;
DROP POLICY IF EXISTS "et_people_staff_update" ON public.et_people;
DROP POLICY IF EXISTS "et_people_staff_delete" ON public.et_people;
CREATE POLICY "Allow all on et_people" ON public.et_people FOR ALL USING (true) WITH CHECK (true);

-- ET_ITEMS
DROP POLICY IF EXISTS "et_items_public_read"  ON public.et_items;
DROP POLICY IF EXISTS "et_items_staff_insert" ON public.et_items;
DROP POLICY IF EXISTS "et_items_staff_update" ON public.et_items;
DROP POLICY IF EXISTS "et_items_staff_delete" ON public.et_items;
CREATE POLICY "Allow all on et_items" ON public.et_items FOR ALL USING (true) WITH CHECK (true);

-- ET_STAGES
DROP POLICY IF EXISTS "et_stages_public_read"  ON public.et_stages;
DROP POLICY IF EXISTS "et_stages_staff_insert" ON public.et_stages;
DROP POLICY IF EXISTS "et_stages_staff_update" ON public.et_stages;
DROP POLICY IF EXISTS "et_stages_staff_delete" ON public.et_stages;
CREATE POLICY "Allow all on et_stages" ON public.et_stages FOR ALL USING (true) WITH CHECK (true);

-- ET_RETURNS
DROP POLICY IF EXISTS "et_returns_public_read"  ON public.et_returns;
DROP POLICY IF EXISTS "et_returns_staff_insert" ON public.et_returns;
DROP POLICY IF EXISTS "et_returns_staff_update" ON public.et_returns;
DROP POLICY IF EXISTS "et_returns_staff_delete" ON public.et_returns;
CREATE POLICY "Allow all on et_returns" ON public.et_returns FOR ALL USING (true) WITH CHECK (true);

-- ET_ASSIGNMENTS
DROP POLICY IF EXISTS "et_assignments_public_read"  ON public.et_assignments;
DROP POLICY IF EXISTS "et_assignments_staff_insert" ON public.et_assignments;
DROP POLICY IF EXISTS "et_assignments_staff_update" ON public.et_assignments;
DROP POLICY IF EXISTS "et_assignments_staff_delete" ON public.et_assignments;
CREATE POLICY "Allow all on et_assignments" ON public.et_assignments FOR ALL USING (true) WITH CHECK (true);

-- STAGE_PROGRESS
DROP POLICY IF EXISTS "stage_progress_public_read"  ON public.stage_progress;
DROP POLICY IF EXISTS "stage_progress_staff_insert" ON public.stage_progress;
DROP POLICY IF EXISTS "stage_progress_staff_update" ON public.stage_progress;
DROP POLICY IF EXISTS "stage_progress_staff_delete" ON public.stage_progress;
CREATE POLICY "Allow all operations on stage_progress" ON public.stage_progress FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- Verify:
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'et_assignments' AND column_name = 'rank';  -- should return 0 rows
--
--   SELECT indexname FROM pg_indexes
--   WHERE tablename = 'languages' AND indexname = 'languages_project_lang_country_uniq'; -- 0 rows
--
--   SELECT tablename, policyname FROM pg_policies
--   WHERE tablename IN ('et_people','et_items','et_stages','et_returns','et_assignments','stage_progress');
--   -- should show only the original "Allow all ..." policies again
-- ============================================================
