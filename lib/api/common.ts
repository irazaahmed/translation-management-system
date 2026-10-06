import "server-only";

/** Shared helpers for every /api/v1 route (English and Quranic). */

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Today's date (YYYY-MM-DD) in Pakistan time — what staff mean by "today". */
export function todayPk(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(new Date());
}

/** A real calendar date in YYYY-MM-DD form. */
export function isIsoDate(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/** Parse ?page=&limit= (limit 1-200, default 50). Pushes problems into `problems`. */
export function parsePaging(q: URLSearchParams, problems: string[]): { page: number; limit: number } {
  const page = q.has("page") ? Number(q.get("page")) : 1;
  const limit = q.has("limit") ? Number(q.get("limit")) : 50;
  if (!Number.isInteger(page) || page < 1) problems.push("page must be an integer >= 1.");
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) problems.push("limit must be an integer 1-200.");
  return { page, limit };
}

/** Read a JSON object body, or null if it isn't one. */
export async function readJsonObject(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Validate the optional audit `note` (string, max 1000). Returns an error message or null. */
export function noteError(note: unknown): string | null {
  if (note === undefined || note === null) return null;
  return typeof note === "string" && note.length <= 1000 ? null : '"note" must be a string (max 1000 chars).';
}
