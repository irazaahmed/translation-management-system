"use client";

import { ProjectStats } from "@/lib/supabase";

interface ProjectStatsCardsProps {
  stats: ProjectStats[];
}

export default function ProjectStatsCards({ stats }: ProjectStatsCardsProps) {
  if (!stats || stats.length === 0) {
    return null;
  }

  return (
    <div className="mt-6 lg:mt-8">
      <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white transition-colors duration-200 mb-4">
        Project-wise Statistics
      </h2>
      <div className="grid gap-4 sm:gap-5 grid-cols-1 lg:grid-cols-3">
        {stats.map((stat, i) => (
          <div
            key={stat.project.id}
            className={`card-hover animate-fade-in-up stagger-${(i % 6) + 1} relative overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5`}
          >
            {/* Colored top accent */}
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-blue-500" />
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white break-words">
                {stat.project.name}
              </h3>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500 dark:text-gray-400">Total Languages</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">{stat.totalLanguages}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500 dark:text-gray-400">In Progress</span>
                <span className="text-sm font-medium text-blue-600 dark:text-blue-400">{stat.inProgress}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500 dark:text-gray-400">Completed</span>
                <span className="text-sm font-medium text-green-600 dark:text-green-400">{stat.completed}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500 dark:text-gray-400">Not Started</span>
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{stat.notStarted}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500 dark:text-gray-400">Meetings This Week</span>
                <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">{stat.meetingsThisWeek}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500 dark:text-gray-400">Needs Attention</span>
                <span className="text-sm font-medium text-amber-600 dark:text-amber-400">{stat.needsAttention}</span>
              </div>
            </div>

            {/* Progress bar */}
            {stat.totalLanguages > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                  <span>Progress</span>
                  <span>{Math.round((stat.completed / stat.totalLanguages) * 100)}%</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(stat.completed / stat.totalLanguages) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
