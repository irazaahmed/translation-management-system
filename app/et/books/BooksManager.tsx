"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePermissions } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { addEtItemNoteAction, deleteEtItemNoteAction } from "@/app/actions/etActions";
import { BKS_STAGES, RETURN_BADGE_CLASSES, returnBadgeLabel, returnBadgeDetail, stageBadgeClasses, stageChipLabel, type StageCode } from "@/lib/et";

export interface BookRow {
  id: string;
  title: string;
  word_count: number | null;
  delivery: string | null;
  stage: StageCode | null;
  stageLabel: string;
  activeStageCodes: StageCode[];
  completed: boolean;
  inReturn: boolean;
  returnStage: StageCode | null;
  returnPerson: string | null;
  returnSentDate: string | null;
  holder: string | null;
  doneCount: number;
  totalCount: number;
  /** Latest comment (et_items.further_process). */
  comment: string;
  /** Full comment / note history, newest first. */
  notes: BookNote[];
}

export interface BookNote {
  id: string;
  body: string;
  /** YYYY-MM-DD */
  date: string;
  by: string | null;
}

/** Only the latest note shows until "Load more" is clicked. */
const NOTES_PREVIEW = 1;

/** Today as YYYY-MM-DD in the viewer's own time zone. */
function todayLocal(): string {
  return new Date().toLocaleDateString("en-CA");
}

