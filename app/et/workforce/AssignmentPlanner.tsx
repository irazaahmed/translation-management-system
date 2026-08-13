"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/components/Toast";
import type { EtAssignment } from "@/lib/et";
import {
  addEtAssignmentAction,
  updateEtAssignmentAction,
  deleteEtAssignmentAction,
  reorderEtAssignmentsAction,
} from "@/app/actions/etActions";

export interface PlannerItem {
  id: string;
  title: string;
  type: string;
}

interface Props {
  personId: string;
  assignments: EtAssignment[];
  items: PlannerItem[];
  canWrite: boolean;
}

const FROM = encodeURIComponent("/et/workforce");

export default function AssignmentPlanner({ personId, assignments, items, canWrite }: Props) {
  const toast = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Local mirror so reorder / done / delete feel instant; re-sync if the
  // server data changes underneath us (e.g. after an add + refresh).
  const [list, setList] = useState<EtAssignment[]>(assignments);
  useEffect(() => setList(assignments), [assignments]);

  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<PlannerItem | null>(null);
  const [note, setNote] = useState("");

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? items.filter((i) => i.title.toLowerCase().includes(q) || i.type.toLowerCase().includes(q))
      : items;
    return base.slice(0, 30);
  }, [items, query]);

  const resetForm = () => {
    setAdding(false);
    setQuery("");
    setPicked(null);
    setNote("");
    setOpen(false);
  };

  const add = () => {
    if (!picked) {
      toast({ type: "error", message: "Pick an item first." });
      return;
    }
    startTransition(async () => {
      const res = await addEtAssignmentAction({ person_id: personId, item_id: picked.id, note: note.trim() || null });
      if (res.error) toast({ type: "error", message: res.error });
      else {
        toast({ type: "success", message: "Added to plan." });
        resetForm();
        router.refresh();
      }
    });
  };

  const toggleDone = (a: EtAssignment) => {
    setList((prev) => prev.map((x) => (x.id === a.id ? { ...x, done: !x.done } : x)));
    startTransition(async () => {
      const res = await updateEtAssignmentAction(a.id, { done: !a.done });
      if (res.error) {
        toast({ type: "error", message: res.error });
        router.refresh();
      }
    });
  };

  const remove = (a: EtAssignment) => {
    setList((prev) => prev.filter((x) => x.id !== a.id));
    startTransition(async () => {
      const res = await deleteEtAssignmentAction(a.id);
      if (res.error) {
        toast({ type: "error", message: res.error });
        router.refresh();
      }
    });
  };

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= list.length) return;
    const next = [...list];
    [next[index], next[target]] = [next[target], next[index]];
    setList(next);
    startTransition(async () => {
      const res = await reorderEtAssignmentsAction(personId, next.map((x) => x.id));
      if (res.error) {
        toast({ type: "error", message: res.error });
        router.refresh();
      }
    });
  };

  const hasPlan = list.length > 0;

  return (
    <div className="mt-3 border-t border-gray-100 dark:border-gray-800 pt-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Planned work</h4>
        {canWrite && !adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
          >
            + Add
          </button>
        )}
      </div>

      {!hasPlan && !adding && (
        <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">No planned items yet.</p>
      )}

      {hasPlan && (
        <ol className="mt-2 space-y-1.5">
          {list.map((a, i) => (
            <li
              key={a.id}
              className={`flex items-start gap-2 rounded-lg px-2 py-1.5 ${
                a.done ? "bg-gray-50 dark:bg-gray-800/40" : "bg-emerald-50/50 dark:bg-emerald-900/10"
              }`}
            >
              <span className="mt-0.5 flex-shrink-0 text-[11px] font-semibold text-gray-400 dark:text-gray-500">{i + 1}.</span>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/et/items/${a.item_id}?from=${FROM}`}
                  className={`block break-words text-sm ${a.done ? "text-gray-400 line-through dark:text-gray-500" : "text-gray-800 hover:text-emerald-700 dark:text-gray-100 dark:hover:text-emerald-400"}`}
                  title={a.item_title}
                >
                  {a.item_title}
                </Link>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  {(a.item_type || "—").toUpperCase()}
                  {a.note ? ` · ${a.note}` : ""}
                </p>
              </div>
              {canWrite && (
                <div className="flex flex-shrink-0 items-center gap-0.5">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0 || isPending} title="Move up"
                    className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 dark:hover:bg-gray-700">▲</button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === list.length - 1 || isPending} title="Move down"
                    className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 dark:hover:bg-gray-700">▼</button>
                  <button type="button" onClick={() => toggleDone(a)} disabled={isPending} title={a.done ? "Mark not done" : "Mark done"}
                    className={`rounded p-1 ${a.done ? "text-emerald-600" : "text-gray-400 hover:text-emerald-600"} hover:bg-gray-100 dark:hover:bg-gray-700`}>✓</button>
                  <button type="button" onClick={() => remove(a)} disabled={isPending} title="Remove"
                    className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20">✕</button>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}

      {canWrite && adding && (
        <div className="mt-2 rounded-lg border border-emerald-200 dark:border-emerald-800/60 bg-white dark:bg-gray-900 p-2.5">
          <div className="relative">
            <input
              type="text"
              value={picked ? `${picked.title} · ${picked.type}` : query}
              placeholder="Search an item to assign…"
              onChange={(e) => { setQuery(e.target.value); setOpen(true); if (picked) setPicked(null); }}
              onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-sm text-gray-900 dark:text-white focus:border-emerald-500 focus:outline-none"
            />
            {open && !picked && (
              <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-1 shadow-lg">
                {matches.length === 0 ? (
                  <li className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">No items match.</li>
                ) : (
                  matches.map((it) => (
                    <li key={it.id}>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => { setPicked(it); setOpen(false); }}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                      >
                        <span className="min-w-0 flex-1 truncate text-gray-800 dark:text-gray-100">{it.title}</span>
                        <span className="flex-shrink-0 text-[11px] text-gray-400">{it.type}</span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>
          <input
            type="text"
            value={note}
            placeholder="Work / note (optional, e.g. Translation)"
            onChange={(e) => setNote(e.target.value)}
            className="mt-2 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-sm text-gray-900 dark:text-white focus:border-emerald-500 focus:outline-none"
          />
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" onClick={resetForm} className="rounded-md border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">Cancel</button>
            <button type="button" onClick={add} disabled={isPending || !picked} className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50">{isPending ? "Adding…" : "Add to plan"}</button>
          </div>
        </div>
      )}
    </div>
  );
}
