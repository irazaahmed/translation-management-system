-- Migration: wsb (Weekly Speech Brothers) "Islamic Sisters" phase.
--
-- A wsb speech, after the standard 8 stages + first final email (handed to the
-- Islamic Sisters), goes through 2 extra stages — "Prepared for Islamic Sister"
-- (PIS) and "Final Formation" (FFM) — and is then completed by a SECOND final
-- email. Every other content type is unaffected.
--
-- Run this in the Supabase SQL Editor (after add_english_translation.sql and
-- add_stage_merged.sql).

-- 1) Allow the two new stage codes on et_stages.
ALTER TABLE et_stages DROP CONSTRAINT IF EXISTS et_stages_stage_check;
ALTER TABLE et_stages ADD CONSTRAINT et_stages_stage_check
  CHECK (stage IN ('TR', 'IF', 'CM', 'ED', 'NR', 'ST', 'FF', 'FPR', 'PIS', 'FFM'));

-- 2) Second (sisters') final email date — what actually completes a wsb item.
ALTER TABLE et_items ADD COLUMN IF NOT EXISTS final_email_date_2 DATE;

-- 3) Add the 2 extra stages to existing wsb items that don't have them yet.
--    (not_applicable / merged take their column defaults of false.)
INSERT INTO et_stages (item_id, stage, seq)
SELECT i.id, v.stage, v.seq
FROM et_items i
CROSS JOIN (VALUES ('PIS', 9), ('FFM', 10)) AS v(stage, seq)
WHERE lower(i.type) = 'wsb'
  AND NOT EXISTS (SELECT 1 FROM et_stages s WHERE s.item_id = i.id AND s.stage = v.stage);
