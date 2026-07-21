import DashboardLayout from "@/components/DashboardLayout";
import Link from "next/link";
import { getCachedEtItemRows, type EtItemRow } from "@/lib/etData";
import { itemCategory, reminderInfo } from "@/lib/et";
import BooksManager, { type BookRow } from "./BooksManager";

export const dynamic = "force-dynamic";

// Manual display order (matches the team's tracking sheet, "for now"). Each entry
// is a distinctive lowercase substring of the title; books not listed here sort
// after these, alphabetically. Completed books are not shown at all.
const ORDERED_BOOK_KEYS = [
  "aaina e qiyamat",
  "anwaar-ul-hadees",
  "faizan e siddiq",
  "faizan e ummahat",
  "islami maheeno",
  "jannat me le janay",
  "khassiyyat abwab",
  "madani qafle walo",
  "mukhtasir minhaj",
  "quran seekhyen",
  "ishq-e-rasool",
  "talkhees usool",
  "zia ul qari - complete",
  "aurat aur quran",
  "qwaidul sarf final all parts",
  "khulasa tun nahw",
  "maktoobat e ameer",
  "bahar e dua",
];

function orderIndex(title: string): number {
  const t = title.toLowerCase();
  const i = ORDERED_BOOK_KEYS.findIndex((k) => t.includes(k));
  return i === -1 ? ORDERED_BOOK_KEYS.length : i;
}

export default async function EtBooksPage() {
  let rows: EtItemRow[] = [];
  let error: string | null = null;
  try {
    rows = await getCachedEtItemRows();
  } catch (err) {
    console.error("Failed to fetch ET items:", err);
    error = "Failed to load. Have you run the migration and import yet?";
  }

  // Books only (type 'bks'), in-process only (completed & stopped are hidden),
  // ordered to match the team's tracking sheet, then alphabetically.
  const books: BookRow[] = rows
    .filter((r) => !r.stopped && itemCategory(r.type) === "books" && r.derivedStatus !== "completed")
    .sort((a, b) => {
      const ia = orderIndex(a.title);
      const ib = orderIndex(b.title);
      if (ia !== ib) return ia - ib;
      return a.title.localeCompare(b.title);
    })
    .map((r) => ({
      id: r.id,
      title: r.title,
      word_count: r.word_count,
      delivery: reminderInfo(r).delivery,
      stage: r.current.stage,
      stageLabel: r.current.label,
      activeStageCodes: r.activeStageCodes,
      completed: r.current.completed,
      inReturn: r.inReturn,
      holder: r.current.holder,
      doneCount: r.current.doneCount,
      totalCount: r.current.totalCount,
      comment: r.further_process ?? "",
    }));

  return (
    <DashboardLayout>
      <div className="mb-4 sm:mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-600 dark:text-emerald-400">English Translation</p>
          <h1 className="mt-1 text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">Books</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {books.length} in-process book{books.length === 1 ? "" : "s"} · completed are hidden
          </p>
        </div>
        <Link href="/et" className="btn-press inline-flex flex-shrink-0 items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
          ← Dashboard
        </Link>
      </div>

      {error ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-6 text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300">{error}</div>
      ) : (
        <BooksManager books={books} />
      )}
    </DashboardLayout>
  );
}
