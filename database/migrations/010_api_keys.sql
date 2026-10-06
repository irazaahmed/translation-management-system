-- ============================================================
-- Migration 010: API keys for the /api/v1 REST API
-- ------------------------------------------------------------
-- Machine clients (e.g. the "Zaki" assistant) authenticate with
-- "Authorization: Bearer tms_..." keys. Only the SHA-256 hash of a
-- key is stored — the plaintext is shown once at creation time
-- (scripts/create-api-key.mjs) and never written anywhere.
--
-- api_audit_log records every write made through the API (which
-- key, which item, what was sent, the optional note), since API
-- writes bypass the per-user session.
--
-- Both tables have RLS enabled with NO policies, so only the
-- service-role key (server side) can read or write them.
--
-- Run this whole file in the Supabase SQL Editor. Idempotent.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.api_keys (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  key_hash      TEXT NOT NULL UNIQUE,          -- hex SHA-256 of the full key
  key_prefix    TEXT NOT NULL,                 -- first 12 chars, for lookup/identification
  scopes        TEXT[] NOT NULL DEFAULT '{}',  -- e.g. {items:read,items:write}
  created_by    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at    TIMESTAMPTZ,
  last_used_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS api_keys_key_prefix_idx ON public.api_keys (key_prefix);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.api_audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_id      UUID REFERENCES public.api_keys(id) ON DELETE SET NULL,
  key_name    TEXT,
  item_id     UUID,
  action      TEXT NOT NULL,
  request     JSONB,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS api_audit_log_item_idx ON public.api_audit_log (item_id, created_at DESC);

ALTER TABLE public.api_audit_log ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Verify:
--   SELECT id, name, key_prefix, scopes, created_at, revoked_at FROM public.api_keys;
-- Revoke a key:
--   UPDATE public.api_keys SET revoked_at = now() WHERE name = '<name>';
-- ============================================================
