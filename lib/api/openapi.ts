import "server-only";
import { STAGE_BY_CODE, TYPE_LABELS } from "@/lib/et";
import { ALL_STAGE_KEYS } from "@/lib/progress";
import { WEEKDAYS } from "@/lib/schedule";

/**
 * OpenAPI 3.1 description of /api/v1, served at GET /api/v1/openapi.json so
 * API clients (e.g. the "Zaki" assistant on Muse) can build their tools from
 * exact field names instead of guessing. Enums come from the same code the
 * API validates against, so the spec can't drift from it.
 */

type Schema = Record<string, unknown>;

const str = (description?: string, extra: Schema = {}): Schema => ({ type: "string", ...(description ? { description } : {}), ...extra });
const nstr = (description?: string, extra: Schema = {}): Schema => ({ type: ["string", "null"], ...(description ? { description } : {}), ...extra });
const date = (description = "YYYY-MM-DD"): Schema => ({ type: ["string", "null"], format: "date", description });
const bool = (description?: string): Schema => ({ type: "boolean", ...(description ? { description } : {}) });
const int = (description?: string, extra: Schema = {}): Schema => ({ type: ["integer", "null"], ...(description ? { description } : {}), ...extra });
const en = (values: readonly string[], description?: string, nullable = false): Schema => ({
  type: nullable ? ["string", "null"] : "string",
  enum: nullable ? [...values, null] : [...values],
  ...(description ? { description } : {}),
});
const obj = (properties: Record<string, Schema>, required: string[] = [], description?: string): Schema => ({
  type: "object",
  properties,
  ...(required.length ? { required } : {}),
  additionalProperties: false,
  ...(description ? { description } : {}),
});
const AUDIT = str("Optional audit note (max 1000), stored in api_audit_log.", { maxLength: 1000 });

const STAGE_CODES = Object.keys(STAGE_BY_CODE);
const TYPES = Object.keys(TYPE_LABELS);
const ITEM_PRIORITIES = ["low", "normal", "urgent"];
const Q_STATUS = ["not_started", "in_progress", "completed"];
const Q_PRIORITIES = ["low", "medium", "high"];

const param = (name: string, schema: Schema, description?: string, required = false) => ({
  name,
  in: "query",
  required,
  schema,
  ...(description ? { description } : {}),
});
const pathId = (name = "id", description = "UUID") => ({ name, in: "path", required: true, schema: { type: "string", format: "uuid" }, description });
const PAGING = [param("page", { type: "integer", minimum: 1 }, "default 1"), param("limit", { type: "integer", minimum: 1, maximum: 200 }, "default 50")];
const DELETE_NOTE = param("note", { type: "string" }, "Optional audit note");

const json = (schema: Schema) => ({ required: true, content: { "application/json": { schema } } });
const ok = (description = "OK") => ({ description, content: { "application/json": { schema: { type: "object" } } } });
const ERR = { $ref: "#/components/responses/Error" };
const errs = { "400": ERR, "401": ERR, "403": ERR, "404": ERR, "409": ERR, "429": ERR, "500": ERR };

function op(
  operationId: string,
  summary: string,
  scope: string,
  opts: { parameters?: unknown[]; requestBody?: unknown; description?: string; created?: boolean } = {}
) {
  return {
    operationId,
    summary,
    ...(opts.description ? { description: opts.description } : {}),
    "x-required-scope": scope,
    ...(opts.parameters ? { parameters: opts.parameters } : {}),
    ...(opts.requestBody ? { requestBody: opts.requestBody } : {}),
    responses: { [opts.created ? "201" : "200"]: ok(), ...errs },
  };
}

// ---- Shared bodies --------------------------------------------------------

const ITEM_FIELDS: Record<string, Schema> = {
  title: str("Item title (max 300). A title ending in (dd-mm-yy) sets the delivery date.", { maxLength: 300 }),
  type: en(TYPES, "Content type code (see GET /meta → types)", true),
  received_date: date(),
  delivery_date: date("YYYY-MM-DD. If null/omitted it is read from a (dd-mm-yy) title."),
  word_count: int("Raw word count", { minimum: 0 }),
  priority: en(ITEM_PRIORITIES, undefined, true),
  further_process: nstr("Notes / further process (max 5000)"),
  sender_name: nstr(),
  sender_email: nstr(undefined, { format: "email" }),
};

