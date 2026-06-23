-- Migration: "Return to complete missing part" log for ET work items.
-- Run this in the Supabase SQL Editor.
--
-- Sometimes an item moves on a few stages and only then does someone notice a
-- missing or incorrect part, so it is handed BACK to be completed. This table
-- records each such return like a normal hand-off: an optional note of what was
-- missing, who it went to, when it was given (sent_date) and when it came back
-- (received_back_date). It does NOT change the 8-stage pipeline.

CREATE TABLE IF NOT EXISTS et_returns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id UUID NOT NULL REFERENCES et_items(id) ON DELETE CASCADE,
  -- Pipeline stage it was sent back to (optional).
  stage TEXT CHECK (stage IN ('TR', 'IF', 'CM', 'ED', 'NR', 'ST', 'FF', 'FPR')),
  -- What was missing / needs completing.
  note TEXT,
  person TEXT,
  sent_date DATE,
  received_back_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_et_returns_item ON et_returns(item_id);

ALTER TABLE et_returns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on et_returns" ON et_returns;
CREATE POLICY "Allow all on et_returns" ON et_returns FOR ALL USING (true) WITH CHECK (true);
