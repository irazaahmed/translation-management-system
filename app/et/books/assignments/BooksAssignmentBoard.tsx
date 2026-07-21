"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Avatar from "@/components/Avatar";
import { usePermissions } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { addEtAssignmentAction, deleteEtAssignmentAction } from "@/app/actions/etActions";

export interface BoardBook {
  id: string;
  title: string;
  /** Person currently holding it (has a stage sent but not received back), if any. */
  holder: string | null;
  /** e.g. "ED · Editing", "Return", "Awaiting final email" — whatever the card badge shows. */
  stageLabel: string;
  /** True when nobody is currently working on it (derivedStatus === "pending_assignment"). */
  unassigned: boolean;
}

export interface BoardPerson {
  id: string;
  name: string;
}

export interface BoardAssignment {
  id: string;
  personId: string;
  itemId: string;
  itemTitle: string;
}

const FROM = encodeURIComponent("/et/books/assignments");

/** Inline "pick a next book" combobox for one person's row. */
function NextBookPicker({
  personId,
  options,
}: {
  personId: string;
  options: BoardBook[];
}) {
  const toast = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q ? options.filter((b) => b.title.toLowerCase().includes(q)) : options;
    return base.slice(0, 30);
  }, [options, query]);

  const pick = (book: BoardBook) => {
    setOpen(false);
    setQuery("");
    startTransition(async () => {
      const res = await addEtAssignmentAction({ person_id: personId, item_id: book.id, note: null });
      if (res.error) toast({ type: "error", message: res.error });
      else router.refresh();
    });
  };

  return (
    <div className="relative mt-1.5">
      <input
        type="text"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        disabled={isPending}
        placeholder="+ Pick next book…"
        className="w-full rounded-md border border-dashed border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-xs text-gray-700 dark:text-gray-300 placeholder:text-gray-400 focus:border-emerald-500 focus:border-solid focus:outline-none disabled:opacity-50"
      />
      {open && (
        <ul className="absolute z-20 mt-1 max-h-56 w-full min-w-[220px] overflow-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-1 shadow-lg">
          {matches.length === 0 ? (
            <li className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">No unassigned books match.</li>
          ) : (
            matches.map((b) => (
              <li key={b.id}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(b)}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                >
                  <span className="min-w-0 flex-1 truncate text-gray-800 dark:text-gray-100">{b.title}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

function NextBookChip({ assignment }: { assignment: BoardAssignment }) {
  const toast = useToast();
  const router = useRouter();
  const { canWrite } = usePermissions();
  const [isPending, startTransition] = useTransition();

  const remove = () => {
    startTransition(async () => {
      const res = await deleteEtAssignmentAction(assignment.id);
      if (res.error) toast({ type: "error", message: res.error });
      else router.refresh();
    });
  };

  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-900/20 pl-2.5 pr-1.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
      <Link href={`/et/items/${assignment.itemId}?from=${FROM}`} className="truncate hover:underline" title={assignment.itemTitle}>
        {assignment.itemTitle}
      </Link>
      {canWrite && (
        <button
          type="button"
          onClick={remove}
          disabled={isPending}
          title="Remove"
          className="flex-shrink-0 rounded-full p-0.5 text-emerald-500 hover:bg-emerald-100 hover:text-emerald-700 dark:hover:bg-emerald-900/40 disabled:opacity-50"
        >
          ✕
        </button>
      )}
    </span>
  );
}

export default function BooksAssignmentBoard({
  books,
  people,
  assignments,
}: {
  books: BoardBook[];
  people: BoardPerson[];
  assignments: BoardAssignment[];
}) {
  const { canWrite } = usePermissions();

  const unassignedBooks = useMemo(() => books.filter((b) => b.unassigned), [books]);
  // A book already queued as someone's next pick shouldn't be offered to a
  // second person too — avoids double-booking the same title.
  const queuedItemIds = useMemo(() => new Set(assignments.map((a) => a.itemId)), [assignments]);
  const pickableBooks = useMemo(
    () => unassignedBooks.filter((b) => !queuedItemIds.has(b.id)),
    [unassignedBooks, queuedItemIds]
  );

  const assignmentsByPerson = useMemo(() => {
    const m = new Map<string, BoardAssignment[]>();
    for (const a of assignments) {
      if (!m.has(a.personId)) m.set(a.personId, []);
      m.get(a.personId)!.push(a);
    }
    return m;
  }, [assignments]);

  const booksByHolder = useMemo(() => {
    const m = new Map<string, BoardBook[]>();
    for (const b of books) {
      if (!b.holder) continue;
      if (!m.has(b.holder)) m.set(b.holder, []);
      m.get(b.holder)!.push(b);
    }
    return m;
  }, [books]);

  // Which unassigned book (if any) is already queued for someone — used to
  // auto-mention the pick in the "Unassigned books" list below.
  const queuedFor = useMemo(() => {
    const nameById = new Map(people.map((p) => [p.id, p.name]));
    const m = new Map<string, string>();
    for (const a of assignments) m.set(a.itemId, nameById.get(a.personId) ?? "—");
    return m;
  }, [assignments, people]);

  return (
    <div>
      {/* Roster table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              {["Person", "Currently has", "Next book"].map((h) => (
                <th key={h} scope="col" className="px-3 lg:px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {people.map((p) => {
              const current = booksByHolder.get(p.name) ?? [];
              const next = assignmentsByPerson.get(p.id) ?? [];
              return (
                <tr key={p.id} className="align-top">
                  <td className="px-3 lg:px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Avatar name={p.name} />
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{p.name}</span>
                    </div>
                  </td>
                  <td className="px-3 lg:px-4 py-3 min-w-[220px]">
                    {current.length === 0 ? (
                      <span className="text-sm text-gray-400 dark:text-gray-500">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {current.map((b) => (
                          <Link
                            key={b.id}
                            href={`/et/items/${b.id}?from=${FROM}`}
                            className="max-w-[220px] truncate rounded-full bg-blue-50 dark:bg-blue-900/20 px-2.5 py-1 text-xs font-medium text-blue-700 dark:text-blue-400 hover:underline"
                            title={`${b.title} — ${b.stageLabel}`}
                          >
                            {b.title}
                          </Link>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-3 lg:px-4 py-3 min-w-[240px]">
                    {next.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {next.map((a) => (
                          <NextBookChip key={a.id} assignment={a} />
                        ))}
                      </div>
                    )}
                    {canWrite && <NextBookPicker personId={p.id} options={pickableBooks} />}
                    {!canWrite && next.length === 0 && <span className="text-sm text-gray-400 dark:text-gray-500">—</span>}
                  </td>
                </tr>
              );
            })}
            {people.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                  No active workforce members. Add people on the Workforce page.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Unassigned books — for reference while deciding who gets what next */}
      <div className="mt-6">
        <h2 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
          Unassigned books <span className="text-gray-400 dark:text-gray-500">({unassignedBooks.length})</span>
        </h2>
        {unassignedBooks.length === 0 ? (
          <p className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 text-sm text-gray-500 dark:text-gray-400">
            Nothing waiting — every book is currently held by someone.
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {unassignedBooks.map((b) => {
              const queued = queuedFor.get(b.id);
              return (
                <li
                  key={b.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2"
                >
                  <Link href={`/et/items/${b.id}?from=${FROM}`} className="min-w-0 flex-1 truncate text-sm text-gray-800 dark:text-gray-100 hover:text-emerald-600 dark:hover:text-emerald-400" title={b.title}>
                    {b.title}
                  </Link>
                  {queued ? (
                    <span className="flex-shrink-0 rounded-full bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                      → Queued for {queued}
                    </span>
                  ) : (
                    <span className="flex-shrink-0 rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-[11px] font-medium text-gray-500 dark:text-gray-400">
                      Not queued
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
