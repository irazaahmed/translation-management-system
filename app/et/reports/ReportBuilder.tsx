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

/** One row per stage of a single item — its full step-by-step timeline. */
export interface ItemStageRow {
  itemId: string;
  itemTitle: string;
  type: string;
  category: string;
  seq: number;
  stage: string;
  stageName: string;
  person: string;
  sent: string | null;
  received: string | null;
  status: string;
}

/** One logged "return to fix a missing part" event, joined with its item. */
export interface ReturnReportRow {
  itemId: string;
  itemTitle: string;
  type: string;
  category: string;
  stage: string | null;
  stageName: string;
  person: string;
  note: string;
  given: string | null;
  back: string | null;
  status: string;
}

interface Props {
  activity: ActivityRow[];
  items: ItemReportRow[];
  itemStages: ItemStageRow[];
  returns: ReturnReportRow[];
  people: string[];
  defaultFrom: string;
  defaultTo: string;
}

type ReportType = "activity" | "items" | "single" | "returns";

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

const RETURN_SORTS = [
  { value: "given-desc", label: "Return date (newest)" },
  { value: "given-asc", label: "Return date (oldest)" },
  { value: "count-desc", label: "Most returns" },
  { value: "title", label: "Item title (A–Z)" },
  { value: "person", label: "Returned to (A–Z)" },
];

const DEFAULT_SORT = "received-desc";

/** Pipeline order for sorting the Stage filter (incl. magazine DSN, wsb PIS/FFM). */
const STAGE_CODE_ORDER = ["TR", "IF", "CM", "ED", "NR", "ST", "FF", "DSN", "FPR", "PIS", "FFM"];