function fmt(d: string | null): string {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function NoteEntry({ note, bookId, canWrite }: { note: BookNote; bookId: string; canWrite: boolean }) {
  const toast = useToast();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  const remove = () => {
    startTransition(async () => {
      const res = await deleteEtItemNoteAction(bookId, note.id);
      if (res.error) toast({ type: "error", message: res.error });
      else {
        toast({ type: "success", message: "Note deleted." });
        router.refresh();
      }
      setConfirming(false);
    });
  };

  return (
    <li className="border-l-2 border-emerald-200 dark:border-emerald-800 pl-3">
      <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-gray-500 dark:text-gray-400">
        <span className="font-semibold text-gray-700 dark:text-gray-300">{fmt(note.date)}</span>
        {note.by && <span>· {note.by}</span>}
        {canWrite && (
          <span className="ml-auto">
            {confirming ? (
              <>
                <span className="mr-1">Delete this note?</span>
                <button type="button" onClick={remove} disabled={isPending} className="font-medium text-red-600 hover:underline disabled:opacity-50">
                  {isPending ? "Deleting…" : "Yes"}
                </button>
                <span className="mx-1">/</span>
                <button type="button" onClick={() => setConfirming(false)} className="font-medium hover:underline">
                  No
                </button>
              </>
            ) : (
              <button type="button" onClick={() => setConfirming(true)} className="hover:text-red-600 hover:underline">
                Delete
              </button>
            )}
          </span>
        )}
      </div>
      <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-gray-800 dark:text-gray-200">{note.body}</p>
    </li>
  );
}

function BookCard({ book, canWrite }: { book: BookRow; canWrite: boolean }) {
  const toast = useToast();
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [date, setDate] = useState(todayLocal);
  const [showAll, setShowAll] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Before migration 014 there is no history yet: show the single saved comment.
  const notes: BookNote[] =
    book.notes.length > 0 || !book.comment ? book.notes : [{ id: "legacy", body: book.comment, date: "", by: null }];
  const visible = showAll ? notes : notes.slice(0, NOTES_PREVIEW);

  const add = () => {
    startTransition(async () => {
      const res = await addEtItemNoteAction(book.id, draft, date || null);
      if (res.error) toast({ type: "error", message: res.error });
      else {
        toast({ type: "success", message: "Note added." });
        setDraft("");
        setDate(todayLocal());
        router.refresh();
      }
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
        <span className={`flex-shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${book.inReturn ? RETURN_BADGE_CLASSES : stageBadgeClasses(book.stage, book.completed)}`}>
          {book.inReturn
            ? `↩ ${returnBadgeLabel(book.returnStage)}${returnBadgeDetail(book.returnPerson, book.returnSentDate)}`
            : stageChipLabel(book.activeStageCodes, book.stage, book.stageLabel)}
        </span>
      </div>

      <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <div>
          <p className="text-gray-500 dark:text-gray-400">Holder</p>
          <p className="font-medium text-gray-900 dark:text-white break-words">{book.holder || "—"}</p>
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

      {/* Comments / notes: every note is kept with its date; new ones go on top. */}
      <div className="mt-3">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
          Comments / notes{notes.length > 0 && <span className="ml-1 text-gray-400">({notes.length})</span>}
        </p>

        {canWrite && (
          <div className="mt-1">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={2}
              placeholder="Add a new comment… (earlier comments stay below)"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <div className="mt-1 flex flex-wrap items-center justify-end gap-2">
              <label className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                Date
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-xs text-gray-900 dark:text-white focus:border-emerald-500 focus:outline-none"
                />
              </label>
              <button
                type="button"
                onClick={add}
                disabled={isPending || !draft.trim()}
                className="btn-press inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {isPending ? "Saving…" : "Add note"}
              </button>
            </div>
          </div>
        )}

        {notes.length === 0
          ? !canWrite && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">—</p>
          : (
            <ul className={`mt-2 space-y-2 ${showAll ? "max-h-64 overflow-y-auto pr-1" : ""}`}>
              {visible.map((n) =>
                n.id === "legacy" ? (
                  <li key={n.id} className="border-l-2 border-emerald-200 dark:border-emerald-800 pl-3">
                    <p className="whitespace-pre-wrap break-words text-sm text-gray-800 dark:text-gray-200">{n.body}</p>
                  </li>
                ) : (
                  <NoteEntry key={n.id} note={n} bookId={book.id} canWrite={canWrite} />
                )
              )}
            </ul>
          )}
        {notes.length > NOTES_PREVIEW && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="mt-2 text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400"
          >
            {showAll
              ? "Show less"
              : `Load more (${notes.length - NOTES_PREVIEW} older note${notes.length - NOTES_PREVIEW === 1 ? "" : "s"})`}
          </button>
        )}
      </div>
    </div>
  );
}

const SELECT_CLS =
  "rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20";

const SORTS = [
  { value: "order", label: "Default order" },
  { value: "delivery-asc", label: "Delivery (soonest)" },
  { value: "words-desc", label: "Words (high→low)" },
  { value: "held-desc", label: "Progress (least done)" },
  { value: "title", label: "Title (A–Z)" },
];

/** Books pipeline order (TR…RTP) for sorting the stage filter. */
const BKS_ORDER = BKS_STAGES.map((s) => s.code);

export default function BooksManager({ books }: { books: BookRow[] }) {
  const { canWrite } = usePermissions();
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState("all");
  const [holder, setHolder] = useState("all");
  const [sortBy, setSortBy] = useState("order");

  // Stage filter options — only stages actually present, in pipeline order.
  const stageOptions = useMemo(() => {
    const present = new Set<string>();
    books.forEach((b) => {
      if (b.activeStageCodes.length) b.activeStageCodes.forEach((c) => present.add(c));
      else if (b.stage) present.add(b.stage);
    });
    return [...present]
      .sort((a, b) => BKS_ORDER.indexOf(a as StageCode) - BKS_ORDER.indexOf(b as StageCode))
      .map((code) => ({ code, label: BKS_STAGES.find((s) => s.code === code)?.name ?? code }));
  }, [books]);

  // Holder filter options — distinct current holders, A–Z.
  const holderOptions = useMemo(() => {
    const set = new Set<string>();
    books.forEach((b) => { if (b.holder) set.add(b.holder); });
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [books]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = books.filter((b) => {
      if (
        q &&
        !(
          b.title.toLowerCase().includes(q) ||
          (b.holder || "").toLowerCase().includes(q) ||
          b.comment.toLowerCase().includes(q) ||
          b.notes.some((n) => n.body.toLowerCase().includes(q))
        )
      )
        return false;
      if (stage !== "all") {
        // Match any stage the book is actively at (an item can be at two at once),
        // falling back to its current stage when nothing is actively held.
        const codes = b.activeStageCodes.length ? b.activeStageCodes : b.stage ? [b.stage] : [];
        if (!codes.includes(stage as StageCode)) return false;
      }
      if (holder !== "all" && (b.holder || "") !== holder) return false;
      return true;
    });
    if (sortBy === "order") return rows; // already in the team's manual order
    const sorted = [...rows];
    switch (sortBy) {
      case "delivery-asc":
        sorted.sort((a, b) => (a.delivery || "9999").localeCompare(b.delivery || "9999"));
        break;
      case "words-desc":
        sorted.sort((a, b) => (b.word_count || 0) - (a.word_count || 0));
        break;
      case "held-desc":
        // Least progress first (fewest steps done relative to total).
        sorted.sort((a, b) => a.doneCount / (a.totalCount || 1) - b.doneCount / (b.totalCount || 1));
        break;
      case "title":
        sorted.sort((a, b) => a.title.localeCompare(b.title));
        break;
    }
    return sorted;
  }, [books, query, stage, holder, sortBy]);

  const activeFilters = stage !== "all" || holder !== "all" || query.trim() !== "";
  const reset = () => { setQuery(""); setStage("all"); setHolder("all"); };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[16rem] flex-1 sm:max-w-xs">
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search books, holder, comments…"
            className={`${SELECT_CLS} w-full pl-9`}
          />
        </div>

        <select aria-label="Stage" value={stage} onChange={(e) => setStage(e.target.value)} className={SELECT_CLS}>
          <option value="all">All stages</option>
          {stageOptions.map((s) => (
            <option key={s.code} value={s.code}>{s.code} · {s.label}</option>
          ))}
        </select>

        <select aria-label="Holder" value={holder} onChange={(e) => setHolder(e.target.value)} className={SELECT_CLS}>
          <option value="all">All holders</option>
          {holderOptions.map((h) => (
            <option key={h} value={h}>{h}</option>
          ))}
        </select>

        <select aria-label="Sort by" value={sortBy} onChange={(e) => setSortBy(e.target.value)} className={SELECT_CLS}>
          {SORTS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {activeFilters && (
          <button
            type="button"
            onClick={reset}
            className="btn-press rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            Clear
          </button>
        )}

        <span className="ml-auto text-sm text-gray-500 dark:text-gray-400">{filtered.length} book{filtered.length === 1 ? "" : "s"}</span>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-10 text-center text-gray-500 dark:text-gray-400">
          {books.length === 0 ? "No books yet. Add an item with type “Books”." : "No books match these filters."}
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
