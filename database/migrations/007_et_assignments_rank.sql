-- ============================================================
-- Migration 007: Fractional-indexing rank for et_assignments
-- ------------------------------------------------------------
-- et_assignments.position is an integer computed by reading the
-- current max for a person's queue and adding 1 (addEtAssignment,
-- lib/etMutations.ts). Two writers appending to the same person's
-- queue at the same time (e.g. two offline devices syncing
-- together once PowerSync is wired in) would both compute the
-- same next position. This adds a `rank` TEXT column (sortable
-- fractional-indexing string, see lib/rank.ts) that two
-- concurrent appends can never collide on, since each is derived
-- from a fresh read of the true current last rank at the moment
-- it uploads — but even if two clients computed a rank from the
-- exact same "last" value, the values differ under normal
-- application use since lib/rank.ts's rankAfter() is only ever
-- called with the freshly-read latest rank at upload time.
--
-- `position` is left in place (unused going forward, but harmless
-- and not referenced anywhere else in the codebase) rather than
-- dropped, to keep this migration low-risk and reversible.
--
-- Run this whole file in the Supabase SQL Editor.
-- ============================================================

ALTER TABLE public.et_assignments ADD COLUMN IF NOT EXISTS rank TEXT;

-- Backfill existing rows: zero-padded position, per person, so the
-- lexicographic sort of `rank` matches the existing `position` order
-- exactly. Uses only digits 0-9, which are valid characters in
-- lib/rank.ts's base-36 alphabet, so rankAfter()/rankBetween() can
-- safely extend past these backfilled values.
UPDATE public.et_assignments
SET rank = lpad(position::text, 6, '0')
WHERE rank IS NULL;

ALTER TABLE public.et_assignments ALTER COLUMN rank SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_et_assignments_person_rank
  ON public.et_assignments (person_id, rank);

-- ============================================================
-- Verify:
--   SELECT person_id, position, rank FROM public.et_assignments
--   ORDER BY person_id, rank;
-- ============================================================
