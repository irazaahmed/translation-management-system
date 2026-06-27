"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Avatar from "@/components/Avatar";
import { stageBadgeClasses, urgencyClasses, STEP_ALERT_DAYS, type StageCode, type ReminderUrgency } from "@/lib/et";

export interface WorkloadItem {
  id: string;
  title: string;
  type: string;
  stageCode: StageCode | null;
  stageName: string;
  daysHeld: number | null;
  delivery: string | null;
  daysLeft: number | null;
  urgency: ReminderUrgency | null;
  progress: string;
}

export interface WorkloadGroup {
  holder: string;
  items: WorkloadItem[];
}

interface Props {
  groups: WorkloadGroup[];
  unassigned: WorkloadItem[];
  totalItems: number;
}

const FROM = encodeURIComponent("/et/workload");

function heldBadge(days: number | null) {
  if (days == null) return null;
  const stuck = days > STEP_ALERT_DAYS;
  return (
    <span
      className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${
        stuck
          ? "bg-red-100 text-red-700 ring-red-600/20 dark:bg-red-900/20 dark:text-red-400"
          : "bg-gray-100 text-gray-600 ring-gray-500/20 dark:bg-gray-800 dark:text-gray-400"
      }`}
      title="Days at the current step"
    >
      {days === 0 ? "today" : `${days}d held`}
    </span>
  );
}

function ItemRow({ item }: { item: WorkloadItem }) {
  return (
    <li className="py-2">
      <Link
        href={`/et/items/${item.id}?from=${FROM}`}
        className="group flex flex-wrap items-center gap-x-2 gap-y-1"
      >
        {item.stageCode && (
          <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${stageBadgeClasses(item.stageCode)}`}>
            {item.stageCode}
          </span>
        )}
        <span className="min-w-0 flex-1 truncate text-sm text-gray-800 dark:text-gray-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-400">
          {item.title}
        </span>
        <span className="flex-shrink-0 text-[11px] text-gray-400 dark:text-gray-500">{item.type} · {item.progress}</span>
        {heldBadge(item.daysHeld)}
        {item.daysLeft != null && (
          <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${urgencyClasses(item.urgency)}`}>
            {item.daysLeft < 0 ? `${Math.abs(item.daysLeft)}d overdue` : item.daysLeft === 0 ? "due today" : `${item.daysLeft}d left`}
          </span>
        )}
      </Link>
    </li>
  );
}

export default function WorkloadBoard({ groups, unassigned, totalItems }: Props) {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const q = query.trim().toLowerCase();

  // Filter by person name OR item title; a person stays if their name matches
  // (all items shown) or any of their items match (only matches shown).
  const filtered = useMemo(() => {
    if (!q) return groups;
    return groups
      .map((g) => {
        if (g.holder.toLowerCase().includes(q)) return g;
        const items = g.items.filter((i) => i.title.toLowerCase().includes(q) || i.type.toLowerCase().includes(q));
        return items.length ? { ...g, items } : null;
      })
      .filter((g): g is WorkloadGroup => g !== null);
  }, [groups, q]);

  const filteredUnassigned = useMemo(() => {
    if (!q) return unassigned;
    return unassigned.filter((i) => i.title.toLowerCase().includes(q) || i.type.toLowerCase().includes(q));
  }, [unassigned, q]);

  const heldOver = useMemo(
    () => groups.reduce((n, g) => n + g.items.filter((i) => (i.daysHeld ?? 0) > STEP_ALERT_DAYS).length, 0),
    [groups]
  );

  const toggle = (holder: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(holder) ? next.delete(holder) : next.add(holder);
      return next;
    });

  const allCollapsed = collapsed.size >= groups.length && groups.length > 0;
  const toggleAll = () =>
    setCollapsed(allCollapsed ? new Set() : new Set(groups.map((g) => g.holder)));

  return (
    <div>
      {/* Summary + controls */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 font-medium text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">{groups.length} people</span>
          <span className="rounded-full bg-blue-50 px-2.5 py-0.5 font-medium text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">{totalItems} active items</span>
          {heldOver > 0 && (
            <span className="rounded-full bg-red-100 px-2.5 py-0.5 font-medium text-red-700 dark:bg-red-900/20 dark:text-red-400">{heldOver} held &gt; {STEP_ALERT_DAYS}d</span>
          )}
          {unassigned.length > 0 && (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 font-medium text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">{unassigned.length} unassigned</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search person or item…"
            className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
          {groups.length > 0 && (
            <button
              type="button"
              onClick={toggleAll}
              className="btn-press whitespace-nowrap rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              {allCollapsed ? "Expand all" : "Collapse all"}
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 && filteredUnassigned.length === 0 ? (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-10 text-center text-gray-500 dark:text-gray-400">
          {q ? "No people or items match your search." : "No active work right now. 🎉"}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filtered.map((g) => {
            const isCollapsed = collapsed.has(g.holder);
            const groupHeld = g.items.filter((i) => (i.daysHeld ?? 0) > STEP_ALERT_DAYS).length;
            return (
              <div key={g.holder} className="gloss rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 shadow-sm">
                <button type="button" onClick={() => toggle(g.holder)} className="flex w-full items-center gap-3 text-left">
                  <Avatar name={g.holder} />
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-semibold text-gray-900 dark:text-white">{g.holder}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {g.items.length} item{g.items.length === 1 ? "" : "s"}
                      {groupHeld > 0 && <span className="text-red-600 dark:text-red-400"> · {groupHeld} stuck</span>}
                    </p>
                  </div>
                  <span className="flex-shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">{g.items.length}</span>
                  <svg className={`h-4 w-4 flex-shrink-0 text-gray-400 transition-transform ${isCollapsed ? "" : "rotate-180"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {!isCollapsed && (
                  <ul className="mt-2 divide-y divide-gray-100 dark:divide-gray-800 border-t border-gray-100 dark:border-gray-800">
                    {g.items.map((item) => (
                      <ItemRow key={item.id} item={item} />
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Unassigned — items in flight with nobody currently holding them. */}
      {filteredUnassigned.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-300 dark:border-amber-700/60 bg-amber-50/50 dark:bg-amber-900/10 p-4">
          <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300">
            Unassigned · {filteredUnassigned.length}
          </h3>
          <p className="text-xs text-amber-700/80 dark:text-amber-400/80">In-progress items with no one currently assigned — these need a holder.</p>
          <ul className="mt-2 divide-y divide-amber-200/60 dark:divide-amber-800/40 border-t border-amber-200/60 dark:border-amber-800/40">
            {filteredUnassigned.map((item) => (
              <ItemRow key={item.id} item={item} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
