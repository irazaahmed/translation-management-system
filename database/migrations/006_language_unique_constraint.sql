-- ============================================================
-- Migration 006: DB-level uniqueness backstop for languages
-- ------------------------------------------------------------
-- createLanguage() (lib/mutations.ts) already checks for a
-- duplicate language+country within a project before inserting,
-- but that check-then-insert has a race window: two writers
-- (e.g. two offline devices syncing at the same time once
-- PowerSync is wired in) could both pass the check before either
-- commits. This adds a real unique index so the database itself
-- rejects the second one instead of silently creating a duplicate.
--
-- Run this whole file in the Supabase SQL Editor.
-- ============================================================

-- 1. Check for existing duplicates FIRST — if this returns any
--    rows, resolve them manually (merge/rename/delete) before
--    running the CREATE UNIQUE INDEX below, or it will fail.
--
--   SELECT project_id, lower(language) AS language, lower(country) AS country, COUNT(*)
--   FROM public.languages
--   GROUP BY project_id, lower(language), lower(country)
--   HAVING COUNT(*) > 1;

-- 2. Add the unique index (case-insensitive on language + country, scoped per project).
CREATE UNIQUE INDEX IF NOT EXISTS languages_project_lang_country_uniq
  ON public.languages (project_id, lower(language), lower(country));

-- ============================================================
-- Verify:
--   SELECT indexname, indexdef FROM pg_indexes
--   WHERE tablename = 'languages' AND indexname = 'languages_project_lang_country_uniq';
-- ============================================================
