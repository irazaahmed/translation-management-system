-- Migration: allow the type-specific extra stages on et_returns.stage.
--
-- The Returns panel now offers the item's actual pipeline stages (wsb's PIS/
-- FFM, magazine's DSN, books' RTP) instead of just the base 8, but the
-- original et_returns.stage CHECK constraint (see add_et_returns.sql) only
-- allowed the base 8 codes. Picking one of the extra stages for a wsb/
-- magazine/books item fails the INSERT with a generic "Failed to save" error.
-- Widen the constraint to match et_stages_stage_check.
--
-- Run this in the Supabase SQL Editor.

ALTER TABLE et_returns DROP CONSTRAINT IF EXISTS et_returns_stage_check;
ALTER TABLE et_returns ADD CONSTRAINT et_returns_stage_check
  CHECK (stage IN ('TR', 'IF', 'CM', 'ED', 'NR', 'ST', 'FF', 'FPR', 'PIS', 'FFM', 'DSN', 'RTP'));
