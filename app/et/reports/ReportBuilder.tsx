"use client";

import { useMemo, useState } from "react";

export interface ActivityRow {
  itemId: string;
  itemTitle: string;
  type: string;
  category: string;
  stage: string;
  stageName: string;
  person: string;
  sent: string | null;
  received: string | null;
}

export interface ItemReportRow {
  itemId: string;
  title: string;
  type: string;
  category: string;
  status: string;
  stageCode: string | null;
  currentStep: string;
  holder: string;
  progress: string;
  delivery: string | null;
  wordCount: number | null;
  received: string | null;
  finalEmail: string | null;
}

interface Props {
  activity: ActivityRow[];
  items: ItemReportRow[];
  people: string[];
  defaultFrom: string;
  defaultTo: string;
}

type ReportType = "activity" | "items";

function fmt(d: string | null): string {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "";
  return dt.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function daysBetween(a: string | null, b: string | null): string {
  if (!a || !b) return "";
  const d = (new Date(b).getTime() - new Date(a).getTime()) / 86400000;
  return Number.isFinite(d) ? String(Math.round(d)) : "";
}

function inRange(d: string | null, from: string, to: string): boolean {
  if (!d) return false;
  const day = d.slice(0, 10);
  return day >= from && day <= to;
}

/** Compare two date strings; empty/missing dates always sort last. */
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
  { value: "received-desc", label: "Received date (newest)" },
  { value: "received-asc", label: "Received date (oldest)" },
  { value: "sent-desc", label: "Sent date (newest)" },
  { value: "sent-asc", label: "Sent date (oldest)" },
  { value: "type", label: "Type" },
  { value: "person", label: "Person (A–Z)" },
  { value: "title", label: "Item title (A–Z)" },
];

const ITEM_SORTS = [
  { value: "received-desc", label: "Received date (newest)" },
  { value: "received-asc", label: "Received date (oldest)" },
  { value: "delivery-asc", label: "Delivery date (soonest)" },
  { value: "final-desc", label: "Final email (newest)" },
  { value: "type", label: "Type" },
  { value: "words-desc", label: "Words (high→low)" },
  { value: "title", label: "Title (A–Z)" },
];

const DEFAULT_SORT = "received-desc";

/** Pipeline order for sorting the Stage filter (incl. magazine DSN, wsb PIS/FFM). */
const STAGE_CODE_ORDER = ["TR", "IF", "CM", "ED", "NR", "ST", "FF", "DSN", "FPR", "PIS", "FFM"];

