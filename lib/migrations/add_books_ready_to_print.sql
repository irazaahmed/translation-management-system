-- Migration: books (bks) "Ready to Print" (RTP) stage.
--
-- A book gets one extra step at the very END of its pipeline: after Final
-- Proofreading (FPR) it is "Ready to Print" (RTP, seq 9). The standard pipeline
-- (TR..FPR = 1-8) is unchanged; RTP is simply appended at seq 9. Every other
-- content type is unaffected.
--
-- IMPORTANT — already-completed books are left exactly as they are: this only
-- adds the RTP step to books that are still in process (or waiting to start), so
-- finished work keeps its existing pipeline and stays Complete. New books get
-- the RTP row automatically (see blankStages / stagesForType in lib/et.ts).
--
-- Run this in the Supabase SQL Editor (after add_magazine_designing.sql).

-- 1) Allow the new stage code on et_stages.
ALTER TABLE et_stages DROP CONSTRAINT IF EXISTS et_stages_stage_check;
ALTER TABLE et_stages ADD CONSTRAINT et_stages_stage_check
  CHECK (stage IN ('TR', 'IF', 'CM', 'ED', 'NR', 'ST', 'FF', 'FPR', 'PIS', 'FFM', 'DSN', 'RTP'));

-- 2) Add the "Ready to Print" stage (seq 9) to books that are NOT completed and
--    don't already have it. Completed books (final email sent, or status marked
--    completed) are deliberately skipped so finished work is not disturbed.
INSERT INTO et_stages (item_id, stage, seq)
SELECT i.id, 'RTP', 9
FROM et_items i
WHERE lower(i.type) = 'bks'
  AND i.final_email_date IS NULL
  AND (i.status IS NULL OR i.status <> 'completed')
  AND NOT EXISTS (SELECT 1 FROM et_stages s WHERE s.item_id = i.id AND s.stage = 'RTP');
