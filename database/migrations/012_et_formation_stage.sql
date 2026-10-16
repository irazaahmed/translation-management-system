-- ============================================================
-- Migration 012: One "Formation" (FO) step instead of IF + FF
-- ------------------------------------------------------------
-- Every type except Books now has a single Formation step (FO) right
-- after Comparison, replacing Initial Formation (IF) and Final
-- Formatting (FF):
--   standard  TR 1, CM 2, FO 3, ED 4, NR 5, ST 6, FPR 7
--   wsb       ... FPR 7, PIS 8, FFM 9
--   mgz       ... ST 6, DSN 7, FPR 8
-- Books keep IF and FF.
--
-- 1. Allow the new 'FO' code on et_stages and et_returns.
-- 2. Convert IN-PROGRESS items (not completed, not stopped, not Books)
--    that use at most one of IF / FF: the used row becomes FO (keeping
--    its holder and dates), the other is removed, and every stage is
--    renumbered to the new order. Their IF / FF return logs become FO.
--    Left as-is (keep IF + FF): completed items, stopped items, Books,
--    and items where BOTH IF and FF already have data.
--
-- Run this whole file in the Supabase SQL Editor BEFORE deploying.
-- ============================================================

BEGIN;

-- 1. Allow 'FO' --------------------------------------------------
ALTER TABLE et_stages DROP CONSTRAINT IF EXISTS et_stages_stage_check;
ALTER TABLE et_stages ADD CONSTRAINT et_stages_stage_check
  CHECK (stage IN ('TR', 'IF', 'CM', 'FO', 'ED', 'NR', 'ST', 'FF', 'FPR', 'PIS', 'FFM', 'DSN', 'RTP'));

ALTER TABLE et_returns DROP CONSTRAINT IF EXISTS et_returns_stage_check;
ALTER TABLE et_returns ADD CONSTRAINT et_returns_stage_check
  CHECK (stage IN ('TR', 'IF', 'CM', 'FO', 'ED', 'NR', 'ST', 'FF', 'FPR', 'PIS', 'FFM', 'DSN', 'RTP'));

-- 2. Pick the items to convert, and which of IF / FF becomes FO ---
-- "Has data" = a holder or a date. Prefer the row with data; otherwise
-- the one that is not skipped (N/A / Merged); otherwise IF.
CREATE TEMP TABLE fo_convert ON COMMIT DROP AS
WITH f AS (
  SELECT
    i.id AS item_id,
    lower(i.type) AS type,
    bool_or(s.stage = 'IF') AS has_if,
    bool_or(s.stage = 'FF') AS has_ff,
    bool_or(s.stage = 'IF' AND (s.person IS NOT NULL OR s.sent_date IS NOT NULL OR s.received_back_date IS NOT NULL)) AS if_data,
    bool_or(s.stage = 'FF' AND (s.person IS NOT NULL OR s.sent_date IS NOT NULL OR s.received_back_date IS NOT NULL)) AS ff_data,
    bool_or(s.stage = 'IF' AND NOT s.not_applicable AND NOT s.merged) AS if_active,
    bool_or(s.stage = 'FF' AND NOT s.not_applicable AND NOT s.merged) AS ff_active
  FROM et_items i
  JOIN et_stages s ON s.item_id = i.id
  WHERE lower(coalesce(i.type, '')) NOT IN ('bks', 'quran')
    AND i.status <> 'completed'
    AND NOT coalesce(i.stopped, false)
  GROUP BY i.id, i.type
)
SELECT
  item_id,
  type,
  CASE
    WHEN if_data THEN 'IF'
    WHEN ff_data THEN 'FF'
    WHEN has_if AND if_active THEN 'IF'
    WHEN has_ff AND ff_active THEN 'FF'
    WHEN has_if THEN 'IF'
    ELSE 'FF'
  END AS keep_stage
FROM f
WHERE (has_if OR has_ff)
  AND NOT (if_data AND ff_data);

-- Remove the IF / FF row that is not kept.
DELETE FROM et_stages s
USING fo_convert c
WHERE s.item_id = c.item_id
  AND s.stage IN ('IF', 'FF')
  AND s.stage <> c.keep_stage;

-- The kept row becomes Formation (holder and dates stay).
UPDATE et_stages s
SET stage = 'FO'
FROM fo_convert c
WHERE s.item_id = c.item_id
  AND s.stage = c.keep_stage;

-- Renumber every stage of the converted items to the new order.
UPDATE et_stages s
SET seq = CASE s.stage
    WHEN 'TR'  THEN 1
    WHEN 'CM'  THEN 2
    WHEN 'FO'  THEN 3
    WHEN 'ED'  THEN 4
    WHEN 'NR'  THEN 5
    WHEN 'ST'  THEN 6
    WHEN 'DSN' THEN 7
    WHEN 'FPR' THEN CASE WHEN c.type = 'mgz' THEN 8 ELSE 7 END
    WHEN 'PIS' THEN 8
    WHEN 'FFM' THEN 9
    ELSE s.seq
  END
FROM fo_convert c
WHERE s.item_id = c.item_id;

-- Return logs of the converted items: IF / FF -> FO.
UPDATE et_returns r
SET stage = 'FO'
FROM fo_convert c
WHERE r.item_id = c.item_id
  AND r.stage IN ('IF', 'FF');

COMMIT;

-- ============================================================
-- Verify (expected right after running: 20 items with an FO stage):
--   SELECT count(DISTINCT item_id) FROM et_stages WHERE stage = 'FO';
--   SELECT i.title, s.stage, s.seq FROM et_stages s JOIN et_items i ON i.id = s.item_id
--   WHERE s.item_id IN (SELECT item_id FROM et_stages WHERE stage = 'FO')
--   ORDER BY i.title, s.seq;
-- ============================================================
