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

export default function ReportBuilder({ activity, items, people, defaultFrom, defaultTo }: Props) {
  const [reportType, setReportType] = useState<ReportType>("activity");
  const [person, setPerson] = useState("all");
  const [category, setCategory] = useState("all");
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [allDates, setAllDates] = useState(false);
  const [busy, setBusy] = useState<"" | "xlsx" | "pdf">("");

  const categories = useMemo(() => {
    const set = new Set<string>();
    activity.forEach((a) => set.add(a.category));
    items.forEach((i) => set.add(i.category));
    return [...set].sort();
  }, [activity, items]);

  // Names that actually appear (workforce + any holder/person on record).
  const personOptions = useMemo(() => {
    const set = new Set<string>(people);
    activity.forEach((a) => a.person && set.add(a.person));
    items.forEach((i) => i.holder && set.add(i.holder));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [people, activity, items]);

  const activityRows = useMemo(() => {
    return activity.filter((a) => {
      if (person !== "all" && a.person !== person) return false;
      if (category !== "all" && a.category !== category) return false;
      if (!allDates && !(inRange(a.received, from, to) || inRange(a.sent, from, to))) return false;
      return true;
    });
  }, [activity, person, category, from, to, allDates]);

  const itemRows = useMemo(() => {
    return items.filter((i) => {
      if (person !== "all" && i.holder !== person) return false;
      if (category !== "all" && i.category !== category) return false;
      if (!allDates && !inRange(i.received, from, to)) return false;
      return true;
    });
  }, [items, person, category, from, to, allDates]);

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

  const baseName = () => {
    const who = person === "all" ? "all" : person.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    const range = allDates ? "all-dates" : `${from}_${to}`;
    return `et-${reportType}-${who}-${range}`;
  };

  const title = () => {
    const scope = person === "all" ? "All people" : person;
    const range = allDates ? "all dates" : `${from} → ${to}`;
    return `${isActivity ? "Activity report" : "Items export"} — ${scope} (${range})`;
  };

  const downloadExcel = async () => {
    setBusy("xlsx");
    try {
      const XLSX = await import("xlsx");
      const ws = XLSX.utils.aoa_to_sheet([header, ...body]);
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
      doc.setFontSize?.(12);
      doc.text(title(), 14, 14);
      autoTable(doc, {
        head: [header],
        body,
        startY: 20,
        styles: { fontSize: 7, cellPadding: 1.5, overflow: "linebreak" },
        headStyles: { fillColor: [16, 185, 129] },
        margin: { left: 10, right: 10 },
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
            onClick={() => setReportType(t)}
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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
          <label className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <input type="checkbox" checked={allDates} onChange={(e) => setAllDates(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500" />
            All dates (ignore range)
          </label>
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
