import { NextResponse } from "next/server";
import { apiError, requireApiKey } from "@/lib/api/auth";
import { parsePaging } from "@/lib/api/common";
import { PRIORITIES, WORK_STATUSES, languageListRow } from "@/lib/api/quran";
import { getCachedLanguages, getCachedProjects } from "@/lib/cachedData";
import { getCachedAllParaProgress, toParaRow } from "@/lib/paraProgressData";
import type { ParaRow } from "@/lib/progress";

export const dynamic = "force-dynamic";

const SORTS = ["progress", "last-meeting", "country", "language"];

type Row = ReturnType<typeof languageListRow>;

/** GET /api/v1/quran/languages — filtered, sorted, paginated language list. */
export async function GET(request: Request) {
  const auth = await requireApiKey(request, "quran:read");
  if (auth.response) return auth.response;

  const q = new URL(request.url).searchParams;
  const problems: string[] = [];
  const status = q.get("status");
  if (status && !WORK_STATUSES.includes(status as (typeof WORK_STATUSES)[number])) {
    problems.push(`status must be one of: ${WORK_STATUSES.join(", ")}.`);
  }
  const priority = q.get("priority");
  if (priority && !PRIORITIES.includes(priority as (typeof PRIORITIES)[number])) {
    problems.push(`priority must be one of: ${PRIORITIES.join(", ")}.`);
  }
  const needsAttention = q.get("needs_attention");
  if (needsAttention && needsAttention !== "true" && needsAttention !== "false") {
    problems.push("needs_attention must be true or false.");
  }
  const sort = q.get("sort");
  if (sort && !SORTS.includes(sort)) problems.push(`sort must be one of: ${SORTS.join(", ")}.`);
  const { page, limit } = parsePaging(q, problems);
  if (problems.length) return apiError(400, "Invalid query parameters.", problems);

  const lower = (k: string) => q.get(k)?.trim().toLowerCase() || null;
  const country = lower("country");
  const responsible = lower("responsible");
  const project = lower("project");

  try {
    const [languages, projects, paraRows] = await Promise.all([
      getCachedLanguages(),
      getCachedProjects(),
      getCachedAllParaProgress(),
    ]);
    const projectName = new Map(projects.map((p) => [p.id, p.name]));
    const rowsByLanguage = new Map<string, ParaRow[]>();
    for (const r of paraRows) {
      const arr = rowsByLanguage.get(r.languageId);
      if (arr) arr.push(toParaRow(r));
      else rowsByLanguage.set(r.languageId, [toParaRow(r)]);
    }

    const now = new Date();
    let rows: Row[] = languages
      .filter((l) => {
        if (status && l.work_status !== status) return false;
        if (priority && l.priority !== priority) return false;
        if (country && l.country.toLowerCase() !== country) return false;
        if (responsible && (l.responsible_person || "").toLowerCase() !== responsible) return false;
        if (project) {
          const name = (l.project_id && projectName.get(l.project_id)) || "";
          if (l.project_id !== project && name.toLowerCase() !== project) return false;
        }
        return true;
      })
      .map((l) =>
        languageListRow(l, l.project_id ? projectName.get(l.project_id) ?? null : null, rowsByLanguage.get(l.id) ?? [], now)
      );
    if (needsAttention) rows = rows.filter((r) => r.needs_attention === (needsAttention === "true"));

    if (sort === "progress") rows.sort((a, b) => b.pipeline_percent - a.pipeline_percent);
    if (sort === "country") rows.sort((a, b) => a.country.localeCompare(b.country) || a.language.localeCompare(b.language));
    if (sort === "language") rows.sort((a, b) => a.language.localeCompare(b.language));
    // Longest without a meeting first; never-met languages lead.
    if (sort === "last-meeting") {
      rows.sort((a, b) => (a.last_meeting_at ?? "0000").localeCompare(b.last_meeting_at ?? "0000"));
    }

    const total = rows.length;
    return NextResponse.json({ total, page, limit, languages: rows.slice((page - 1) * limit, page * limit) });
  } catch (err) {
    console.error("GET /api/v1/quran/languages failed:", err);
    return apiError(500, "Failed to load languages.");
  }
}
