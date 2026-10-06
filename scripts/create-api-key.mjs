#!/usr/bin/env node
/**
 * Create (or revoke) an API key for the /api/v1 REST API.
 *
 *   node scripts/create-api-key.mjs --name zaki-assistant --scopes "items:read items:write"
 *   node scripts/create-api-key.mjs --revoke zaki-assistant
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env.local.
 * Only the SHA-256 hash is stored in public.api_keys (migration 010). The
 * plaintext key is printed to this terminal ONCE and never written anywhere —
 * copy it straight into the client's secret store.
 */
import { createHash, randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const VALID_SCOPES = ["items:read", "items:write"];

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

function fail(msg) {
  console.error(`Error: ${msg}`);
  process.exit(1);
}

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) fail("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing (run from the repo root).");

const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

const revoke = arg("revoke");
if (revoke) {
  const { data, error } = await supabase
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("name", revoke)
    .is("revoked_at", null)
    .select("id, key_prefix");
  if (error) fail(error.message);
  console.log(`Revoked ${data.length} key(s) named "${revoke}".`);
  process.exit(0);
}

const name = arg("name");
if (!name) fail('--name is required (e.g. --name zaki-assistant).');
const scopes = (arg("scopes") ?? "items:read").split(/[\s,]+/).filter(Boolean);
const bad = scopes.filter((s) => !VALID_SCOPES.includes(s));
if (bad.length) fail(`Unknown scope(s): ${bad.join(", ")}. Valid: ${VALID_SCOPES.join(", ")}.`);

const key = `tms_${randomBytes(32).toString("base64url")}`;
const { error } = await supabase.from("api_keys").insert({
  name,
  key_hash: createHash("sha256").update(key, "utf8").digest("hex"),
  key_prefix: key.slice(0, 12),
  scopes,
  created_by: arg("created-by") ?? process.env.USERNAME ?? process.env.USER ?? null,
});
if (error) fail(error.message);

console.log("");
console.log(`API key created: name="${name}" scopes=[${scopes.join(", ")}]`);
console.log("Copy it now — it is shown only this once and is not stored anywhere:");
console.log("");
console.log(`  ${key}`);
console.log("");
