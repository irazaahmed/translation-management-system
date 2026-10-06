# TMS REST API (v1)

A small, versioned JSON API for machine clients (e.g. the "Zaki" assistant), covering both
workspaces:

- **English Translation** work items: `/api/v1/items`, `/api/v1/meta` ([jump](#english-translation-api)).
- **Quranic Translation** languages, para progress and meetings: `/api/v1/quran/*`
  ([jump](#quranic-translation-api)).

It is additive: the web UI is unchanged, and every rule comes from the same code the UI uses
(`lib/et.ts`, `lib/etMutations.ts`, `lib/progress.ts`, `lib/schedule.ts`, `lib/mutations.ts`,
`lib/paraProgressMutations.ts`).

- **Base URL:** `https://tms-dawateislami.vercel.app/api/v1`
- **Format:** JSON in, JSON out. Dates are `YYYY-MM-DD`.
- **CORS:** none — the API is meant for server-to-server calls, not browsers.

---

## Authentication

Every request needs an API key:

```
Authorization: Bearer $TMS_API_KEY
```

- Keys look like `tms_` + 43 base64url characters.
- Only the **SHA-256 hash** of a key is stored (`public.api_keys`). The plaintext is shown once,
  in the terminal, when the key is created, and is never saved anywhere.
- **Scopes:**

  | Scope | Allows |
  |-------|--------|
  | `items:read` | English `GET`s (`/items`, `/items/{id}`, `/meta`) |
  | `items:write` | `PATCH /items/{id}/pipeline` |
  | `quran:read` | Every `GET /quran/*` |
  | `quran:write` | `PATCH /quran/languages/{id}`, `POST /quran/meetings`, `PATCH /quran/meetings/{id}` |
- **Rate limit:** about 100 requests per minute per key. Over the limit → `429` with a
  `Retry-After` header (seconds). The counter is in memory per server instance, so treat it
  as a soft limit.
- Every API write is recorded in `public.api_audit_log` (key, request, note). `item_id` holds the
  English item id, or the language id for Quranic writes.

### Creating / revoking keys

Needs `.env.local` with `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, and
migration `database/migrations/010_api_keys.sql` applied.

```bash
# create — prints the key ONCE
node scripts/create-api-key.mjs --name zaki-assistant --scopes "items:read items:write quran:read quran:write"

# add scopes to an existing key (the key itself doesn't change)
node scripts/create-api-key.mjs --grant zaki-assistant --scopes "quran:read quran:write"

# revoke every active key with that name
node scripts/create-api-key.mjs --revoke zaki-assistant

# all options
node scripts/create-api-key.mjs --help
```

Or in SQL: `UPDATE public.api_keys SET revoked_at = now() WHERE name = '<name>';`

---

## Errors

Every error has the same shape and a matching HTTP status:

```json
{ "error": "Invalid query parameters.", "details": ["limit must be an integer 1-200."] }
```

| Status | When |
|--------|------|
| 400 | Bad query params / body / id |
| 401 | Missing, malformed, unknown or revoked key |
| 403 | Key lacks the scope for this endpoint |
| 404 | Item / language / meeting not found |
| 409 | Request conflicts with the pipeline state (e.g. wrong `advance_to`, item stopped) |
| 429 | Rate limit exceeded |
| 500 | Server / database error |

---

# English Translation API

## Pipeline basics

Stage codes come from `lib/et.ts`. Pipelines **depend on the item type**:

| Type(s) | Pipeline |
|---------|----------|
| standard (fsp, wbl, dwk, aer, rpr, …) | TR → IF → CM → ED → NR → ST → FF → FPR |
| `wsb` (Weekly Speech Brothers) | standard 8 → **PIS → FFM** |
| `mgz` (Magazine) | TR … FF → **DSN** (Designing) → FPR |
| `bks` (Books) | standard 8 → **RTP** (Ready to Print) |

`GET /api/v1/meta` returns the exact list per type.

- A stage is **in progress** when it has a `sent_date` and no `received_date`.
- **Currently at** = the highest in-progress stage. With nothing in progress, the item is
  *Pending Assignment*, *Awaiting final email* (all stages done) or *Completed* (final email sent).
- Stages marked N/A or Merged in the UI are skipped (`state: "not_applicable" | "merged"`)
  and don't count toward `progress`.

---

## `GET /api/v1/items`

Lists work items (Quran-e-Pak items are excluded, as in the UI). Scope: `items:read`.

| Param | Values | Notes |
|-------|--------|-------|
| `category` | `weekly-docs` \| `magazine` \| `books` \| `other` | weekly-docs = wsb, wbl, fsp |
| `status` | `active` \| `completed` \| `stopped` | active = not completed and not stopped |
| `type` | `wsb` `wbl` `fsp` `bks` `dwk` `mgz` `aer` `rpr` | |
| `holder` | name | exact match (case-insensitive) on the **current** holder |
| `stage` | stage code, e.g. `ST` | the **current** stage |
| `sort` | `at-step-since` \| `delivery-date` | both oldest first; missing dates last. Default: creation order |
| `page` | ≥ 1 | default 1 |
| `limit` | 1–200 | default 50 |

```bash
curl -s "https://tms-dawateislami.vercel.app/api/v1/items?category=weekly-docs&status=active&sort=at-step-since&limit=2" \
  -H "Authorization: Bearer $TMS_API_KEY"
```

```json
{
  "total": 14,
  "page": 1,
  "limit": 2,
  "items": [
    {
      "id": "0b6c…",
      "title": "Weekly Speech 03-10-2026",
      "type": "wsb",
      "type_label": "Weekly Speech Brothers",
      "category": "weekly-docs",
      "status": "in_progress",
      "stopped": false,
      "current_step": { "code": "ST", "name": "S.Tafteesh" },
      "current_label": "S.Tafteesh",
      "active_stages": ["ST"],
      "holder": "Mehmood Madani",
      "at_step_since": "2026-10-03",
      "days_at_step": 3,
      "progress": { "done": 5, "total": 10 },
      "delivery_date": "2026-10-30",
      "priority": "normal",
      "word_count": 6816,
      "net_word_count": 4660,
      "in_return": null
    }
  ]
}
```

- `status` is `pending_assignment` | `in_progress` | `completed`, worked out live from the stages.
- `current_step` is `null` when nothing is in progress; `current_label` then says why
  (`Pending Assignment`, `Awaiting final email`, `Completed`).
- `net_word_count`: for `wsb`, the fixed pre-translated sections are subtracted (same as the UI's counts).
- `in_return`: `{stage, holder, since}` when the item has been sent back to fix a missing part.

---

## `GET /api/v1/items/{id}`

Full detail for one item. Scope: `items:read`.

```bash
curl -s "https://tms-dawateislami.vercel.app/api/v1/items/$ITEM_ID" \
  -H "Authorization: Bearer $TMS_API_KEY"
```

```json
{
  "id": "0b6c…",
  "title": "…",
  "type": "fsp",
  "type_label": "Friday Speech",
  "category": "weekly-docs",
  "category_label": "Weekly Docs",
  "board": "main_2026",
  "status": "in_progress",
  "stopped": false,
  "priority": "normal",
  "word_count": 1200,
  "net_word_count": 1200,
  "received_date": "2026-09-28",
  "delivery_date": "2026-10-30",
  "final_email_date": null,
  "sender": { "name": null, "email": null },
  "further_process": null,
  "current_step": { "code": "ST", "name": "S.Tafteesh" },
  "currently_at": "Currently at S.Tafteesh with Mehmood Madani since 2026-10-03 (3 days here)",
  "holder": "Mehmood Madani",
  "at_step_since": "2026-10-03",
  "days_at_step": 3,
  "progress": { "done": 5, "total": 8 },
  "next_action": { "action": "move", "from": "ST", "advance_to": "FF" },
  "pipeline": [
    { "code": "TR", "name": "Translation", "seq": 1, "state": "done", "holder": "…", "sent_date": "2026-09-28", "received_date": "2026-09-30" },
    { "code": "ST", "name": "S.Tafteesh", "seq": 6, "state": "in_progress", "holder": "Mehmood Madani", "sent_date": "2026-10-03", "received_date": null },
    { "code": "FF", "name": "Final Formatting", "seq": 7, "state": "pending", "holder": null, "sent_date": null, "received_date": null }
  ],
  "tracking": [
    { "kind": "stage", "stage": "TR", "stage_name": "Translation", "holder": "…", "from": "2026-09-28", "to": "2026-09-30" },
    { "kind": "return", "stage": "ED", "stage_name": "Editing", "holder": "…", "from": "2026-10-01", "to": "2026-10-02", "note": "missing para 3" }
  ],
  "created_at": "…",
  "updated_at": "…"
}
```

- `pipeline[].state`: `pending` | `in_progress` | `done` | `not_applicable` | `merged`.
- `tracking`: who held the item, and when. It is built from each stage's holder and dates, plus
  any "returned to fix" entries, sorted by start date. (TMS has no separate history table, so if
  a stage's holder is changed later, only the latest holder for that stage is known.)
- `next_action`: what the item page's button would do next. `null` when the item is completed
  or only awaiting its final email.
  - `start`: the stage is waiting to be given out (`advance_to` = that stage).
  - `move`: the current stage goes back and the next one is sent out.
  - `finish`: the last stage comes back (`advance_to` = `"DONE"`).
- `pages` isn't returned: TMS doesn't store a page count for English items.

---

## `PATCH /api/v1/items/{id}/pipeline`

Updates the pipeline. Scope: `items:write`. Send **one** of the two forms below. `note`
(optional, ≤ 1000 chars) goes to the audit log and is echoed back.

### 1) `advance_to`: same as the "Move →" / "Start" button

```bash
curl -s -X PATCH "https://tms-dawateislami.vercel.app/api/v1/items/$ITEM_ID/pipeline" \
  -H "Authorization: Bearer $TMS_API_KEY" -H "Content-Type: application/json" \
  -d '{ "advance_to": "FPR", "holder": "Rafique Attari", "note": "ST complete, moved to FPR" }'
```

| Field | Required | Meaning |
|-------|----------|---------|
| `advance_to` | yes | Must equal `next_action.advance_to` from the detail endpoint, otherwise `409` (the response includes the correct `next_action`). |
| `holder` | no | Who gets the next stage. Must be a workforce name (`/meta` → `holders`, case-insensitive). If omitted, the stage keeps any holder already set on it. |
| `date` | no | Date to stamp; defaults to today (Pakistan time). |

What happens, exactly as in the UI:

- **move:** the current stage gets `received_date = date`; the next stage gets `sent_date = date` (and `holder`).
- **start:** the waiting stage gets `sent_date = date` (and `holder`).
- **finish** (`"DONE"`): the last stage gets `received_date = date`.

The item's status is then recalculated from all of its stages.

### 2) `stages`: explicit edits (like the pipeline editor)

```bash
curl -s -X PATCH "https://tms-dawateislami.vercel.app/api/v1/items/$ITEM_ID/pipeline" \
  -H "Authorization: Bearer $TMS_API_KEY" -H "Content-Type: application/json" \
  -d '{ "stages": [
        { "code": "ST",  "received_date": "2026-10-06" },
        { "code": "FPR", "holder": "Rafique Attari", "sent_date": "2026-10-06" }
      ], "note": "…" }'
```

- Each entry needs a `code` that exists on this item, plus at least one of `holder`,
  `sent_date` or `received_date`. Only the fields you send are changed; `null` clears a field.
- Up to 20 entries. If any entry is invalid, nothing is written and a `400` lists every problem.

### Response (both forms)

```json
{
  "ok": true,
  "applied": [
    { "stage": "ST", "received_back_date": "2026-10-06" },
    { "stage": "FPR", "person": "Rafique Attari", "sent_date": "2026-10-06" }
  ],
  "note": "ST complete, moved to FPR",
  "currently_at": "Currently at Final Proofreading with Rafique Attari since 2026-10-06 (0 days here)",
  "item": { "...": "same shape as GET /items/{id}" }
}
```

Stopped items return `409`. Resume them in TMS first.

---

## `GET /api/v1/meta`

Stage codes, the pipeline for each type, categories, and the holder (workforce) list. Scope: `items:read`.

```bash
curl -s "https://tms-dawateislami.vercel.app/api/v1/meta" -H "Authorization: Bearer $TMS_API_KEY"
```

```json
{
  "stages": [{ "code": "TR", "name": "Translation" }, "…"],
  "types": [{ "code": "wsb", "label": "Weekly Speech Brothers", "category": "weekly-docs",
              "pipeline": ["TR","IF","CM","ED","NR","ST","FF","FPR","PIS","FFM"] }, "…"],
  "categories": [{ "slug": "weekly-docs", "label": "Weekly Docs" }, "…"],
  "holders": [{ "name": "Mehmood Madani", "active": true }, "…"]
}
```

---

# Quranic Translation API

Base: `https://tms-dawateislami.vercel.app/api/v1/quran`. Scopes: `quran:read` for every `GET`,
`quran:write` for writes.

## Basics

- A **language** (e.g. Chinese, Pashto) belongs to a project and moves through a stage pipeline.
  Each stage is tracked **per para (1–30)**. A para is *done* once it has a `finished_at` date.
- **Pipelines** (`GET /quran/meta` → `pipelines`):

  | Kind | Stages, in order |
  |------|------------------|
  | standard | translation → comparison → formation → tafteesh → designing → final_proof_reading |
  | Braille | translation ("Translation (for Braille)") → comparison → convert_into_braille → tafteesh → final_proof_reading |

  A language uses the Braille pipeline when its **name contains "braille"** (case-insensitive),
  the same check the UI uses.
- **Ordering rule** (from `lib/progress.ts`), counted in paras finished: comparison can't be ahead
  of translation, and no other stage can be ahead of either of them. The API enforces this on
  every para write. It only checks the stages a request touches, so an old inconsistency
  elsewhere won't block an unrelated edit.
- `pipeline_percent` = the sum of paras finished across the language's stages ÷ (stages × 30),
  the same number the progress board shows.
- **Weekly meetings** (`lib/schedule.ts`): a meeting is expected every 7 days on the language's
  `assigned_day`.
  - `schedule_state`: `done` (met in the last 7 days), `today`, `due`, `overdue` (14+ days, or
    never met) or `none` (no assigned day).
  - `needs_attention`: an in-progress language with no meeting in the last 14 days (or never).
    This is the same count as the dashboard's "Needs Attention".
  - `next_expected_meeting`: today if today is the assigned day, otherwise the next date that
    falls on that weekday.
  - `next_scheduled_meeting`: the soonest `next_meeting_date` (today or later) written on any
    of the language's meetings.

## `GET /quran/meta`

```bash
curl -s "https://tms-dawateislami.vercel.app/api/v1/quran/meta" -H "Authorization: Bearer $TMS_API_KEY"
```

```json
{
  "total_paras": 30,
  "stages": [{ "stage": "translation", "label": "Translation" }, "…"],
  "pipelines": {
    "standard": [{ "stage": "translation", "label": "Translation" }, "…"],
    "braille":  [{ "stage": "translation", "label": "Translation (for Braille)" }, "…"]
  },
  "braille_rule": "…", "ordering_rule": "…",
  "work_statuses": ["not_started", "in_progress", "completed"],
  "priorities": ["low", "medium", "high"],
  "weekdays": ["Monday", "…", "Sunday"],
  "workforce": [{ "id": "uuid", "name": "…", "active": true }],
  "projects": [{ "id": "uuid", "name": "…" }]
}
```

## `GET /quran/languages`

| Param | Values | Notes |
|-------|--------|-------|
| `status` | `not_started` \| `in_progress` \| `completed` | `work_status` |
| `country` | text | exact, case-insensitive |
| `responsible` | person name | exact, case-insensitive, on `responsible_person` |
| `priority` | `low` \| `medium` \| `high` | |
| `project` | project name or id | name match is case-insensitive |
| `needs_attention` | `true` \| `false` | see [Basics](#basics) |
| `sort` | `progress` (highest first) \| `last-meeting` (longest ago first, never-met first) \| `country` \| `language` | default: language A–Z |
| `page`, `limit` | ≥ 1; 1–200 | default 1, 50 |

```bash
curl -s "https://tms-dawateislami.vercel.app/api/v1/quran/languages?status=in_progress&needs_attention=true&sort=last-meeting" \
  -H "Authorization: Bearer $TMS_API_KEY"
```

```json
{
  "total": 23, "page": 1, "limit": 50,
  "languages": [{
    "id": "uuid",
    "language": "Chinese",
    "country": "China",
    "braille": false,
    "responsible_person": "…",
    "priority": "high",
    "work_status": "in_progress",
    "project": { "id": "uuid", "name": "…" },
    "pipeline_percent": 92,
    "paras_fully_finished": 25,
    "stages": [{ "stage": "translation", "label": "Translation", "paras_finished": 30, "percent": 100 }, "…"],
    "assigned_day": "Friday",
    "last_meeting_at": "2026-07-23",
    "days_since_last_meeting": 75,
    "schedule_state": "overdue",
    "schedule_label": "75 days overdue",
    "next_expected_meeting": "2026-10-09",
    "needs_attention": true
  }]
}
```

`paras_fully_finished` is the paras finished in the **last** stage of the pipeline, i.e. the
paras that have cleared every stage.

## `GET /quran/languages/{id}`

Same fields as a list row, plus:

- `pipeline`: the ordered stage keys for this language.
- `stages[]`: adds `paras_in_progress` (started, not finished), `last_activity` (latest start
  or finish date) and `paras`, a full 1–30 grid:
  `{ para, status: "not_started"|"in_progress"|"done", person_id, person, started_at, finished_at }`.
- `next_scheduled_meeting`
- `meetings`: every meeting for the language, newest first, in the
  [meeting shape](#get-quranmeetings).

## `PATCH /quran/languages/{id}`

Scope `quran:write`. Send any combination of meta fields and `para_progress`. Only the fields
you send change. Unknown fields → `400`. If **anything** is invalid, nothing is written, and the
`400` response lists every problem.

**Meta fields** (written through `updateLanguage()`, the same function as the language edit form):

| Field | Values |
|-------|--------|
| `responsible_person` | text (≤ 200) or `null` |
| `priority` | `low` \| `medium` \| `high` \| `null` |
| `work_status` | `not_started` \| `in_progress` \| `completed` |
| `country` | non-empty text |
| `assigned_day` | weekday (case-insensitive, e.g. `"monday"`) or `null` |

**`para_progress`**: up to 20 entries, applied in order. Each entry is one of two forms:

1. **Count** (`{stage, paras_finished, date?, allow_decrease?}`). This is exactly what the
   progress page's "Para reached" + Save does:
   - Paras 1…N count as finished. Paras that were already finished keep their dates and person.
     Newly finished paras get `date` (default: today, Pakistan time).
   - Paras above N are **cleared**. So lowering the number wipes those paras' data, and the
     API refuses to lower it unless you also send `"allow_decrease": true`.
2. **Single para** (`{stage, para, person_id?, started_at?, finished_at?}`):
   - Edits one para. Only the fields you send change; `null` clears a field.
   - `person_id` must be a workforce member (`/quran/meta` → `workforce`).
   - `started_at` can't be after `finished_at`.

Both forms are saved through `saveParaStage()`, the same function the progress editor uses.
The stage must belong to the language's pipeline (e.g. `convert_into_braille` only exists for
Braille). The [ordering rule](#basics) is checked against the result.

```bash
curl -s -X PATCH "https://tms-dawateislami.vercel.app/api/v1/quran/languages/$LANGUAGE_ID" \
  -H "Authorization: Bearer $TMS_API_KEY" -H "Content-Type: application/json" \
  -d '{
        "responsible_person": "…",
        "assigned_day": "Monday",
        "para_progress": [
          { "stage": "translation", "paras_finished": 12 },
          { "stage": "comparison", "para": 9, "person_id": "uuid", "started_at": "2026-10-06" }
        ],
        "note": "Weekly update from the language team"
      }'
```

```json
{
  "ok": true,
  "applied": {
    "meta": { "responsible_person": "…", "assigned_day": "Monday" },
    "para_counts": { "translation": { "before": 10, "after": 12 }, "comparison": { "before": 8, "after": 8 } }
  },
  "note": "Weekly update from the language team",
  "language": { "...": "same shape as GET /quran/languages/{id}, read fresh" }
}
```

An ordering violation looks like this:

```json
{ "error": "Invalid request.", "details": ["formation (8 paras) can't be ahead of Translation (10) or Comparison (5)."] }
```

## `GET /quran/meetings`

| Param | Values |
|-------|--------|
| `language_id` | UUID |
| `from`, `to` | `YYYY-MM-DD` (inclusive, on `meeting_date`) |
| `page`, `limit` | default 1, 50 (max 200) |

Newest first. Each meeting:

```json
{
  "id": "uuid", "language_id": "uuid", "language": "Chinese", "country": "China",
  "meeting_date": "2026-10-05", "meeting_type": null,
  "participants": "…", "discussion_points": "…", "translation_progress": null,
  "progress_percentage": 40, "action_items": "…", "next_action": null,
  "next_meeting_date": "2026-10-12", "meeting_notes": null,
  "created_at": "…", "updated_at": "…"
}
```

`GET /quran/meetings/{id}` returns a single meeting in the same shape.

## `POST /quran/meetings`

Scope `quran:write`. Records a meeting through `createMeeting()`, the same function as the
"Add meeting" form.

| Field | Required | Values |
|-------|----------|--------|
| `language_id` | yes | UUID of an existing language |
| `meeting_date` | no | `YYYY-MM-DD`; default today (Pakistan time) |
| `meeting_type`, `participants`, `discussion_points`, `translation_progress`, `action_items`, `meeting_notes` | no | text (≤ 5000) or `null` |
| `progress_percentage` | no | integer 0–100 or `null` |
| `next_meeting_date` | no | `YYYY-MM-DD` or `null` |
| `note` | no | audit note (≤ 1000) |

After saving, `languages.last_meeting_at` is set to the language's **latest** meeting date, so
adding an older meeting doesn't move it backwards. Returns `201`:

```bash
curl -s -X POST "https://tms-dawateislami.vercel.app/api/v1/quran/meetings" \
  -H "Authorization: Bearer $TMS_API_KEY" -H "Content-Type: application/json" \
  -d "{ \"language_id\": \"$LANGUAGE_ID\", \"meeting_date\": \"2026-10-06\",
        \"participants\": \"…\", \"discussion_points\": \"…\", \"action_items\": \"…\",
        \"progress_percentage\": 40, \"next_meeting_date\": \"2026-10-13\" }"
```

```json
{
  "ok": true, "note": null,
  "meeting": { "...": "meeting shape" },
  "language": { "id": "uuid", "language": "…", "assigned_day": "Monday", "last_meeting_at": "2026-10-06",
                "days_since_last_meeting": 0, "schedule_state": "done", "schedule_label": "Met this week",
                "next_expected_meeting": "2026-10-12", "needs_attention": false }
}
```

## `PATCH /quran/meetings/{id}`

Scope `quran:write`. Takes the same fields as `POST`, minus `language_id`, which can't be
changed. Only the fields you send change; `null` clears a field. `meeting_date` can't be
cleared. The response has the same shape as `POST` (with `200`).

## `GET /quran/schedule`

The weekly meeting schedule: the same data as the `/schedule` page, i.e. every
**in-progress** language. Sorted most overdue first: never-met languages, then by days since
the last meeting.

```json
{
  "total": 23,
  "schedule": [{
    "id": "uuid", "language": "Pashto", "country": "…", "responsible_person": "…",
    "project": { "id": "uuid", "name": "…" },
    "assigned_day": "Tuesday", "last_meeting_at": "2026-06-15", "days_since_last_meeting": 113,
    "schedule_state": "overdue", "schedule_label": "113 days overdue",
    "next_expected_meeting": "2026-10-07", "needs_attention": true,
    "next_scheduled_meeting": null
  }]
}
```

---

## Freshness

`GET`s use the same reads as the web UI:

- English items and Quranic para progress come from the shared data cache. It refreshes at
  least every 60 seconds, and immediately after any change, whether made in the UI or through
  the API.
- Quranic languages, meetings and the schedule are read live.

Writes always read fresh from the database before applying any rules.
