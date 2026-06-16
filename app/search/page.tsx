import DashboardLayout from "@/components/DashboardLayout";
import Link from "next/link";
import { searchLanguages, searchMeetings } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function priorityColor(priority: string | null): string {
  switch (priority) {
    case "high":
      return "bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400";
    case "medium":
      return "bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400";
    case "low":
      return "bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400";
    default:
      return "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400";
  }
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q || "").trim();

  let languages: Awaited<ReturnType<typeof searchLanguages>> = [];
  let meetings: Awaited<ReturnType<typeof searchMeetings>> = [];
  let error: string | null = null;

  if (query.length >= 2) {
    try {
      [languages, meetings] = await Promise.all([
        searchLanguages(query),
        searchMeetings(query),
      ]);
    } catch (err) {
      console.error("Search failed:", err);
      error = "Search failed. Please try again.";
    }
  }

  const totalResults = languages.length + meetings.length;

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">
          Search
        </h1>
        {query ? (
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {totalResults} result{totalResults === 1 ? "" : "s"} for{" "}
            <span className="font-medium text-gray-900 dark:text-white">&quot;{query}&quot;</span>
          </p>
        ) : (
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Type at least 2 characters in the search box above.
          </p>
        )}
      </div>

      {/* Search form (also works without JS) */}
      <form action="/search" method="GET" className="mb-6">
        <div className="relative max-w-xl">
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            type="search"
            name="q"
            defaultValue={query}
            autoFocus
            placeholder="Search languages, people, discussion points…"
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 pl-10 pr-4 py-2.5 text-sm text-gray-900 dark:text-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>
      </form>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {query.length >= 2 && totalResults === 0 && !error && (
        <div className="flex min-h-[200px] items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-8 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No languages or meetings matched your search.
          </p>
        </div>
      )}

      {/* Languages */}
      {languages.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Languages ({languages.length})
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {languages.map((lang) => (
              <Link
                key={lang.id}
                href={`/languages/${lang.id}`}
                className="card-hover rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 hover:border-emerald-300 dark:hover:border-emerald-700"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white truncate">
                      {lang.language}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{lang.country}</p>
                  </div>
                  <span className={`flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${priorityColor(lang.priority)}`}>
                    {lang.priority || "—"}
                  </span>
                </div>
                <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                  {lang.project?.name && <span>{lang.project.name} · </span>}
                  {lang.responsible_person || "Unassigned"}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Meetings */}
      {meetings.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Meetings ({meetings.length})
          </h2>
          <div className="space-y-3">
            {meetings.map(({ meeting, language }) => (
              <Link
                key={meeting.id}
                href={language ? `/languages/${language.id}` : "#"}
                className="card-hover block rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 hover:border-emerald-300 dark:hover:border-emerald-700"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    {language ? `${language.language} (${language.country})` : "Meeting"}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {formatDate(meeting.meeting_date)}
                  </span>
                </div>
                {meeting.participants && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    <span className="font-medium">Participants:</span> {meeting.participants}
                  </p>
                )}
                {meeting.discussion_points && (
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
                    {meeting.discussion_points}
                  </p>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}
    </DashboardLayout>
  );
}
