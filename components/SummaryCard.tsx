interface SummaryCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: {
    value: string;
    label: string;
  };
  color?: "emerald" | "blue" | "amber" | "purple" | "rose" | "gray" | "green";
  /** 1-6, used to stagger the entrance animation */
  index?: number;
}

const colorVariants = {
  emerald: {
    icon: "from-emerald-500 to-teal-500",
    soft: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400",
  },
  blue: {
    icon: "from-blue-500 to-indigo-500",
    soft: "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400",
  },
  amber: {
    icon: "from-amber-500 to-orange-500",
    soft: "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400",
  },
  purple: {
    icon: "from-purple-500 to-fuchsia-500",
    soft: "bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400",
  },
  rose: {
    icon: "from-rose-500 to-pink-500",
    soft: "bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400",
  },
  gray: {
    icon: "from-gray-400 to-gray-500",
    soft: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400",
  },
  green: {
    icon: "from-green-500 to-emerald-500",
    soft: "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400",
  },
};

export default function SummaryCard({
  title,
  value,
  icon,
  trend,
  color = "emerald",
  index = 1,
}: SummaryCardProps) {
  const variant = colorVariants[color];

  return (
    <div
      className={`group card-hover animate-fade-in-up stagger-${index} rounded-lg sm:rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 sm:p-4 shadow-sm`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
          <p className="mt-0.5 text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-white tabular-nums">{value}</p>
          {trend && (
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
              <span className="font-medium text-gray-700 dark:text-gray-300">{trend.value}</span>{" "}
              {trend.label}
            </p>
          )}
        </div>
        <div
          className={`rounded-lg bg-gradient-to-br ${variant.icon} p-2 sm:p-2.5 text-white shadow-sm shrink-0 ml-2 transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-3`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}
