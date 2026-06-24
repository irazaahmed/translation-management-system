"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { usePermissions } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { saveEtItemCommentAction } from "@/app/actions/etActions";
import { stageBadgeClasses, type StageCode } from "@/lib/et";

export interface BookRow {
  id: string;
  title: string;
  word_count: number | null;
  delivery: string | null;
  stage: StageCode | null;
  stageLabel: string;
  completed: boolean;
  holder: string | null;
  doneCount: number;
  totalCount: number;
  comment: string;
}

function fmt(d: string | null): string {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function BookCard({ book, canWrite }: { book: BookRow; canWrite: boolean }) {
  const toast = useToast();
  const [comment, setComment] = useState(book.comment);
  const [isPending, startTransition] = useTransition();
  const dirty = comment !== book.comment;

  const save = () => {
    startTransition(async () => {
      const res = await saveEtItemCommentAction(book.id, comment);
      if (res.error) toast({ type: "error", message: res.error });
      else toast({ type: "success", message: "Comment saved." });
    });
  };

  return (
    <div className="gloss rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <Link href={`/et/items/${book.id}?from=${encodeURIComponent("/et/books")}`} className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white hover:text-emerald-600 dark:hover:text-emerald-400 break-words" title={book.title}>
            {book.title}
          </h3>
        </Link>
        <span className={`flex-shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${stageBadgeClasses(book.stage, book.completed)}`}>
          {book.stage ? `${book.stage} · ${book.stageLabel}` : book.stageLabel}
        </span>
      </div>

      <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <div>
          <p className="text-gray-500 dark:text-gray-400">Holder</p>
          <p className="font-medium text-gray-900 dark:text-white truncate">{book.holder || "—"}</p>
        </div>
        <div>
          <p className="text-gray-500 dark:text-gray-400">Progress</p>
          <p className="font-medium text-gray-900 dark:text-white tabular-nums">{book.doneCount}/{book.totalCount}</p>
        </div>
        <div>
          <p className="text-gray-500 dark:text-gray-400">Delivery</p>
          <p className="font-medium text-gray-900 dark:text-white">{fmt(book.delivery)}</p>
        </div>
        <div>
          <p className="text-gray-500 dark:text-gray-400">Words</p>
          <p className="font-medium text-gray-900 dark:text-white tabular-nums">{book.word_count != null ? book.word_count.toLocaleString() : "—"}</p>
        </div>
      </div>

      {/* Comment */}
      <div className="mt-3">
        <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Comment / note</label>
        {canWrite ? (
          <>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              placeholder="e.g. give this book to ___ only after ___ is done"
              className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <div className="mt-1 flex items-center justify-end gap-2">
              {dirty && <span className="text-xs text-amber-600 dark:text-amber-400">Unsaved</span>}
              <button
                type="button"
                onClick={save}
                disabled={isPending || !dirty}
                className="btn-press inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {isPending ? "Saving…" : "Save comment"}
              </button>
            </div>
          </>
        ) : (
          <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">{book.comment || "—"}</p>
        )}
      </div>
    </div>
  );
}

export default function BooksManager({ books }: { books: BookRow[] }) {
  const { canWrite } = usePermissions();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return books;
    return books.filter(
      (b) => b.title.toLowerCase().includes(q) || (b.holder || "").toLowerCase().includes(q) || b.comment.toLowerCase().includes(q)
    );
  }, [books, query]);

  return (
    <>
      <div className="mb-4 relative max-w-md">
        <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search books, holder, comment…"
          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 pl-9 pr-3 py-2 text-sm text-gray-900 dark:text-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-10 text-center text-gray-500 dark:text-gray-400">
          {books.length === 0 ? "No books yet. Add an item with type “Books”." : "No books match your search."}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((book) => (
            <BookCard key={book.id} book={book} canWrite={canWrite} />
          ))}
        </div>
      )}
    </>
  );
}
