-- Migration: Per-para progress tracking (who, since when, finished when)
-- Run this SQL in your Supabase SQL Editor.
--
-- Replaces the old hand-typed `stage_progress.current_para` counter with real
-- per-para rows: one row per (language, stage, para 1..30), each carrying who
-- is working it, when they started, and when it finished. Progress bars are
-- now DERIVED from these rows (count of finished paras per stage) instead of
-- being typed in by hand — the same idea as et_stages for English Translation.
--
-- Paras can be worked in parallel (multiple paras of the same stage active at
-- once, by different people) — there's no ordering constraint at the DB level.
--
-- `stage_progress` is NOT dropped or modified — this migration only backfills
-- FROM it once, so existing percentages carry over instead of resetting to 0.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Table: quran_people (Quranic-side workforce)
-- ============================================
CREATE TABLE IF NOT EXISTS quran_people (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- Table: para_progress (one row per language x stage x para)
-- ============================================
CREATE TABLE IF NOT EXISTS para_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  language_id UUID NOT NULL REFERENCES languages(id) ON DELETE CASCADE,
  stage TEXT NOT NULL CHECK (stage IN (
    'translation',
    'comparison',
    'formation',
    'convert_into_braille',
    'tafteesh',
    'designing',
    'final_proof_reading'
  )),
  para_number INTEGER NOT NULL CHECK (para_number >= 1 AND para_number <= 30),
  person_id UUID REFERENCES quran_people(id) ON DELETE SET NULL,
  started_at DATE,
  finished_at DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- One row per (language, stage, para) — no row at all means "not started".
  UNIQUE (language_id, stage, para_number)
);

CREATE INDEX IF NOT EXISTS idx_para_progress_language ON para_progress(language_id);
CREATE INDEX IF NOT EXISTS idx_para_progress_person ON para_progress(person_id);
CREATE INDEX IF NOT EXISTS idx_para_progress_stage ON para_progress(stage);

-- ============================================
-- Trigger: keep para_progress.updated_at fresh
-- ============================================
CREATE OR REPLACE FUNCTION para_progress_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_para_progress_updated_at ON para_progress;
CREATE TRIGGER trg_para_progress_updated_at
BEFORE UPDATE ON para_progress
FOR EACH ROW EXECUTE FUNCTION para_progress_touch_updated_at();

-- ============================================
-- Row Level Security (match existing tables: open policies;
-- writes are gated in server actions via requireStaff()).
-- ============================================
ALTER TABLE quran_people ENABLE ROW LEVEL SECURITY;
ALTER TABLE para_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on quran_people" ON quran_people;
CREATE POLICY "Allow all on quran_people" ON quran_people FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on para_progress" ON para_progress;
CREATE POLICY "Allow all on para_progress" ON para_progress FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- Backfill: turn each existing stage_progress.current_para=N into N
-- "finished" para rows, so progress bars don't reset to 0 after this
-- migration. The assignee is unknown for this historical work (person_id
-- stays NULL — reports will show it as "Unassigned").
-- ============================================
INSERT INTO para_progress (language_id, stage, para_number, finished_at)
SELECT
  sp.language_id,
  sp.stage,
  gs.para_number,
  COALESCE(sp.since_date, sp.updated_at::date, CURRENT_DATE)
FROM stage_progress sp
CROSS JOIN LATERAL generate_series(1, sp.current_para) AS gs(para_number)
WHERE sp.current_para > 0
ON CONFLICT (language_id, stage, para_number) DO NOTHING;
