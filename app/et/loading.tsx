import DashboardLayout from "@/components/DashboardLayout";

/**
 * Instant navigation skeleton for the whole English Translation section.
 *
 * Every /et page is `force-dynamic`, so without a loading boundary a click would
 * block on the server (data fetch + render) with the OLD page frozen and
 * unresponsive. This Suspense fallback swaps in immediately — the sidebar/header
 * shell stays put and the content area shows placeholders — so navigation feels
 * instant even while the data loads.
 */
export default function EtLoading() {
  return (
    <DashboardLayout>
      <div className="animate-pulse">
        {/* Page header */}
        <div className="mb-6">
          <div className="h-3 w-32 rounded bg-gray-200 dark:bg-gray-800" />
          <div className="mt-2 h-7 w-56 rounded bg-gray-200 dark:bg-gray-800" />
          <div className="mt-2 h-3 w-72 rounded bg-gray-100 dark:bg-gray-800/70" />
        </div>

        {/* Summary-card row */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900" />
          ))}
        </div>

        {/* Content rows */}
        <div className="mt-6 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900" />
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
