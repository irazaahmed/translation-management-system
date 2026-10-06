# Handoff — TMS API for Zaki

**Production base URL:** `https://tms-dawateislami.vercel.app/api/v1`
**Full reference:** [`API_DOCS.md`](./API_DOCS.md)
**Deployed:** 2026-10-06 (commit `4b7a481`, via the normal push-to-`main` → Vercel flow)

## What was built

| Piece | Where |
|-------|-------|
| API-key auth: Bearer key, SHA-256 hash only, constant-time compare, scopes, ~100 req/min per key | `lib/api/auth.ts` |
| `api_keys` + `api_audit_log` tables (RLS on, service-role only) | `database/migrations/010_api_keys.sql` (applied) |
| `GET /items`: filters `category/status/type/holder/stage`, `sort`, `page/limit` | `app/api/v1/items/route.ts` |
| `GET /items/{id}`: meta, pipeline, tracking history, `currently_at`, `next_action` | `app/api/v1/items/[id]/route.ts` |
| `PATCH /items/{id}/pipeline`: `advance_to` (same as the "Move →" button) or explicit `stages` | `app/api/v1/items/[id]/pipeline/route.ts` |
| `GET /meta`: stage codes, per-type pipelines, categories, holders | `app/api/v1/meta/route.ts` |
| Shared shaping/validation, reusing `computeCurrentStep` / `computeAdvance` | `lib/api/items.ts` |
| Key create/revoke script | `scripts/create-api-key.mjs` |

The UI's behaviour is unchanged. The only edit to existing code: `patchEtStages()` in
`lib/etMutations.ts` takes an optional client, so the API can run the exact same write logic with
the service-role client. The UI still calls it with no client, exactly as before.

## Things Zaki should know

- **Pipelines vary by type.** Standard items have 8 stages (TR…FPR). `wsb` adds PIS and FFM,
  `mgz` adds DSN between FF and FPR, and `bks` adds RTP at the end. Use `GET /meta`; don't
  hard-code a 10-stage list.
- **To advance an item:** read `next_action.advance_to` from `GET /items/{id}`, then
  `PATCH .../pipeline {"advance_to": <that>, "holder": "<workforce name>"}`. Any other target
  returns `409` along with the correct `next_action`.
- **Holders** must be names from `/meta` → `holders` (case-insensitive). Unknown names → `400`.
- **Stopped items** can't be patched (`409`).
- Every API write is logged in `api_audit_log`, with the `note` you send.
- **Latency:** a cold list call (all ~357 items) took about 2.7 s and a PATCH about 3.7 s. Warm
  calls are faster. Either way it's much quicker than browser automation.

## Production test results (2026-10-06, 23/23 passed)

The tests used temporary keys that existed only in memory, plus a dummy item
("API SMOKE TEST — auto-deleted", type `dwk`). Both were deleted afterwards. No real item
was modified.

| Test | Result |
|------|--------|
| No key / bogus key | `401` ✅ |
| `GET /meta` | `200`: 12 stage codes, 8 types, 33 holders; wsb pipeline ends PIS, FFM ✅ |
| `GET /items?limit=200` | `200`, total 357 ✅ |
| `category=weekly-docs&status=active&sort=at-step-since` | `200`, 8 items, oldest-first ordering verified ✅ |
| `stage=IF` / `holder=…` / `type=mgz&sort=delivery-date` | `200`; every row matched its filter (6 / 10 / 25) ✅ |
| `limit=500&category=xyz` | `400` with both problems listed ✅ |
| `GET /items/{real id}` | `200`: "Currently at Initial Formation with Sagheer since 2025-01-04 (640 days here)", `next_action` = move IF → CM ✅ |
| Unknown id | `404` ✅ |
| PATCH with a read-only key | `403` ✅ |
| PATCH `advance_to: "ST"` on a fresh item | `409`: "The next allowed step is TR" ✅ |
| PATCH with unknown holder | `400` ✅ |
| PATCH `advance_to: "TR"` (start) | `200`: Currently at Translation ✅ |
| PATCH `advance_to: "IF"` (move) | `200`: Currently at Initial Formation, progress 1/8 ✅ |
| PATCH explicit `stages` (IF received, CM sent) | `200`: Currently at Comparison ✅ |
| PATCH with stage `DSN` on a non-magazine item | `400` ✅ |
| Stored `et_items.status` recalculated | `in_progress` ✅ |
| Audit log rows | 3 written ✅ |
| List reflects the PATCH right away (cache dropped) | ✅ |

Not tested on production: the 100/min rate limit. It's in memory per server instance, so treat
it as a soft limit.

## The Zaki key

Create it in **your own terminal**, from the repo root:

```
node scripts/create-api-key.mjs --name zaki-assistant --scopes "items:read items:write"
```

To revoke it: `node scripts/create-api-key.mjs --revoke zaki-assistant`

API key ka plaintext sirf terminal me ek baar dikhaya gaya tha — ye kahin save nahi hai. Ahmed ye key copy karke Zaki ke secure vault me save karega. Key ko chat ya kisi file me paste nahi karna.