export default function ReportBuilder({ activity, items, people, defaultFrom, defaultTo }: Props) {
  const [reportType, setReportType] = useState<ReportType>("activity");
  const [person, setPerson] = useState("all");
  const [category, setCategory] = useState("all");
  const [stage, setStage] = useState("all");
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [allDates, setAllDates] = useState(false);
  const [sortBy, setSortBy] = useState(DEFAULT_SORT);
  const [busy, setBusy] = useState<"" | "xlsx" | "pdf">("");

  const sortOptions = reportType === "activity" ? ACTIVITY_SORTS : ITEM_SORTS;

  // Switching report type: keep the sort if it still exists, else reset.
  const switchReportType = (t: ReportType) => {
    setReportType(t);
    const valid = (t === "activity" ? ACTIVITY_SORTS : ITEM_SORTS).some((o) => o.value === sortBy);
    if (!valid) setSortBy(DEFAULT_SORT);
  };

  const categories = useMemo(() => {
    const set = new Set<string>();
    activity.forEach((a) => set.add(a.category));
    items.forEach((i) => set.add(i.category));
    return [...set].sort();
  }, [activity, items]);

  // Stage options (code → name), in pipeline order. Activity rows carry both the
  // code and the full name; item rows contribute their current stage code.
  const stageOptions = useMemo(() => {
    const map = new Map<string, string>();
    activity.forEach((a) => { if (a.stage) map.set(a.stage, a.stageName); });
    items.forEach((i) => { if (i.stageCode && !map.has(i.stageCode)) map.set(i.stageCode, i.stageCode); });
    return [...map.entries()]
      .map(([code, name]) => ({ code, name }))
      .sort((a, b) => {
        const ia = STAGE_CODE_ORDER.indexOf(a.code);
        const ib = STAGE_CODE_ORDER.indexOf(b.code);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      });
  }, [activity, items]);

  const stageLabelFor = (code: string) =>
    stageOptions.find((s) => s.code === code)?.name ?? code;

  // Names that actually appear (workforce + any holder/person on record).
  const personOptions = useMemo(() => {
    const set = new Set<string>(people);
    activity.forEach((a) => a.person && set.add(a.person));
    items.forEach((i) => i.holder && set.add(i.holder));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [people, activity, items]);

  const activityRows = useMemo(() => {
    const rows = activity.filter((a) => {
      if (person !== "all" && a.person !== person) return false;
      if (category !== "all" && a.category !== category) return false;
      if (stage !== "all" && a.stage !== stage) return false;
      if (!allDates && !(inRange(a.received, from, to) || inRange(a.sent, from, to))) return false;
      return true;
    });
    return rows.sort((a, b) => {
      switch (sortBy) {
        case "received-asc": return cmpDate(a.received, b.received, "asc");
        case "sent-desc": return cmpDate(a.sent, b.sent, "desc");
        case "sent-asc": return cmpDate(a.sent, b.sent, "asc");
        case "type": return a.type.localeCompare(b.type) || a.itemTitle.localeCompare(b.itemTitle);
        case "person": return (a.person || "").localeCompare(b.person || "");
        case "title": return a.itemTitle.localeCompare(b.itemTitle);
        case "received-desc":
        default: return cmpDate(a.received, b.received, "desc");
      }
    });
  }, [activity, person, category, stage, from, to, allDates, sortBy]);

  const itemRows = useMemo(() => {
    const rows = items.filter((i) => {
      if (person !== "all" && i.holder !== person) return false;
      if (category !== "all" && i.category !== category) return false;
      if (stage !== "all" && i.stageCode !== stage) return false;
      if (!allDates && !inRange(i.received, from, to)) return false;
      return true;
    });
    return rows.sort((a, b) => {
      switch (sortBy) {
        case "received-asc": return cmpDate(a.received, b.received, "asc");
        case "delivery-asc": return cmpDate(a.delivery, b.delivery, "asc");
        case "final-desc": return cmpDate(a.finalEmail, b.finalEmail, "desc");
        case "type": return a.type.localeCompare(b.type) || a.title.localeCompare(b.title);
        case "words-desc": return (b.wordCount || 0) - (a.wordCount || 0);
        case "title": return a.title.localeCompare(b.title);
        case "received-desc":
        default: return cmpDate(a.received, b.received, "desc");
      }
    });
  }, [items, person, category, stage, from, to, allDates, sortBy]);

  const isActivity = reportType === "activity";
  const count = isActivity ? activityRows.length : itemRows.length;

  // ---- table shapes (shared by preview + export) ----
  const header = isActivity
    ? ["Item", "Type", "Category", "Stage", "Person", "Sent", "Received", "Days"]
    : ["Title", "Type", "Category", "Status", "Current step", "Holder", "Progress", "Delivery", "Words", "Received", "Final email"];

  const body: string[][] = isActivity
    ? activityRows.map((a) => [
        a.itemTitle,
        a.type,
        a.category,
        `${a.stage} · ${a.stageName}`,
        a.person || "—",
        fmt(a.sent),
        fmt(a.received),
        daysBetween(a.sent, a.received),
      ])
    : itemRows.map((i) => [
        i.title,
        i.type,
        i.category,
        i.status,
        i.currentStep,
        i.holder || "—",
        i.progress,
        fmt(i.delivery),
        i.wordCount != null ? i.wordCount.toLocaleString() : "",
        fmt(i.received),
        fmt(i.finalEmail),
      ]);

  // ---- branding / metadata shared by both exports ----
  const ORG_NAME = "Translation Management System";
  const FOOTER = "Managed By Ahmed Raza Madani — Team Lead Translation";

  const reportLabel = isActivity ? "Per-Person Activity Report" : "Full Items Export";

  const scopeLine = () => {
    const parts: string[] = [];
    parts.push(`Person: ${person === "all" ? "All" : person}`);
    parts.push(`Category: ${category === "all" ? "All" : category}`);
    parts.push(`Stage: ${stage === "all" ? "All" : `${stage} · ${stageLabelFor(stage)}`}`);
    parts.push(`Period: ${allDates ? "All dates" : `${from} → ${to}`}`);
    const sortLabel = sortOptions.find((o) => o.value === sortBy)?.label ?? sortBy;
    parts.push(`Sorted by: ${sortLabel}`);
    return parts.join("   ·   ");
  };

  const generatedLine = () =>
    `Generated: ${new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}   ·   ${count} row${count === 1 ? "" : "s"}`;

  const baseName = () => {
    const who = person === "all" ? "all" : person.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    const range = allDates ? "all-dates" : `${from}_${to}`;
    return `tms-${reportType}-${who}-${range}`;
  };

  const downloadExcel = async () => {
    setBusy("xlsx");
    try {
      const XLSX = await import("xlsx");
      const ncols = header.length;
      const aoa: (string | number)[][] = [
        [ORG_NAME],
        [reportLabel],
        [scopeLine()],
        [generatedLine()],
        [],
        header,
        ...body,
        [],
        [FOOTER],
      ];
      const ws = XLSX.utils.aoa_to_sheet(aoa);

      // Merge the title / subtitle / scope / generated / footer rows across all columns.
      const lastRow = aoa.length - 1;
      ws["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: ncols - 1 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: ncols - 1 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: ncols - 1 } },
        { s: { r: 3, c: 0 }, e: { r: 3, c: ncols - 1 } },
        { s: { r: lastRow, c: 0 }, e: { r: lastRow, c: ncols - 1 } },
      ];

      // Reasonable column widths based on the header + content length.
      ws["!cols"] = header.map((h, i) => {
        const maxLen = Math.max(h.length, ...body.map((r) => (r[i] ? String(r[i]).length : 0)));
        return { wch: Math.min(Math.max(maxLen + 2, 12), 48) };
      });

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, isActivity ? "Activity" : "Items");
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

      autoTable(doc, {
        head: [header],
        body,
        startY: 34,
        styles: { fontSize: 7, cellPadding: 1.5, overflow: "linebreak", valign: "middle" },
        headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [243, 244, 246] },
        margin: { top: 34, left: 10, right: 10, bottom: 16 },
        didDrawPage: (data) => {
          // ---- Header band ----
          doc.setFillColor(16, 185, 129);
          doc.rect(0, 0, pageW, 20, "F");
          doc.setTextColor(255, 255, 255);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(15);
          doc.text(ORG_NAME, 10, 9);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(10);
          doc.text(reportLabel, 10, 16);

          // ---- Scope + generated (just under the band) ----
          doc.setTextColor(75, 85, 99);
          doc.setFontSize(7.5);
          doc.text(scope, 10, 26);
          doc.text(generated, pageW - 10, 26, { align: "right" });
          doc.setDrawColor(209, 213, 219);
          doc.line(10, 29, pageW - 10, 29);

          // ---- Footer (every page) ----
          doc.setDrawColor(209, 213, 219);
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
      {/* Report type toggle */}
      <div className="mb-4 inline-flex rounded-xl bg-gray-100 dark:bg-gray-800 p-1">
        {(["activity", "items"] as ReportType[]).map((t) => (
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
            {t === "activity" ? "Per-person activity" : "Full items export"}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="mb-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 sm:p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">{isActivity ? "Person" : "Current holder"}</label>
            <select aria-label="Person" value={person} onChange={(e) => setPerson(e.target.value)} className={`${selectCls} mt-1 w-full`}>
              <option value="all">All people</option>
              {personOptions.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Stage</label>
            <select aria-label="Stage" value={stage} onChange={(e) => setStage(e.target.value)} className={`${selectCls} mt-1 w-full`}>
              <option value="all">All stages</option>
              {stageOptions.map((s) => (
                <option key={s.code} value={s.code}>{s.code} · {s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Category</label>
            <select aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value)} className={`${selectCls} mt-1 w-full`}>
              <option value="all">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">From</label>
            <input type="date" value={from} disabled={allDates} onChange={(e) => setFrom(e.target.value)} className={`${selectCls} mt-1 w-full disabled:opacity-50`} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">To</label>
            <input type="date" value={to} disabled={allDates} onChange={(e) => setTo(e.target.value)} className={`${selectCls} mt-1 w-full disabled:opacity-50`} />
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
            <label className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <input type="checkbox" checked={allDates} onChange={(e) => setAllDates(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500" />
              All dates (ignore range)
            </label>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500 dark:text-gray-400">{count} row{count === 1 ? "" : "s"}</span>
            <button
              type="button"
              onClick={downloadExcel}
              disabled={busy !== "" || count === 0}
              className="btn-press inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              {busy === "xlsx" ? "Generating…" : "⬇ Excel"}
            </button>
            <button
              type="button"
              onClick={downloadPdf}
              disabled={busy !== "" || count === 0}
              className="btn-press inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
            >
              {busy === "pdf" ? "Generating…" : "⬇ PDF"}
            </button>
          </div>
        </div>
      </div>

      {/* Preview */}
      {count === 0 ? (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-10 text-center text-gray-500 dark:text-gray-400">
          No rows for these filters. Try “All dates”, or change the person/category.
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
