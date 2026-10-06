import "server-only";
import { createHash, timingSafeEqual } from "crypto";
import { NextResponse, after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * API-key auth for the /api/v1 REST API (used by machine clients such as the
 * "Zaki" assistant). Keys look like `tms_<43 base64url chars>` and are sent as
 * `Authorization: Bearer <key>`. Only the SHA-256 hash is stored (api_keys
 * table, migration 010); the key itself is never logged or persisted.
 */

export type ApiScope = "items:read" | "items:write";

export interface ApiKey {
  id: string;
  name: string;
  scopes: string[];
}

/** First 12 chars of a key ("tms_" + 8) — stored in clear to narrow the lookup. */
export const KEY_PREFIX_LENGTH = 12;
const KEY_PATTERN = /^tms_[A-Za-z0-9_-]{43}$/;

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex");
}

/** JSON error in the shape every /api/v1 route returns. */
export function apiError(
  status: number,
  error: string,
  details?: unknown,
  headers?: Record<string, string>
): NextResponse {
  return NextResponse.json(details === undefined ? { error } : { error, details }, { status, headers });
}

// ---- Rate limit: ~100 requests / minute per key (in-memory, per instance) ----

const RATE_LIMIT = 100;
const RATE_WINDOW_MS = 60_000;
const hits = new Map<string, number[]>();

function rateLimit(keyId: string): { ok: true } | { ok: false; retryAfter: number } {
  const now = Date.now();
  const recent = (hits.get(keyId) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) {
    hits.set(keyId, recent);
    return { ok: false, retryAfter: Math.ceil((recent[0] + RATE_WINDOW_MS - now) / 1000) };
  }
  recent.push(now);
  hits.set(keyId, recent);
  return { ok: true };
}

/**
 * Authenticate the request and check it carries `scope`. Returns the key on
 * success, or a ready-to-return error response (401 / 403 / 429).
 */
export async function requireApiKey(
  request: Request,
  scope: ApiScope
): Promise<{ key: ApiKey; response?: never } | { key?: never; response: NextResponse }> {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  const unauthorized = () => ({
    response: apiError(401, "Missing or invalid API key.", undefined, {
      "WWW-Authenticate": 'Bearer realm="tms-api"',
    }),
  });
  if (!match || !KEY_PATTERN.test(match[1])) return unauthorized();

  const presented = Buffer.from(hashApiKey(match[1]), "hex");
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("api_keys")
    .select("id, name, key_hash, scopes, revoked_at")
    .eq("key_prefix", match[1].slice(0, KEY_PREFIX_LENGTH));
  if (error) {
    console.error("API key lookup failed:", error.message);
    return { response: apiError(500, "Authentication is unavailable right now.") };
  }

  // Constant-time compare against every candidate sharing the prefix.
  const row = (data ?? []).find((r) => {
    const stored = Buffer.from(String(r.key_hash), "hex");
    return stored.length === presented.length && timingSafeEqual(stored, presented);
  });
  if (!row || row.revoked_at) return unauthorized();

  const key: ApiKey = { id: row.id, name: row.name, scopes: row.scopes ?? [] };
  if (!key.scopes.includes(scope)) {
    return { response: apiError(403, `This API key lacks the "${scope}" scope.`) };
  }

  const limited = rateLimit(key.id);
  if (!limited.ok) {
    return {
      response: apiError(429, "Rate limit exceeded (100 requests/minute).", undefined, {
        "Retry-After": String(limited.retryAfter),
      }),
    };
  }

  // Best-effort usage stamp, run after the response is sent.
  after(async () => {
    const { error: e } = await admin
      .from("api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", key.id);
    if (e) console.error("api_keys last_used_at update failed:", e.message);
  });

  return { key };
}