const CLOSEOUT_FIELDS: Record<string, Schema> = {
  delivery_link: nstr(
    "Link / Remarks step: online or SharePoint link of the delivered work (https://…; a bare domain gets https:// added). Aliases accepted: link, final_link, url, closeout.link.",
    { maxLength: 2000 }
  ),
  delivery_remarks: nstr("Link / Remarks step: a remark instead of (or as well as) a link (max 5000). Aliases: remarks, remark, closeout.remarks."),
};

const STAGE_EDIT = obj(
  {
    code: en(STAGE_CODES, "Stage code that exists on this item"),
    holder: nstr("Workforce name (GET /people or /meta → holders); null clears"),
    sent_date: date("Date the stage was given out; null clears"),
    received_date: date("Date it came back; null clears"),
    not_applicable: bool("N/A: skip this stage"),
    merged: bool("Merged: skip because parts were merged into another file"),
    with_tr: bool("ED only: true = AI mode (Editing done inside Translation)"),
  },
  ["code"]
);

const RETURN_FIELDS: Record<string, Schema> = {
  stage: en(STAGE_CODES, "Stage it was sent back to (one of the item's stages)", true),
  note: nstr("What is missing (max 2000). Required on create unless holder is given."),
  holder: nstr("Workforce name it went to"),
  sent_date: date("When it was handed back"),
  received_date: date("When it came back completed; set this to complete the return, null reopens it"),
  api_note: AUDIT,
};

const PERSON_FIELDS: Record<string, Schema> = {
  name: str("Unique name (max 120)"),
  skills: nstr(),
  email: nstr(undefined, { format: "email" }),
  working_hours: nstr(),
  active: bool(),
  note: AUDIT,
};

const LANGUAGE_META: Record<string, Schema> = {
  responsible_person: nstr("max 200"),
  priority: en(Q_PRIORITIES, undefined, true),
  work_status: en(Q_STATUS),
  country: str(),
  assigned_day: en(WEEKDAYS, "Weekly meeting weekday (case-insensitive)", true),
};

const PARA_ENTRY: Schema = {
  oneOf: [
    obj(
      {
        stage: en(ALL_STAGE_KEYS, "Must be in the language's pipeline"),
        paras_finished: { type: "integer", minimum: 0, maximum: 30, description: "\"Para reached\" count" },
        date: date("Date for newly finished paras (default today)"),
        allow_decrease: bool("Required to lower a count (clears the paras above N)"),
      },
      ["stage", "paras_finished"],
      "Set the paras-reached count for a stage"
    ),
    obj(
      {
        stage: en(ALL_STAGE_KEYS),
        para: { type: "integer", minimum: 1, maximum: 30 },
        person_id: nstr("quran_people id (GET /quran/people)", { format: "uuid" }),
        started_at: date(),
        finished_at: date(),
      },
      ["stage", "para"],
      "Edit a single para"
    ),
  ],
};

const MEETING_FIELDS: Record<string, Schema> = {
  meeting_date: { type: "string", format: "date", description: "YYYY-MM-DD (default today on create)" },
  meeting_type: nstr(),
  participants: nstr(),
  discussion_points: nstr(),
  translation_progress: nstr(),
  progress_percentage: int(undefined, { minimum: 0, maximum: 100 }),
  action_items: nstr(),
  next_meeting_date: date(),
  meeting_notes: nstr(),
  note: AUDIT,
};

