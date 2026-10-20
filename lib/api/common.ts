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

// ---- Forgiving field names -------------------------------------------------

function editDistance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return dp[a.length][b.length];
}

/**
 * "Unknown field(s): link (did you mean delivery_link?)". Suggests the closest
 * allowed field so an API client can correct itself instead of guessing.
 */
export function unknownFieldsMessage(unknown: string[], allowed: Iterable<string>): string {
  const names = [...allowed];
  const parts = unknown.map((u) => {
    const lu = u.toLowerCase();
    const best = names
      .map((n) => ({ n, d: n.includes(lu) || lu.includes(n) ? 0 : editDistance(lu, n) }))
      .sort((a, b) => a.d - b.d)[0];
    return best && best.d <= Math.max(2, Math.floor(u.length / 3)) ? `${u} (did you mean ${best.n}?)` : u;
  });
  return `Unknown field(s): ${parts.join(", ")}. Allowed: ${names.join(", ")}.`;
}

/**
 * Rename alias keys to their canonical names in a request body (when the
 * canonical key isn't already present), e.g. { link } -> { delivery_link }.
 * Returns a new object; the original is not modified.
 */
export function applyAliases(body: Record<string, unknown>, aliases: Record<string, string>): Record<string, unknown> {
  const out = { ...body };
  for (const [alias, canonical] of Object.entries(aliases)) {
    if (alias in out && !(canonical in out)) {
      out[canonical] = out[alias];
      delete out[alias];
    }
  }
  return out;
}

/**
 * Accept a web link as people paste it: trimmed, and with "https://" added
 * when a bare domain was given ("dawateislami.sharepoint.com/sites/…").
 */
export function normalizeWebLink(v: string): string {
  const t = v.trim();
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(t)) return t;
  if (/^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+([/:?#].*)?$/i.test(t)) return `https://${t}`;
  return t;
}
