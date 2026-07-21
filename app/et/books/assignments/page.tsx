import DashboardLayout from "@/components/DashboardLayout";
import Link from "next/link";
import { getCachedEtItemRows, getCachedEtPeople, getCachedEtAssignments, type EtItemRow } from "@/lib/etData";
import { itemCategory, returnBadgeLabel, type EtPerson, type EtAssignment } from "@/lib/et";
import BooksAssignmentBoard, { type BoardBook, type BoardPerson, type BoardAssignment } from "./BooksAssignmentBoard";

export const dynamic = "force-dynamic";

export default async function EtBooksAssignmentsPage() {
  let rows: EtItemRow[] = [];
  let people: EtPerson[] = [];
  let assignments: EtAssignment[] = [];
  let error: string | null = null;
  try {
    const [r, p, a] = await Promise.all([
      getCachedEtItemRows(),
      getCachedEtPeople(),
      getCachedEtAssignments(),
    ]);
    rows = r;
    people = p;
    assignments = a;
  } catch (err) {
    console.error("Failed to load book assignments:", err);
    error = "Failed to load. Have you run the migrations and import yet?";
  }

  // In-process books only — completed & stopped are hidden (same as /et/books).
  const books: BoardBook[] = rows
    .filter((r) => !r.stopped && itemCategory(r.type) === "books" && r.derivedStatus !== "completed")
    .map((b) => ({
      id: b.id,
      title: b.title,
      holder: b.current.holder,
      stageLabel: b.inReturn ? returnBadgeLabel(b.returnStage) : b.current.stage ? `${b.current.stage} · ${b.current.label}` : b.current.label,
      unassigned: b.derivedStatus === "pending_assignment",
    }))
    .sort((a, b) => a.title.localeCompare(b.title));

  const boardPeople: BoardPerson[] = people
    .filter((p) => p.active)
    .map((p) => ({ id: p.id, name: p.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const bookAssignments: BoardAssignment[] = assignments
    .filter((a) => (a.item_type || "").toLowerCase() === "bks")
    .map((a) => ({ id: a.id, personId: a.person_id, itemId: a.item_id, itemTitle: a.item_title }));

  return (
    <DashboardLayout>
      <div className="mb-4 sm:mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-600 dark:text-emerald-400">English Translation</p>
          <h1 className="mt-1 text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">Who has which book</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Each person&apos;s current book(s), and the next book planned for them.
          </p>
        </div>
        <Link href="/et/books" className="btn-press inline-flex flex-shrink-0 items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
          ← Books
        </Link>
      </div>

      {error ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-6 text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300">{error}</div>
      ) : (
        <BooksAssignmentBoard books={books} people={boardPeople} assignments={bookAssignments} />
      )}
    </DashboardLayout>
  );
}
