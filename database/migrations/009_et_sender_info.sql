-- ============================================================
-- Migration 009: Sender name/email on et_items
-- ------------------------------------------------------------
-- Work items can arrive without any record of who sent them in.
-- Adds optional sender_name / sender_email columns so staff can
-- note where a piece of work came from at creation time, and trace
-- it back later if needed.
--
-- Run this whole file in the Supabase SQL Editor.
-- ============================================================

ALTER TABLE public.et_items ADD COLUMN IF NOT EXISTS sender_name TEXT;
ALTER TABLE public.et_items ADD COLUMN IF NOT EXISTS sender_email TEXT;

-- ============================================================
-- Verify:
--   SELECT id, title, sender_name, sender_email FROM public.et_items LIMIT 5;
-- ============================================================
