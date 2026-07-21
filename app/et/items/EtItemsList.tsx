"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  RETURN_BADGE_CLASSES,
  returnBadgeLabel,
  STAGES,
  daysSince,
  effectiveWordCount,
  itemCategory,
  reminderInfo,
  stageBadgeClasses,
  typeLabel,
  type ItemCategory,
} from "@/lib/et";
import type { EtItemRow } from "@/lib/etData";

type CategoryTab = ItemCategory | "skipped" | "all";

function fmtDate(d: string | null): string {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function statusBadge(status: string): { className: string; label: string } {
  switch (status) {
    case "completed":
      return { className: "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400", label: "Completed" };
    case "pending_assignment":
      return { className: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400", label: "Unassigned" };
    case "in_progress":
    default:
      return { className: "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400", label: "In Progress" };
  }
}

function StageBadge({ row }: { row: EtItemRow }) {
  const { current } = row;
  if (row.inReturn) {
    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${RETURN_BADGE_CLASSES}`}>
        ↩ {returnBadgeLabel(row.returnStage)}
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${stageBadgeClasses(
        current.stage,
        current.completed
      )}`}
    >
      {current.stage ? `${current.stage} · ${current.label}` : current.label}
    </span>
  );
}

interface Props {
  items: EtItemRow[];
  initial?: { holder?: string; stage?: string; status?: string; category?: string; type?: string; q?: string; sort?: string };
}

const VALID_CATEGORY_TABS: CategoryTab[] = [...CATEGORY_ORDER, "skipped", "all"];

export default function EtItemsList({ items, initial }: Props) {
  const [category, setCategory] = useState<CategoryTab>(
    VALID_CATEGORY_TABS.includes(initial?.category as CategoryTab) ? (initial!.category as CategoryTab) : "weekly"
  );
  const [query, setQuery] = useState(initial?.q ?? "");
  const [status, setStatus] = useState<string>(initial?.status ?? "all");
  const [stage, setStage] = useState<string>(initial?.stage ?? "all");
  const [holder, setHolder] = useState<string>(initial?.holder ?? "all");
  const [type, setType] = useState<string>(initial?.type ?? "all");
  const [sortBy, setSortBy] = useState<string>(initial?.sort ?? "smart");

  // Encodes the current filtered view so an item opened from here can send the
  // user back to exactly this list (same tab, search, filters & sort).
  const fromParam = useMemo(() => {
    const p = new URLSearchParams();
    if (category !== "weekly") p.set("category", category);
    if (status !== "all") p.set("status", status);
    if (stage !== "all") p.set("stage", stage);
    if (holder !== "all") p.set("holder", holder);
    if (type !== "all") p.set("type", type);
    if (query.trim()) p.set("q", query.trim());
    if (sortBy !== "smart") p.set("sort", sortBy);
    const qs = p.toString();
    return encodeURIComponent(`/et/items${qs ? `?${qs}` : ""}`);
  }, [category, status, stage, holder, type, query, sortBy]);
  const itemHref = (id: string) => `/et/items/${id}?from=${fromParam}`;

  const holders = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => i.current.holder && set.add(i.current.holder));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [items]);

  // Distinct content types present in the currently selected category (e.g. wsb,
  // wbl, fsp under Weekly Docs), so the Type dropdown only offers relevant ones.
  const typeOptions = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => {
      if (category === "skipped") {
        if (!i.stopped) return;
      } else if (i.stopped) {
        return;
      } else if (category !== "all" && itemCategory(i.type) !== category) {
        return;
      }
      if (i.type) set.add(i.type.toLowerCase());
    });
    return [...set].sort((a, b) => typeLabel(a).localeCompare(typeLabel(b)));
  }, [items, category]);

  // If the chosen category no longer contains the selected type, fall back to All.
  useEffect(() => {
    if (type !== "all" && !typeOptions.includes(type)) setType("all");
  }, [type, typeOptions]);

  // Counts per category tab (non-stopped), plus the skipped count.
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: 0, skipped: 0, weekly: 0, magazine: 0, books: 0, other: 0 };
    items.forEach((i) => {
      if (i.stopped) {
        c.skipped++;
        return;
      }
      c.all++;
      c[itemCategory(i.type)]++;
    });
    return c;
  }, [items]);

  const hasFilter =
    query.trim() !== "" || status !== "all" || stage !== "all" || holder !== "all" || type !== "all";

  const reset = () => {
    setQuery("");
    setStatus("all");
    setStage("all");
    setHolder("all");
    setType("all");
  };

  const deliveryOf = (r: EtItemRow) => reminderInfo(r).delivery;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((i) => {
        if (category === "skipped") return i.stopped;
        if (i.stopped) return false;
        if (category === "all") return true;
        return itemCategory(i.type) === category;
      })
      .filter((i) => {
        if (status === "all") return true;
        if (status === "active") return i.derivedStatus !== "completed";
        return i.derivedStatus === status;
      })
      .filter((i) => stage === "all" || i.current.stage === stage)
      .filter((i) => holder === "all" || i.current.holder === holder)
      .filter((i) => type === "all" || (i.type || "").toLowerCase() === type)
      .filter(
        (i) =>
          q === "" ||
          i.title.toLowerCase().includes(q) ||
          (i.current.holder || "").toLowerCase().includes(q) ||
          (i.type || "").toLowerCase().includes(q)
      )
      .sort((a, b) => {
        switch (sortBy) {
          case "type": {
            const at = typeLabel(a.type);
            const bt = typeLabel(b.type);
            if (at !== bt) return at.localeCompare(bt);
            return a.title.localeCompare(b.title);
          }
          case "title":
            return a.title.localeCompare(b.title);
          case "words":
            return (
              (effectiveWordCount(b.type, b.word_count) || 0) -
              (effectiveWordCount(a.type, a.word_count) || 0)
            );
          case "stuck": {
            const ad = daysSince(a.current.since) ?? -1;
            const bd = daysSince(b.current.since) ?? -1;
            return bd - ad;
          }
          case "oldest": {
            const at = a.current.since ? new Date(a.current.since).getTime() : Infinity;
            const bt = b.current.since ? new Date(b.current.since).getTime() : Infinity;
            return at - bt;
          }
          case "smart":
          default: {
            // Incomplete first, by delivery date (earliest/overdue first); completed last.
            const aDone = a.derivedStatus === "completed" ? 1 : 0;
            const bDone = b.derivedStatus === "completed" ? 1 : 0;
            if (aDone !== bDone) return aDone - bDone;
            const ad = deliveryOf(a);
            const bd = deliveryOf(b);
            if (ad && bd && ad !== bd) return ad.localeCompare(bd);
            if (ad && !bd) return -1;
            if (!ad && bd) return 1;
            return a.title.localeCompare(b.title);
          }
        }
      });
  }, [items, category, query, status, stage, holder, type, sortBy]);

  const selectCls =
    "rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20";

  const tabs: { key: CategoryTab; label: string }[] = [
    ...CATEGORY_ORDER.map((c) => ({ key: c as CategoryTab, label: CATEGORY_LABELS[c] })),
    { key: "skipped", label: "Skipped" },
    { key: "all", label: "All" },
  ];

  return (
    <>
      {/* Category tabs */}
      <div className="mb-3 flex flex-wrap gap-2">
        {tabs.map((t) => {
          const isActive = category === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setCategory(t.key)}
              className={`btn-press inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                isActive
                  ? t.key === "skipped"
                    ? "bg-gray-700 text-white dark:bg-gray-600"
                    : "bg-emerald-600 text-white shadow-sm"
                  : "border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
              }`}
            >
              {t.label}
              <span className={`rounded-full px-1.5 text-xs ${isActive ? "bg-white/20" : "bg-gray-100 dark:bg-gray-700"}`}>
                {counts[t.key] ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="mb-4 sm:mb-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 sm:p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="relative lg:col-span-2">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title, person, type…"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 pl-9 pr-3 py-2 text-sm text-gray-900 dark:text-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          <select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)} className={selectCls}>
            <option value="active">Active (not completed)</option>
            <option value="in_progress">In Progress</option>
            <option value="pending_assignment">Unassigned</option>
            <option value="completed">Completed</option>
            <option value="all">All Statuses</option>
          </select>

          <select aria-label="Filter by current stage" value={stage} onChange={(e) => setStage(e.target.value)} className={selectCls}>
            <option value="all">All Stages</option>
            {STAGES.map((s) => (
              <option key={s.code} value={s.code}>{s.code} · {s.name}</option>
            ))}
          </select>

          <select aria-label="Filter by holder" value={holder} onChange={(e) => setHolder(e.target.value)} className={selectCls}>
            <option value="all">All Holders</option>
            {holders.map((h) => (
              <option key={h} value={h}>{h}</option>
            ))}
          </select>

          <select aria-label="Filter by type" value={type} onChange={(e) => setType(e.target.value)} className={selectCls}>
            <option value="all">All Types</option>
            {typeOptions.map((t) => (
              <option key={t} value={t}>{typeLabel(t)} ({t.toUpperCase()})</option>
            ))}
          </select>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <label htmlFor="et_sort" className="text-sm text-gray-500 dark:text-gray-400">Sort by:</label>
            <select id="et_sort" value={sortBy} onChange={(e) => setSortBy(e.target.value)} className={`${selectCls} py-1.5`}>
              <option value="smart">Incomplete first · delivery date</option>
              <option value="type">Type (wsb, wbl, fsp…)</option>
              <option value="oldest">At step since (oldest)</option>
              <option value="stuck">Most stuck</option>
              <option value="title">Title (A–Z)</option>
              <option value="words">Words (high→low)</option>
            </select>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500 dark:text-gray-400">Showing {filtered.length} of {items.length}</span>
            {hasFilter && (
              <button onClick={reset} className="text-sm text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300">
                Clear filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              {["Title", "Type", "Current Step", "Holder", "Progress", "At step since"].map((h) => (
                <th key={h} scope="col" className="px-3 lg:px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {filtered.map((row) => {
              const d = daysSince(row.current.since);
              return (
                <tr key={row.id} className="group hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-3 lg:px-4 py-3 max-w-[360px]">
                    <Link href={itemHref(row.id)} className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400" title={row.title}>
                      <span className="truncate">{row.title}</span>
                      {row.stopped && (
                        <span className="flex-shrink-0 rounded-full bg-gray-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-gray-600 dark:bg-gray-700 dark:text-gray-300">Stopped</span>
                      )}
                    </Link>
                  </td>
                  <td className="px-3 lg:px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">{typeLabel(row.type)}</td>
                  <td className="px-3 lg:px-4 py-3 whitespace-nowrap"><StageBadge row={row} /></td>
                  <td className="px-3 lg:px-4 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">{row.current.holder || "—"}</td>
                  <td className="px-3 lg:px-4 py-3 whitespace-nowrap">
                    <span className="text-sm tabular-nums text-gray-600 dark:text-gray-400">{row.current.doneCount}/{row.current.totalCount}</span>
                  </td>
                  <td className="px-3 lg:px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                    {fmtDate(row.current.since)}
                    {d !== null && (
                      <span className={`ml-2 rounded-full px-1.5 py-0.5 text-[11px] font-medium ${d > 30 ? "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"}`}>{d}d</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden grid gap-3">
        {filtered.map((row) => {
          const sb = row.inReturn ? { className: RETURN_BADGE_CLASSES, label: returnBadgeLabel(row.returnStage) } : statusBadge(row.derivedStatus);
          return (
            <Link
              key={row.id}
              href={itemHref(row.id)}
              className="gloss card-hover block rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 shadow-sm hover:border-emerald-300 dark:hover:border-emerald-700"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="flex-1 text-sm font-semibold text-gray-900 dark:text-white line-clamp-2">{row.title}</h3>
                <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${row.stopped ? "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300" : sb.className}`}>{row.stopped ? "Stopped" : sb.label}</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <StageBadge row={row} />
                <span className="text-xs text-gray-500 dark:text-gray-400">{typeLabel(row.type)}</span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Holder</p>
                  <p className="font-medium text-gray-900 dark:text-white truncate">
                    {row.current.holder || "—"}
                    {daysSince(row.current.since) != null && (
                      <span className="text-gray-500 dark:text-gray-400"> · {daysSince(row.current.since)}d</span>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Progress · since</p>
                  <p className="font-medium text-gray-900 dark:text-white">{row.current.doneCount}/{row.current.totalCount} · {fmtDate(row.current.since)}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="flex min-h-[260px] items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-12 text-center">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">No items match these filters</h3>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Try clearing the filters to see everything.</p>
          </div>
        </div>
      )}
    </>
  );
}
