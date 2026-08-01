"use client";

import { useMemo, useState } from "react";
import { TOTAL_PARAS } from "@/lib/progress";

export interface ParaActivityRow {
  language: string;
  country: string;
  projectName: string | null;
  stage: string;
  stageName: string;
  paraNumber: number;
  person: string;
  startedAt: string | null;
  finishedAt: string | null;
  status: "Done" | "In progress";
}

export interface LanguageMeta {
  language: string;
  country: string;
  projectName: string | null;
  stageKeys: { key: string; label: string }[];
}

interface Props {
  activity: ParaActivityRow[];
  languages: LanguageMeta[];
  people: string[];
  defaultFrom: string;
  defaultTo: string;
}

type ReportType = "activity" | "byLanguage" | "byPerson";

function fmt(d: string | null): string {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "";
  return dt.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function inRange(d: string | null, from: string, to: string): boolean {
  if (!d) return false;
  const day = d.slice(0, 10);
  return day >= from && day <= to;
}

function cmpDate(a: string | null, b: string | null, dir: "asc" | "desc"): number {
  const av = a ? a.slice(0, 10) : "";
  const bv = b ? b.slice(0, 10) : "";
  if (!av && !bv) return 0;
  if (!av) return 1;
  if (!bv) return -1;
  if (av === bv) return 0;
  return dir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
}

const ACTIVITY_SORTS = [
  { value: "activity-desc", label: "Activity date (newest)" },
  { value: "activity-asc", label: "Activity date (oldest)" },
  { value: "language", label: "Language (A–Z)" },
  { value: "person", label: "Person (A–Z)" },
];

const LANGUAGE_SORTS = [
  { value: "percent-desc", label: "% complete (high→low)" },
  { value: "percent-asc", label: "% complete (low→high)" },
  { value: "language", label: "Language (A–Z)" },
];

const PERSON_SORTS = [
  { value: "touched-desc", label: "Paras touched (high→low)" },
  { value: "person", label: "Person (A–Z)" },
];

const DEFAULT_SORT = "activity-desc";

export default function ParaReportBuilder({ activity, languages, people, defaultFrom, defaultTo }: Props) {
  const [reportType, setReportType] = useState<ReportType>("activity");
  const [language, setLanguage] = useState("all");
  const [stage, setStage] = useState("all");
  const [person, setPerson] = useState("all");
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [allDates, setAllDates] = useState(false);
  const [sortBy, setSortBy] = useState(DEFAULT_SORT);
  const [busy, setBusy] = useState<"" | "xlsx" | "pdf">("");

  const isActivity = reportType === "activity";
  const isByLanguage = reportType === "byLanguage";
  const isByPerson = reportType === "byPerson";
  const dateFiltered = isActivity || isByPerson;
  const sortOptions = isActivity ? ACTIVITY_SORTS : isByLanguage ? LANGUAGE_SORTS : PERSON_SORTS;

  const switchReportType = (t: ReportType) => {
    setReportType(t);
    const opts = t === "activity" ? ACTIVITY_SORTS : t === "byLanguage" ? LANGUAGE_SORTS : PERSON_SORTS;
    if (!opts.some((o) => o.value === sortBy)) setSortBy(opts[0].value);
  };

  const stageOptions = useMemo(() => {
    const map = new Map<string, string>();
    languages.forEach((l) => l.stageKeys.forEach((s) => map.set(s.key, s.label)));
    return [...map.entries()].map(([key, label]) => ({ key, label }));
  }, [languages]);

  const languageOptions = useMemo(
    () => [...languages].map((l) => l.language).sort((a, b) => a.localeCompare(b)),
    [languages]
  );

  const personOptions = useMemo(() => [...people].sort((a, b) => a.localeCompare(b)), [people]);

  // Filtered activity rows, shared by the Activity tab and the By-person rollup.
  const filteredActivity = useMemo(() => {
    return activity.filter((a) => {
      if (language !== "all" && a.language !== language) return false;
      if (stage !== "all" && a.stage !== stage) return false;
      if (person !== "all" && a.person !== person) return false;
      if (dateFiltered && !allDates && !(inRange(a.startedAt, from, to) || inRange(a.finishedAt, from, to))) return false;
      return true;
    });
  }, [activity, language, stage, person, from, to, allDates, dateFiltered]);

  const activityRows = useMemo(() => {
    const rows = [...filteredActivity];
    rows.sort((a, b) => {
      switch (sortBy) {
        case "activity-asc":
          return cmpDate(a.finishedAt ?? a.startedAt, b.finishedAt ?? b.startedAt, "asc");
        case "language":
          return a.language.localeCompare(b.language) || a.paraNumber - b.paraNumber;
        case "person":
          return (a.person || "").localeCompare(b.person || "");
        case "activity-desc":
        default:
          return cmpDate(a.finishedAt ?? a.startedAt, b.finishedAt ?? b.startedAt, "desc");
      }
    });
    return rows;
  }, [filteredActivity, sortBy]);

  // By-language rollup: one row per (language, stage) — done/in-progress/not-started
  // out of 30, a live snapshot (not date-filtered — it's current state).
  const languageRows = useMemo(() => {
    interface G { language: string; country: string; projectName: string | null; stageKey: string; stageName: string; done: number; inProgress: number; }
    const base: G[] = [];
    for (const l of languages) {
      if (language !== "all" && l.language !== language) continue;
      for (const s of l.stageKeys) {
        if (stage !== "all" && s.key !== stage) continue;
        base.push({ language: l.language, country: l.country, projectName: l.projectName, stageKey: s.key, stageName: s.label, done: 0, inProgress: 0 });
      }
    }
    const index = new Map(base.map((g) => [`${g.language}::${g.stageKey}`, g]));
    for (const a of activity) {
      const g = index.get(`${a.language}::${a.stage}`);
      if (!g) continue;
      if (a.status === "Done") g.done += 1;
      else g.inProgress += 1;
    }
    const rows = base.map((g) => ({ ...g, notStarted: Math.max(0, TOTAL_PARAS - g.done - g.inProgress), percent: Math.round((g.done / TOTAL_PARAS) * 100) }));
    rows.sort((a, b) => {
      switch (sortBy) {
        case "percent-asc":
          return a.percent - b.percent || a.language.localeCompare(b.language);
        case "language":
          return a.language.localeCompare(b.language);
        case "percent-desc":
        default:
          return b.percent - a.percent || a.language.localeCompare(b.language);
      }
    });
    return rows;
  }, [languages, activity, language, stage, sortBy]);

  // By-person rollup: one row per person, within the current filters/date range.
  const personRows = useMemo(() => {
    interface G { person: string; touched: number; done: number; inProgress: number; last: string | null; }
    const m = new Map<string, G>();
    for (const a of filteredActivity) {
      const name = a.person || "Unassigned";
      const g = m.get(name) ?? { person: name, touched: 0, done: 0, inProgress: 0, last: null };
      g.touched += 1;
      if (a.status === "Done") g.done += 1;
      else g.inProgress += 1;
      const activityDate = a.finishedAt ?? a.startedAt;
      if (activityDate && (!g.last || activityDate > g.last)) g.last = activityDate;
      m.set(name, g);
    }
    const rows = [...m.values()];
    rows.sort((a, b) => {
      switch (sortBy) {
        case "person":
          return a.person.localeCompare(b.person);
        case "touched-desc":
        default:
          return b.touched - a.touched || a.person.localeCompare(b.person);
      }
    });
    return rows;
  }, [filteredActivity, sortBy]);

  const count = isActivity ? activityRows.length : isByLanguage ? languageRows.length : personRows.length;

  const header = isActivity
    ? ["Language", "Project", "Stage", "Para #", "Person", "Started", "Finished", "Status"]
    : isByLanguage
    ? ["Language", "Project", "Stage", "Done", "In progress", "Not started", "% complete"]
    : ["Person", "Paras touched", "Finished", "In progress", "Last activity"];

  const body: string[][] = isActivity
    ? activityRows.map((a) => [
        a.language,
        a.projectName ?? "—",
        a.stageName,
        String(a.paraNumber),
        a.person || "—",
        fmt(a.startedAt),
        fmt(a.finishedAt),
        a.status,
      ])
    : isByLanguage
    ? languageRows.map((g) => [
        g.language,
        g.projectName ?? "—",
        g.stageName,
        String(g.done),
        String(g.inProgress),
        String(g.notStarted),
        `${g.percent}%`,
      ])
    : personRows.map((g) => [g.person, String(g.touched), String(g.done), String(g.inProgress), fmt(g.last)]);

  const ORG_NAME = "Translation Management System";
  const FOOTER = "Managed By Ahmed Raza Madani — Team Lead Translation";

  const reportLabel = isActivity ? "Para Activity Log" : isByLanguage ? "Progress by Language" : "Progress by Person";

  const scopeLine = () => {
    const parts: string[] = [];
    const sortLabel = sortOptions.find((o) => o.value === sortBy)?.label ?? sortBy;
    parts.push(`Language: ${language === "all" ? "All" : language}`);
    parts.push(`Stage: ${stage === "all" ? "All" : stageOptions.find((s) => s.key === stage)?.label ?? stage}`);
    if (isActivity) parts.push(`Person: ${person === "all" ? "All" : person}`);
    if (dateFiltered) parts.push(`Period: ${allDates ? "All dates" : `${from} → ${to}`}`);
    else parts.push("Scope: Current snapshot");
    parts.push(`Sorted by: ${sortLabel}`);
    return parts.join("   ·   ");
  };

  const generatedLine = () =>
    `Generated: ${new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}   ·   ${count} row${count === 1 ? "" : "s"}`;

  const baseName = () => {
    const range = dateFiltered ? (allDates ? "all-dates" : `${from}_${to}`) : "snapshot";
    return `tms-quran-${reportType}-${range}`;
  };

  const downloadExcel = async () => {
    setBusy("xlsx");
    try {
      const XLSX = await import("xlsx");
      const ncols = header.length;
      const aoa: (string | number)[][] = [[ORG_NAME], [reportLabel], [scopeLine()], [generatedLine()], [], header, ...body, [], [FOOTER]];
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      const lastRow = aoa.length - 1;
      ws["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: ncols - 1 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: ncols - 1 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: ncols - 1 } },
        { s: { r: 3, c: 0 }, e: { r: 3, c: ncols - 1 } },
        { s: { r: lastRow, c: 0 }, e: { r: lastRow, c: ncols - 1 } },
      ];
      ws["!cols"] = header.map((h, i) => {
        const maxLen = Math.max(h.length, ...body.map((r) => (r[i] ? String(r[i]).length : 0)));
        return { wch: Math.min(Math.max(maxLen + 2, 12), 48) };
      });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, isActivity ? "Activity" : isByLanguage ? "By Language" : "By Person");
      XLSX.writeFile(wb, `${baseName()}.xlsx`);
    } catch (e) {
      console.error(e);
      alert("Could not generate the Excel file.");
    } finally {
      setBusy("");
    }
  };

  const downloadPdf = async () => {
    setBusy("pdf");
    try {
      const { jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;
      const doc = new jsPDF({ orientation: "landscape" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const scope = scopeLine();
      const generated = generatedLine();

      const BAND_H = 22;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      const scopeLines = doc.splitTextToSize(scope, pageW - 20) as string[];
      const scopeTop = BAND_H + 6;
      const dividerY = scopeTop + scopeLines.length * 4.2;
      const startY = dividerY + 4;

      autoTable(doc, {
        head: [header],
        body,
        startY,
        styles: { fontSize: 7.5, cellPadding: 2, overflow: "linebreak", valign: "middle", lineColor: [229, 231, 235], lineWidth: 0.1, textColor: [31, 41, 55] },
        headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: "bold", halign: "left" },
        alternateRowStyles: { fillColor: [240, 253, 244] },
        margin: { top: startY, left: 10, right: 10, bottom: 16 },
        didDrawPage: (data) => {
          doc.setFillColor(16, 185, 129);
          doc.rect(0, 0, pageW, BAND_H, "F");
          doc.setFillColor(5, 150, 105);
          doc.rect(0, BAND_H, pageW, 0.8, "F");
          doc.setTextColor(255, 255, 255);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(15);
          doc.text(ORG_NAME, 10, 10);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(10);
          doc.text(reportLabel, 10, 17.5);
          doc.setFontSize(8);
          doc.text(generated, pageW - 10, 17.5, { align: "right" });

          doc.setTextColor(75, 85, 99);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          doc.text(scopeLines, 10, scopeTop);
          doc.setDrawColor(209, 213, 219);
          doc.setLineWidth(0.2);
          doc.line(10, dividerY, pageW - 10, dividerY);

          doc.line(10, pageH - 11, pageW - 10, pageH - 11);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8);
          doc.setTextColor(16, 185, 129);
          doc.text(FOOTER, 10, pageH - 5);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(120, 120, 120);
          doc.text(`Page ${data.pageNumber}`, pageW - 10, pageH - 5, { align: "right" });
        },
      });

      doc.save(`${baseName()}.pdf`);
    } catch (e) {
      console.error(e);
      alert("Could not generate the PDF file.");
    } finally {
      setBusy("");
    }
  };

  const selectCls =
    "rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20";

  return (
    <>
      <div className="mb-4 inline-flex flex-wrap rounded-xl bg-gray-100 dark:bg-gray-800 p-1">
        {(["activity", "byLanguage", "byPerson"] as ReportType[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => switchReportType(t)}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
              reportType === t
                ? "bg-white dark:bg-gray-900 text-emerald-700 dark:text-emerald-400 shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            }`}
          >
            {t === "activity" ? "Activity" : t === "byLanguage" ? "By language" : "By person"}
          </button>
        ))}
      </div>

      <div className="mb-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 sm:p-4">
        <div className={`grid gap-3 sm:grid-cols-2 ${isActivity ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}>
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Language</label>
            <select aria-label="Language" value={language} onChange={(e) => setLanguage(e.target.value)} className={`${selectCls} mt-1 w-full`}>
              <option value="all">All languages</option>
              {languageOptions.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Stage</label>
            <select aria-label="Stage" value={stage} onChange={(e) => setStage(e.target.value)} className={`${selectCls} mt-1 w-full`}>
              <option value="all">All stages</option>
              {stageOptions.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
          </div>
          {isActivity && (
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Person</label>
              <select aria-label="Person" value={person} onChange={(e) => setPerson(e.target.value)} className={`${selectCls} mt-1 w-full`}>
                <option value="all">All people</option>
                {personOptions.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">From</label>
            <input type="date" value={from} disabled={!dateFiltered || allDates} onChange={(e) => setFrom(e.target.value)} className={`${selectCls} mt-1 w-full disabled:opacity-50`} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">To</label>
            <input type="date" value={to} disabled={!dateFiltered || allDates} onChange={(e) => setTo(e.target.value)} className={`${selectCls} mt-1 w-full disabled:opacity-50`} />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="flex items-center gap-2">
              <label htmlFor="rpt_sort" className="text-sm text-gray-500 dark:text-gray-400">Sort by:</label>
              <select id="rpt_sort" value={sortBy} onChange={(e) => setSortBy(e.target.value)} className={`${selectCls} py-1.5`}>
                {sortOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            {dateFiltered && (
              <label className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                <input type="checkbox" checked={allDates} onChange={(e) => setAllDates(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500" />
                All dates (ignore range)
              </label>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500 dark:text-gray-400">{count} row{count === 1 ? "" : "s"}</span>
            <button type="button" onClick={downloadExcel} disabled={busy !== "" || count === 0} className="btn-press inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
              {busy === "xlsx" ? "Generating…" : "⬇ Excel"}
            </button>
            <button type="button" onClick={downloadPdf} disabled={busy !== "" || count === 0} className="btn-press inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50">
              {busy === "pdf" ? "Generating…" : "⬇ PDF"}
            </button>
          </div>
        </div>
      </div>

      {count === 0 ? (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-10 text-center text-gray-500 dark:text-gray-400">
          No rows for these filters. Try “All dates”, or change the language/stage/person.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                {header.map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {body.slice(0, 200).map((row, ri) => (
                <tr key={ri} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-3 py-2 text-gray-700 dark:text-gray-300 whitespace-nowrap max-w-[260px] truncate" title={cell}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {body.length > 200 && (
            <p className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">Showing first 200 of {body.length} rows — the download includes all {body.length}.</p>
          )}
        </div>
      )}
    </>
  );
}
