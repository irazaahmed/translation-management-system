interface AnalyticsChartsProps {
  workStatus: { completed: number; inProgress: number; notStarted: number };
  priority: { high: number; medium: number; low: number; none: number };
}

interface BarRow {
  label: string;
  value: number;
  color: string; // tailwind bg color class
}

function BarChart({ title, rows }: { title: string; rows: BarRow[] }) {
  const total = rows.reduce((s, r) => s + r.value, 0);
  const max = Math.max(1, ...rows.map((r) => r.value));

  return (
    <div className="card-hover animate-fade-in-up rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">{title}</h3>
      {total === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500">No data yet.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => {
            const pct = total > 0 ? Math.round((row.value / total) * 100) : 0;
            const width = max > 0 ? (row.value / max) * 100 : 0;
            return (
              <div key={row.label}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-gray-600 dark:text-gray-300">{row.label}</span>
                  <span className="text-gray-500 dark:text-gray-400 tabular-nums">
                    {row.value} ({pct}%)
                  </span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${row.color} transition-all duration-500`}
                    style={{ width: `${width}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function AnalyticsCharts({ workStatus, priority }: AnalyticsChartsProps) {
  return (
    <div className="mt-4 sm:mt-6 grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2">
      <BarChart
        title="Work Status Distribution"
        rows={[
          { label: "Completed", value: workStatus.completed, color: "bg-green-500" },
          { label: "In Progress", value: workStatus.inProgress, color: "bg-blue-500" },
          { label: "Not Started", value: workStatus.notStarted, color: "bg-gray-400" },
        ]}
      />
      <BarChart
        title="Priority Distribution"
        rows={[
          { label: "High", value: priority.high, color: "bg-red-500" },
          { label: "Medium", value: priority.medium, color: "bg-amber-500" },
          { label: "Low", value: priority.low, color: "bg-green-500" },
          { label: "Not set", value: priority.none, color: "bg-gray-400" },
        ]}
      />
    </div>
  );
}