export default function ReportBuilder({ activity, items, itemStages, returns, people, defaultFrom, defaultTo }: Props) {
  const [reportType, setReportType] = useState<ReportType>("activity");
  const [person, setPerson] = useState("all");
  const [category, setCategory] = useState("all");
  const [stage, setStage] = useState("all");
  const [status, setStatus] = useState("all");
  const [itemId, setItemId] = useState("");
  const [itemQuery, setItemQuery] = useState("");
  const [itemOpen, setItemOpen] = useState(false);
  const [returnItemId, setReturnItemId] = useState("");
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [allDates, setAllDates] = useState(false);
  const [sortBy, setSortBy] = useState(DEFAULT_SORT);
  const [busy, setBusy] = useState<"" | "xlsx" | "pdf">("");

  const isSingle = reportType === "single";
  const isReturns = reportType === "returns";
  const isReturnDetail = isReturns && returnItemId !== "";
  const sortOptions = reportType === "activity" ? ACTIVITY_SORTS : isReturns ? RETURN_SORTS : ITEM_SORTS;

  // Switching report type: keep the sort if it still exists, else reset to that
  // report's first sort option.
  const switchReportType = (t: ReportType) => {
    setReportType(t);
    const opts = t === "activity" ? ACTIVITY_SORTS : t === "returns" ? RETURN_SORTS : ITEM_SORTS;
    if (!opts.some((o) => o.value === sortBy)) setSortBy(t === "returns" ? RETURN_SORTS[0].value : DEFAULT_SORT);
  };

  // Items the picker can choose from (single-item report), A–Z by title.
  const itemList = useMemo(
    () => [...items].sort((a, b) => a.title.localeCompare(b.title)),
    [items]
  );

  const selectedItem = useMemo(
    () => items.find((i) => i.itemId === itemId) ?? null,
    [items, itemId]
  );

  // Items matching the search box (by title or type), capped for a snappy list.
  const ITEM_RESULT_CAP = 60;
  const itemMatches = useMemo(() => {
    const q = itemQuery.trim().toLowerCase();
    const base = q
      ? itemList.filter(
          (i) => i.title.toLowerCase().includes(q) || (i.type || "").toLowerCase().includes(q)
        )
      : itemList;
    return { rows: base.slice(0, ITEM_RESULT_CAP), total: base.length };
  }, [itemList, itemQuery]);

  const pickItem = (i: ItemReportRow) => {
    setItemId(i.itemId);
    setItemQuery(`${i.title}${i.type ? ` · ${i.type}` : ""}`);
    setItemOpen(false);
  };

  const clearItem = () => {
    setItemId("");
    setItemQuery("");
    setItemOpen(true);
  };

  // The chosen item's full step timeline, in pipeline order.
  const singleRows = useMemo(
    () => (itemId ? itemStages.filter((r) => r.itemId === itemId).sort((a, b) => a.seq - b.seq) : []),
    [itemStages, itemId]
  );

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

  // Only real workforce names — the stage "person" field sometimes holds free
  // text notes (e.g. "emailed to Aashir on 5/11…"), which must NOT appear here.
  const personOptions = useMemo(
    () => [...people].sort((a, b) => a.localeCompare(b)),
    [people]
  );

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
      if (status !== "all" && i.status !== status) return false;
      if (stage !== "all" && i.stageCode !== stage) return false;
      // For completed items the range means "completed within" — so match the
      // completion (final email) date, not the received date.
      if (!allDates) {
        const rangeDate = status === "Completed" ? i.finalEmail : i.received;
        if (!inRange(rangeDate, from, to)) return false;
      }
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
  }, [items, person, category, status, stage, from, to, allDates, sortBy]);

  // Distinct items that have at least one return — the dropdown for the Returns
  // report's drill-down. Built from all returns so the choice stays stable.
  const returnItemOptions = useMemo(() => {
    const map = new Map<string, string>();
    returns.forEach((r) => { if (!map.has(r.itemId)) map.set(r.itemId, r.itemTitle); });
    return [...map.entries()]
      .map(([id, title]) => ({ id, title }))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [returns]);

  // Summary rows: one per item that had a return within the current filters —
  // how many, how many still out, and the latest return date.
  const returnSummary = useMemo(() => {
    interface G { itemId: string; title: string; type: string; category: string; count: number; out: number; last: string | null; }
    const m = new Map<string, G>();
    for (const r of returns) {
      if (person !== "all" && r.person !== person) continue;
      if (category !== "all" && r.category !== category) continue;
      if (!allDates && !inRange(r.given, from, to)) continue;
      const g = m.get(r.itemId) ?? { itemId: r.itemId, title: r.itemTitle, type: r.type, category: r.category, count: 0, out: 0, last: null };
      g.count += 1;
      if (!r.back) g.out += 1;
      if (r.given && (!g.last || r.given > g.last)) g.last = r.given;
      m.set(r.itemId, g);
    }
    const rows = [...m.values()];
    rows.sort((a, b) => {
      switch (sortBy) {
        case "given-asc": return cmpDate(a.last, b.last, "asc");
        case "title": return a.title.localeCompare(b.title);
        case "count-desc": return b.count - a.count || a.title.localeCompare(b.title);
        case "given-desc":
        case "person":
        default: return cmpDate(a.last, b.last, "desc");
      }
    });
    return rows;
  }, [returns, person, category, from, to, allDates, sortBy]);

  // Detail rows: the chosen item's COMPLETE return history (all of it, ignoring
  // the person/date filters) — when it went back, to whom, and for what.
  const returnDetail = useMemo(() => {
    if (!returnItemId) return [];
    const rows = returns.filter((r) => r.itemId === returnItemId);
    rows.sort((a, b) => {
      switch (sortBy) {
        case "given-asc": return cmpDate(a.given, b.given, "asc");
        case "person": return (a.person || "").localeCompare(b.person || "");
        case "title": return (a.stage || "").localeCompare(b.stage || "");
        case "given-desc":
        case "count-desc":
        default: return cmpDate(a.given, b.given, "desc");
      }
    });
    return rows;
  }, [returns, returnItemId, sortBy]);

  const isActivity = reportType === "activity";
  const count = isSingle
    ? singleRows.length
    : isReturns
    ? isReturnDetail
      ? returnDetail.length
      : returnSummary.length
    : isActivity
    ? activityRows.length
    : itemRows.length;

  // ---- table shapes (shared by preview + export) ----
  const header = isSingle
    ? ["Step", "Stage", "Person", "Sent", "Received", "Days", "Status"]
    : isReturns
    ? isReturnDetail
      ? ["Stage", "Returned to", "What was missing", "Given", "Came back", "Days", "Status"]
      : ["Title", "Type", "Category", "Returns", "Still out", "Last return"]
    : isActivity
    ? ["Item", "Type", "Category", "Stage", "Person", "Sent", "Received", "Days"]
    : ["Title", "Type", "Category", "Status", "Current step", "Holder", "Progress", "Delivery", "Words", "Received", "Final email"];

  const body: string[][] = isSingle
    ? singleRows.map((r) => [
        String(r.seq),
        `${r.stage} · ${r.stageName}`,
        r.person || "—",
        fmt(r.sent),
        fmt(r.received),
        daysBetween(r.sent, r.received),
        r.status,
      ])
    : isReturns
    ? isReturnDetail
      ? returnDetail.map((r) => [
          r.stage ? `${r.stage} · ${r.stageName}` : "—",
          r.person || "—",
          r.note || "—",
          fmt(r.given),
          fmt(r.back),
          daysBetween(r.given, r.back),
          r.status,
        ])
      : returnSummary.map((g) => [
          g.title,
          g.type,
          g.category,
          String(g.count),
          String(g.out),
          fmt(g.last),
        ])
    : isActivity
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

  const returnItemTitle = returnItemOptions.find((o) => o.id === returnItemId)?.title ?? "—";

  const reportLabel = isSingle
    ? "Single Item — Full Step Timeline"
    : isReturns
    ? isReturnDetail
      ? "Item Returns — Full History"
      : "Returns — Items Sent Back to Fix"
    : isActivity
    ? "Per-Person Activity Report"
    : "Full Items Export";

  const scopeLine = () => {
    const parts: string[] = [];
    const sortLabel = sortOptions.find((o) => o.value === sortBy)?.label ?? sortBy;
    if (isSingle) {
      parts.push(`Item: ${selectedItem ? selectedItem.title : "—"}`);
      if (selectedItem) {
        parts.push(`Type: ${selectedItem.type}`);
        parts.push(`Category: ${selectedItem.category}`);
        parts.push(`Status: ${selectedItem.status}`);
        parts.push(`Progress: ${selectedItem.progress}`);
      }
      return parts.join("   ·   ");
    }
    if (isReturns) {
      if (isReturnDetail) {
        parts.push(`Item: ${returnItemTitle}`);
        parts.push("Scope: Complete return history (all dates)");
        parts.push(`Sorted by: ${sortLabel}`);
        return parts.join("   ·   ");
      }
      parts.push("Scope: Items with returns");
      parts.push(`Returned to: ${person === "all" ? "All" : person}`);
      parts.push(`Category: ${category === "all" ? "All" : category}`);
      parts.push(`Period${allDates ? "" : " (Given)"}: ${allDates ? "All dates" : `${from} → ${to}`}`);
      parts.push(`Sorted by: ${sortLabel}`);
      return parts.join("   ·   ");
    }
    parts.push(`Person: ${person === "all" ? "All" : person}`);
    if (!isActivity) parts.push(`Status: ${status === "all" ? "All" : status}`);
    parts.push(`Category: ${category === "all" ? "All" : category}`);
    parts.push(`Stage: ${stage === "all" ? "All" : `${stage} · ${stageLabelFor(stage)}`}`);
    const periodBasis = !isActivity && status === "Completed" ? "Completed" : "Received";
    parts.push(`Period${allDates ? "" : ` (${periodBasis})`}: ${allDates ? "All dates" : `${from} → ${to}`}`);
    parts.push(`Sorted by: ${sortLabel}`);
    return parts.join("   ·   ");
  };

  const generatedLine = () =>
    `Generated: ${new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}   ·   ${count} row${count === 1 ? "" : "s"}`;

  const baseName = () => {
    if (isSingle) {
      const slug = (selectedItem?.title || "item").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
      return `tms-item-${slug}`;
    }
    if (isReturns) {
      if (isReturnDetail) {
        const slug = (returnItemTitle || "item").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
        return `tms-item-returns-${slug}`;
      }
      return `tms-returns-${allDates ? "all-dates" : `${from}_${to}`}`;
    }
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

      // Pre-measure the scope so it wraps to full width (never overlapping the
      // generated stamp) and the table starts just below it.
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
        styles: {
          fontSize: 7.5,
          cellPadding: 2,
          overflow: "linebreak",
          valign: "middle",
          lineColor: [229, 231, 235],
          lineWidth: 0.1,
          textColor: [31, 41, 55],
        },
        headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: "bold", halign: "left" },
        alternateRowStyles: { fillColor: [240, 253, 244] },
        margin: { top: startY, left: 10, right: 10, bottom: 16 },
        didDrawPage: (data) => {
          // ---- Header band ----
          doc.setFillColor(16, 185, 129);
          doc.rect(0, 0, pageW, BAND_H, "F");
          doc.setFillColor(5, 150, 105);
          doc.rect(0, BAND_H, pageW, 0.8, "F"); // darker accent under the band
          doc.setTextColor(255, 255, 255);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(15);
          doc.text(ORG_NAME, 10, 10);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(10);
          doc.text(reportLabel, 10, 17.5);
          // Generated stamp on the right, inside the band (kept clear of scope).
          doc.setFontSize(8);
          doc.text(generated, pageW - 10, 17.5, { align: "right" });

          // ---- Scope line(s), wrapped, just under the band ----
          doc.setTextColor(75, 85, 99);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          doc.text(scopeLines, 10, scopeTop);
          doc.setDrawColor(209, 213, 219);
          doc.setLineWidth(0.2);
          doc.line(10, dividerY, pageW - 10, dividerY);

          // ---- Footer (every page) ----
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
      <div className="mb-4 inline-flex flex-wrap rounded-xl bg-gray-100 dark:bg-gray-800 p-1">
        {(["activity", "items", "returns", "single"] as ReportType[]).map((t) => (
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
            {t === "activity" ? "Per-person activity" : t === "items" ? "Full items export" : t === "returns" ? "Returns" : "Single item"}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="mb-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 sm:p-4">
        {isSingle ? (
          /* Single item: just pick the item — its full step timeline follows. */
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="relative min-w-0 flex-1 sm:max-w-md">
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Item</label>
              <input
                type="text"
                aria-label="Search item"
                value={itemQuery}
                placeholder="Search by title or type…"
                onChange={(e) => {
                  setItemQuery(e.target.value);
                  setItemOpen(true);
                  if (itemId) setItemId("");
                }}
                onFocus={() => setItemOpen(true)}
                onBlur={() => setTimeout(() => setItemOpen(false), 150)}
                className={`${selectCls} mt-1 w-full pr-8`}
              />
              {(itemQuery || itemId) && (
                <button
                  type="button"
                  aria-label="Clear"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={clearItem}
                  className="absolute right-2 top-[33px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  ✕
                </button>
              )}
              {itemOpen && (
                <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-1 shadow-lg">
                  {itemMatches.rows.length === 0 ? (
                    <li className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">No items match “{itemQuery}”.</li>
                  ) : (
                    <>
                      {itemMatches.rows.map((i) => (
                        <li key={i.itemId}>
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => pickItem(i)}
                            className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-emerald-50 dark:hover:bg-emerald-900/20 ${
                              i.itemId === itemId ? "bg-emerald-50 dark:bg-emerald-900/20" : ""
                            }`}
                          >
                            <span className="min-w-0 flex-1 truncate text-gray-800 dark:text-gray-100">{i.title}</span>
                            {i.type && <span className="flex-shrink-0 text-xs text-gray-400">{i.type}</span>}
                          </button>
                        </li>
                      ))}
                      {itemMatches.total > itemMatches.rows.length && (
                        <li className="px-3 py-1.5 text-xs text-gray-400 dark:text-gray-500">
                          Showing {itemMatches.rows.length} of {itemMatches.total} — keep typing to narrow.
                        </li>
                      )}
                    </>
                  )}
                </ul>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500 dark:text-gray-400">{count} step{count === 1 ? "" : "s"}</span>
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
        ) : (
          <>
            <div className={`grid gap-3 sm:grid-cols-2 ${isActivity || isReturns ? "lg:grid-cols-5" : "lg:grid-cols-6"}`}>
              {isReturns && (
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Item</label>
                  <select aria-label="Item" value={returnItemId} onChange={(e) => setReturnItemId(e.target.value)} className={`${selectCls} mt-1 w-full`}>
                    <option value="">All items with returns</option>
                    {returnItemOptions.map((o) => (
                      <option key={o.id} value={o.id}>{o.title}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400">{isReturns ? "Returned to" : isActivity ? "Person" : "Current holder"}</label>
                <select aria-label="Person" value={person} onChange={(e) => setPerson(e.target.value)} disabled={isReturnDetail} className={`${selectCls} mt-1 w-full disabled:opacity-50`}>
                  <option value="all">All people</option>
                  {personOptions.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              {!isActivity && !isReturns && (
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Status</label>
                  <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className={`${selectCls} mt-1 w-full`}>
                    <option value="all">All statuses</option>
                    <option value="Completed">Completed</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Unassigned">Unassigned</option>
                  </select>
                </div>
              )}
              {!isReturns && (
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Stage</label>
                  <select aria-label="Stage" value={stage} onChange={(e) => setStage(e.target.value)} className={`${selectCls} mt-1 w-full`}>
                    <option value="all">All stages</option>
                    {stageOptions.map((s) => (
                      <option key={s.code} value={s.code}>{s.code} · {s.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Category</label>
                <select aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value)} disabled={isReturnDetail} className={`${selectCls} mt-1 w-full disabled:opacity-50`}>
                  <option value="all">All categories</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400">From</label>
                <input type="date" value={from} disabled={allDates || isReturnDetail} onChange={(e) => setFrom(e.target.value)} className={`${selectCls} mt-1 w-full disabled:opacity-50`} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400">To</label>
                <input type="date" value={to} disabled={allDates || isReturnDetail} onChange={(e) => setTo(e.target.value)} className={`${selectCls} mt-1 w-full disabled:opacity-50`} />
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
                <label className={`inline-flex items-center gap-2 text-sm ${isReturnDetail ? "text-gray-400 dark:text-gray-600" : "text-gray-600 dark:text-gray-300"}`}>
                  <input type="checkbox" checked={allDates} disabled={isReturnDetail} onChange={(e) => setAllDates(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 disabled:opacity-50" />
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
          </>
        )}
      </div>

      {/* Preview */}
      {count === 0 ? (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-10 text-center text-gray-500 dark:text-gray-400">
          {isSingle
            ? itemId
              ? "This item has no stage rows yet."
              : "Select an item above to see its full step-by-step timeline."
            : isReturns
            ? isReturnDetail
              ? "This item has no returns logged."
              : "No items were returned in this period. Try “All dates”, or change the person/category."
            : "No rows for these filters. Try “All dates”, or change the person/category."}
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
