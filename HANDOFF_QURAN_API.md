# Handoff — Quranic Translation API (v1)

**Production base URL:** `https://tms-dawateislami.vercel.app/api/v1/quran`
**Full reference:** [`API_DOCS.md` → Quranic Translation API](./API_DOCS.md#quranic-translation-api)
**Deployed:** 2026-10-06 (commit `311befd`, push-to-`main` → Vercel)
**Migration:** none needed. It reuses `api_keys` / `api_audit_log` from migration 010.

## What was built

| Endpoint | Scope | What it does |
|----------|-------|--------------|
| `GET /quran/meta` | `quran:read` | Stage keys and labels, standard vs Braille pipelines, statuses, priorities, weekdays, workforce, projects |
| `GET /quran/languages` | `quran:read` | Filters `status`, `country`, `responsible`, `priority`, `project`, `needs_attention`; `sort`; paging |
| `GET /quran/languages/{id}` | `quran:read` | Meta, per-stage para progress (full 1–30 grid), meetings (newest first), schedule info |
| `PATCH /quran/languages/{id}` | `quran:write` | Meta fields + `para_progress` (paras-reached counts or single-para edits) |
| `GET /quran/meetings` | `quran:read` | Filters `language_id`, `from`, `to`; paging; newest first |
| `GET /quran/meetings/{id}` | `quran:read` | One meeting |
| `POST /quran/meetings` | `quran:write` | Record a meeting |
| `PATCH /quran/meetings/{id}` | `quran:write` | Edit a meeting |
| `GET /quran/schedule` | `quran:read` | Weekly schedule for in-progress languages, most overdue first |

### File map

| File | Role |
|------|------|
| `app/api/v1/quran/**/route.ts` | Route handlers (auth → validate → reuse lib → audit → revalidate) |
| `lib/api/quran.ts` | Shaping, schedule info, PATCH planner (validation + ordering rule), meeting field parsing, fresh loaders, cache drop, audit |
| `lib/api/common.ts` | Shared helpers for both APIs (UUID, dates, paging, JSON body, note) |
| `lib/api/auth.ts` | Adds the `quran:read` / `quran:write` scopes |
| `lib/progress.ts` | New `buildParaCountRows()`. This is the "Para reached" logic, moved out of `ParaStageEditor.tsx` so the editor and the API share it |
| `lib/mutations.ts`, `lib/paraProgressMutations.ts` | `updateLanguage`, `createMeeting`, `updateMeeting` and `saveParaStage` take an optional client. The UI calls them exactly as before |
| `scripts/create-api-key.mjs` | New scopes, `--help`, and `--grant` (add scopes to an existing key) |

Nothing about the UI's behaviour changed. The progress editor imports the same row-building
logic from `lib/progress.ts` instead of defining it inline.

## Things the API consumer (Zaki) must know

1. **Pipelines differ.** Standard languages have 6 stages (translation, comparison, formation,
   tafteesh, designing, final_proof_reading). Braille languages (name contains "braille") have
   5: no formation or designing, plus `convert_into_braille`. Get them from `/quran/meta`.
2. **Ordering rule.** Comparison can't be ahead of translation, and no other stage can be ahead
   of either of them, counted in paras finished. A PATCH that breaks it → `400` with the reason.
   Update translation before comparison, and both before the later stages.
3. **Updating progress.** Use `{"stage": "...", "paras_finished": N}`, the same as typing "Para
   reached = N" and pressing Save in the UI. Lowering N clears those paras' dates, so the API
   requires `"allow_decrease": true` for that. Use `{"stage", "para", "person_id",
   "started_at", "finished_at"}` to record who is working on a single para.
4. **Recording a meeting.** `POST /quran/meetings` with `language_id` (everything else is
   optional; `meeting_date` defaults to today, Pakistan time). `last_meeting_at` always moves
   to the latest meeting date. The response includes the language's new schedule state.
5. **`needs_attention`** means the same as on the dashboard: in progress, and no meeting in
   14+ days.
6. **All-or-nothing.** If any part of a PATCH is invalid, nothing is written, and the `400`
   lists every problem.
7. **Audit.** Every write lands in `api_audit_log` with `item_id` = the language id and the
   `note` you send.

### Notes from the production run

- **All 23 in-progress languages currently show `needs_attention: true`.** The latest
  meeting in TMS is from 2026-08-22, so none has had a meeting in the last 14 days. This is
  real data, not an API bug. It is the same count the dashboard shows.
- **The ordering rule wasn't enforced anywhere before.** It existed only as a comment in
  `lib/progress.ts`, and the UI editor still doesn't enforce it. The API does, but only for
  the stages each request touches.
- **The DB trigger on `meetings` copies the written meeting's date into
  `languages.last_meeting_at`.** So adding or editing an *older* meeting through the UI can
  move it backwards. The API re-syncs it to the latest date after every meeting write.
- **`languages.project_id` is NOT NULL** in the live DB, although the schema file allows NULL.
- **Speed:** a cold list call took about 2.4 s and a PATCH about 2.5 s.

## Production test results (2026-10-06, 41/41 passed)

The tests used temporary keys that existed only in memory, plus a dummy project, language
("API SMOKE TEST", Testland), meetings and para rows. All of it was deleted afterwards. No real
data was modified. The English suite was re-run after this change: 23/23 passed.

| Area | Checks |
|------|--------|
| Auth | No key → `401`; key with only `items:*` scopes → `403`; read-only key on PATCH → `403` |
| `/meta` | Standard pipeline has 6 stages, Braille has 5; 27 workforce members, 3 projects |
| `/languages` | 33 total; `status=in_progress&sort=progress` → 23, highest first (Chinese 92%); `needs_attention=true` → 23; `sort=last-meeting` ordering; `priority=high` → 3; project filter by name → 26; responsible filter is case-insensitive; bad params → `400` listing all 3 problems |
| `/languages/{id}` | Real language read: Chinese 92%, 9 meetings, "75 days overdue", every stage has a 30-para grid; unknown id → `404`; non-UUID → `400` |
| `/schedule` | 23 in-progress languages, most overdue first (Pashto, 113 days) |
| `/meetings` | 194 total, newest first; `from/to` range filter |
| PATCH meta | responsible, priority and `assigned_day: "monday"` → "Monday" |
| PATCH para counts | translation 10 + comparison 5 in one request |
| Ordering rule | formation 8 > comparison 5 → `400`; comparison 12 > translation 10 → `400`; lowering translation without `allow_decrease` → `400`; with it, but leaving comparison ahead → `400` |
| Other validation | Braille-only stage on a standard language → `400`; unknown field → `400`; unknown `person_id` → `400`; rejected requests wrote nothing (verified) |
| Single para | formation para 1 → in progress, with the person's name |
| Meetings | POST → `201`, last meeting 2026-10-05, "Met this week"; a backdated POST kept last meeting at 2026-10-05; bad body → `400`; unknown language → `404`; PATCH edits fields; `language_id` is read-only (`400`); GET by id; filter by language |
| Cache | Detail and list reflected the writes immediately (para cache dropped) |
| Audit | 6 rows for 6 successful writes |

Not tested on production: the ~100/min rate limit (in memory per instance, soft).

## Giving Zaki access

The existing `zaki-assistant` key only has the `items:*` scopes. To add Quran access without
changing the key, run this in your own terminal from the repo root:

```
node scripts/create-api-key.mjs --grant zaki-assistant --scopes "quran:read quran:write"
```

Then give Muse the docs link again so it adds the Quran endpoints to its connector.

API key ka plaintext sirf terminal me ek baar dikhaya gaya tha — ye kahin save nahi hai. Ahmed ye key copy karke Zaki ke secure vault me save karega. Key ko chat ya kisi file me paste nahi karna.
