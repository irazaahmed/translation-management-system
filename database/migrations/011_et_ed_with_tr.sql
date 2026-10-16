-- ============================================================
-- Migration 011: Combine Editing (ED) with Translation (TR)
-- ------------------------------------------------------------
-- Translation is now almost always done with AI, and Editing is done
-- together with it (same person, same dates). Adds a with_tr flag on
-- et_stages: when set on an item's ED row, ED is not a separate step —
-- it is skipped like N/A and the TR step ("Translation & Editing")
-- covers both. Items translated manually leave it false and keep ED
-- as its own step.
--
-- New items get with_tr = true on ED by default (set by the app).
-- Existing items are NOT changed — their ED history stays as recorded.
--
-- Run this whole file in the Supabase SQL Editor BEFORE deploying.
-- ============================================================

ALTER TABLE public.et_stages
  ADD COLUMN IF NOT EXISTS with_tr BOOLEAN NOT NULL DEFAULT false;

-- ============================================================
-- Verify:
--   SELECT stage, with_tr, count(*) FROM public.et_stages
--   WHERE stage = 'ED' GROUP BY 1, 2;
-- ============================================================