export function buildOpenApiSpec(origin: string) {
  const paths: Record<string, Record<string, unknown>> = {
    // ================= English =================
    "/meta": { get: op("getMeta", "Stage codes, per-type pipelines, categories, statuses, holders", "items:read") },
    "/items": {
      get: op("listItems", "List English work items", "items:read", {
        parameters: [
          param("category", en(["weekly-docs", "magazine", "books", "other"])),
          param("status", en(["active", "completed", "stopped", "link_missing"]), "link_missing = final email sent, link/remark not recorded yet"),
          param("type", en(TYPES)),
          param("holder", { type: "string" }, "Current holder (exact, case-insensitive)"),
          param("stage", en(STAGE_CODES), "Current stage"),
          param("sort", en(["at-step-since", "delivery-date"])),
          ...PAGING,
        ],
      }),
      post: op("createItem", "Create a work item (New item form)", "items:write", {
        created: true,
        requestBody: json(
          obj(
            {
              ...ITEM_FIELDS,
              final_email_date: date(),
              translation_mode: en(["ai", "manual"], "ai (default): Editing is combined into Translation"),
              allow_duplicate: bool("Create even if an item with this title exists (otherwise 409)"),
              note: AUDIT,
            },
            ["title"]
          )
        ),
      }),
    },
    "/items/{id}": {
      parameters: [pathId()],
      get: op("getItem", "Item detail: pipeline, returns, close-out, next_action", "items:read"),
      patch: op("updateItem", "Edit item, final email, Link / Remarks, stop / resume", "items:write", {
        description:
          "Only sent fields change; null clears. final_email_date (wsb: final_email_date_2 for the 2nd email) moves the item to link_missing; delivery_link or delivery_remarks then completes it.",
        requestBody: json(
          obj({
            ...ITEM_FIELDS,
            final_email_date: date("Final email sent; null clears"),
            final_email_date_2: date("wsb only: 2nd final email (Islamic Sisters)"),
            ...CLOSEOUT_FIELDS,
            stopped: bool("Stop (true) or resume (false) the project"),
            note: AUDIT,
          })
        ),
      }),
      delete: op("deleteItem", "Delete the item", "items:delete", { parameters: [DELETE_NOTE] }),
    },
    "/items/{id}/closeout": {
      parameters: [pathId()],
      patch: op("setItemCloseout", "Link / Remarks: record the delivered work's link and/or a remark", "items:write", {
        description:
          "After the final email, either a link or a remark completes the item; clearing both sends it back to link_missing.",
        requestBody: json(obj({ ...CLOSEOUT_FIELDS, note: AUDIT })),
      }),
    },
    "/items/{id}/pipeline": {
      parameters: [pathId()],
      patch: op("updatePipeline", "Move → / Start (advance_to) or edit stages", "items:write", {
        description: "Send exactly one of advance_to or stages. advance_to must equal GET /items/{id} → next_action.advance_to.",
        requestBody: json({
          oneOf: [
            obj(
              {
                advance_to: str("Next stage code, or DONE for the last stage"),
                holder: nstr("Workforce name for the stage being given out"),
                date: date("Default today"),
                note: AUDIT,
              },
              ["advance_to"]
            ),
            obj({ stages: { type: "array", items: STAGE_EDIT, minItems: 1, maxItems: 20 }, note: AUDIT }, ["stages"]),
          ],
        }),
      }),
    },
    "/items/{id}/returns": {
      parameters: [pathId()],
      get: op("listItemReturns", "Returns of an item", "items:read"),
      post: op("createReturn", "Log a return (sent back to complete a missing part)", "items:write", {
        created: true,
        requestBody: json(obj(RETURN_FIELDS)),
      }),
    },
    "/items/{id}/returns/{returnId}": {
      parameters: [pathId(), pathId("returnId")],
      patch: op("updateReturn", "Complete (received_date) or edit a return", "items:write", { requestBody: json(obj(RETURN_FIELDS)) }),
      delete: op("deleteReturn", "Delete a return", "items:delete", { parameters: [DELETE_NOTE] }),
    },
    "/returns": {
      get: op("listReturns", "All returns across items", "items:read", {
        parameters: [param("open", en(["true", "false"])), param("holder", { type: "string" }), param("item_id", { type: "string", format: "uuid" }), ...PAGING],
      }),
    },
    "/people": {
      get: op("listPeople", "English workforce (holder names)", "items:read", { parameters: [param("active", en(["true", "false"]))] }),
      post: op("createPerson", "Add a workforce member", "items:write", { created: true, requestBody: json(obj(PERSON_FIELDS, ["name"])) }),
    },
    "/people/{id}": {
      parameters: [pathId()],
      patch: op("updatePerson", "Edit a workforce member (rename cascades to stages and returns)", "items:write", {
        requestBody: json(obj(PERSON_FIELDS)),
      }),
      delete: op("deletePerson", "Remove a workforce member", "items:delete", { parameters: [DELETE_NOTE] }),
    },
    "/people/{id}/assignments/order": {
      parameters: [pathId()],
      put: op("reorderAssignments", "Reorder a person's planned-work queue", "items:write", {
        requestBody: json(obj({ ordered_ids: { type: "array", items: { type: "string", format: "uuid" } }, note: AUDIT }, ["ordered_ids"])),
      }),
    },
    "/assignments": {
      get: op("listAssignments", "Planned work (managing board)", "items:read", {
        parameters: [param("person_id", { type: "string", format: "uuid" }), param("item_id", { type: "string", format: "uuid" }), param("done", en(["true", "false"]))],
      }),
      post: op("createAssignment", "Line up an item for a person", "items:write", {
        created: true,
        requestBody: json(obj({ person_id: str(undefined, { format: "uuid" }), item_id: str(undefined, { format: "uuid" }), note: nstr(), api_note: AUDIT }, ["person_id", "item_id"])),
      }),
    },
    "/assignments/{id}": {
      parameters: [pathId()],
      patch: op("updateAssignment", "Edit note / mark done", "items:write", { requestBody: json(obj({ note: nstr(), done: bool(), api_note: AUDIT })) }),
      delete: op("deleteAssignment", "Remove planned work", "items:delete", { parameters: [DELETE_NOTE] }),
    },

    // ================= Quranic =================
    "/quran/meta": { get: op("getQuranMeta", "Stages, pipelines (standard / Braille), enums, workforce, projects", "quran:read") },
    "/quran/languages": {
      get: op("listLanguages", "List languages", "quran:read", {
        parameters: [
          param("status", en(Q_STATUS)),
          param("country", { type: "string" }),
          param("responsible", { type: "string" }),
          param("priority", en(Q_PRIORITIES)),
          param("project", { type: "string" }, "Project name or id"),
          param("needs_attention", en(["true", "false"])),
          param("sort", en(["progress", "last-meeting", "country", "language"])),
          ...PAGING,
        ],
      }),
      post: op("createLanguage", "Add a language", "quran:write", {
        created: true,
        requestBody: json(obj({ language: str(), country: str(), project: str("Project name or id"), ...LANGUAGE_META, note: AUDIT }, ["language", "country", "project"])),
      }),
    },
    "/quran/languages/{id}": {
      parameters: [pathId()],
      get: op("getLanguage", "Language detail: para progress, meetings, schedule", "quran:read"),
      patch: op("updateLanguage", "Edit language and/or para progress", "quran:write", {
        requestBody: json(
          obj({
            language: str("Rename (send alone, not with para_progress)"),
            ...LANGUAGE_META,
            para_progress: { type: "array", items: PARA_ENTRY, minItems: 1, maxItems: 20 },
            note: AUDIT,
          })
        ),
      }),
      delete: op("deleteLanguage", "Delete language (with its meetings and progress)", "quran:delete", { parameters: [DELETE_NOTE] }),
    },
    "/quran/meetings": {
      get: op("listMeetings", "Meetings, newest first", "quran:read", {
        parameters: [param("language_id", { type: "string", format: "uuid" }), param("from", { type: "string", format: "date" }), param("to", { type: "string", format: "date" }), ...PAGING],
      }),
      post: op("createMeeting", "Record a meeting", "quran:write", {
        created: true,
        requestBody: json(obj({ language_id: str(undefined, { format: "uuid" }), ...MEETING_FIELDS }, ["language_id"])),
      }),
    },
    "/quran/meetings/{id}": {
      parameters: [pathId()],
      get: op("getMeeting", "One meeting", "quran:read"),
      patch: op("updateMeeting", "Edit a meeting", "quran:write", { requestBody: json(obj(MEETING_FIELDS)) }),
      delete: op("deleteMeeting", "Delete a meeting", "quran:delete", { parameters: [DELETE_NOTE] }),
    },
    "/quran/schedule": { get: op("getSchedule", "Weekly meeting schedule, most overdue first", "quran:read") },
    "/quran/people": {
      get: op("listQuranPeople", "Quran workforce", "quran:read", { parameters: [param("active", en(["true", "false"]))] }),
      post: op("createQuranPerson", "Add a Quran workforce member", "quran:write", {
        created: true,
        requestBody: json(obj({ name: str(), active: bool(), notes: nstr(), note: AUDIT }, ["name"])),
      }),
    },
    "/quran/people/{id}": {
      parameters: [pathId()],
      patch: op("updateQuranPerson", "Edit a Quran workforce member", "quran:write", { requestBody: json(obj({ name: str(), active: bool(), notes: nstr(), note: AUDIT })) }),
      delete: op("deleteQuranPerson", "Remove a Quran workforce member", "quran:delete", { parameters: [DELETE_NOTE] }),
    },
  };

  return {
    openapi: "3.1.0",
    info: {
      title: "TMS API",
      version: "1",
      description:
        "Translation Management System API (English Translation + Quranic Translation). Every UI option except login and user management. Each operation lists its required key scope in x-required-scope. Full guide: https://raw.githubusercontent.com/irazaahmed/translation-management-system/main/API_DOCS.md",
    },
    servers: [{ url: `${origin}/api/v1` }],
    security: [{ bearerAuth: [] }],
    components: {
      securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", description: "API key (tms_…)" } },
      responses: {
        Error: {
          description: "Error: { error, details? }. details lists every problem, with 'did you mean' hints for unknown fields.",
          content: { "application/json": { schema: { type: "object", properties: { error: { type: "string" }, details: {} }, required: ["error"] } } },
        },
      },
    },
    paths,
  };
}
