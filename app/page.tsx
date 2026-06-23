import DashboardLayout from "@/components/DashboardLayout";
import SummaryCard from "@/components/SummaryCard";
import { Language } from "@/lib/supabase";
import {
  getCachedLanguages,
  getCachedRecentMeetings,
  getCachedStaleLanguages,
  getCachedUrgentLanguages,
  getCachedProjectStats,
  getCachedMeetingsCountThisWeek,
  getCachedUpcomingMeetings,
  getCachedScheduleData,
} from "@/lib/cachedData";
import { computeScheduleStatus, weekdayName } from "@/lib/schedule";
import TodaysSchedule, { type TodaysScheduleItem } from "./dashboard/TodaysSchedule";
import RecentMeetings from "./dashboard/RecentMeetings";
import LanguagesNeedingAttention from "./dashboard/LanguagesNeedingAttention";
import UrgentFollowUps from "./dashboard/UrgentFollowUps";
import ProjectStatsCards from "./dashboard/ProjectStatsCards";
import AnalyticsCharts from "./dashboard/AnalyticsCharts";
import UpcomingMeetings from "./dashboard/UpcomingMeetings";
import DashboardHero from "./dashboard/DashboardHero";
import UnassignedEtTasks, { type UnassignedTask } from "./dashboard/UnassignedEtTasks";
import { getCachedEtItemRows } from "@/lib/etData";
import { itemCategory, CATEGORY_LABELS } from "@/lib/et";
import { StaffOnly } from "@/components/AuthProvider";
import Link from "next/link";

// Force dynamic rendering to prevent stale data
export const dynamic = "force-dynamic";

async function getDashboardStats(languages: Language[], meetingsThisWeek: number) {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const stats = {
    totalLanguages: languages.length,
    meetingsThisWeek,
    noMeeting7Days: 0,
    highPriority: 0,
    mediumPriority: 0,
    lowPriority: 0,
    noPriority: 0,
    completed: 0,
    notStarted: 0,
  };

  languages.forEach((lang) => {
    const lastMeeting = lang.last_meeting_at ? new Date(lang.last_meeting_at) : null;

    if (!lastMeeting || lastMeeting < sevenDaysAgo) {
      stats.noMeeting7Days++;
    }

    if (lang.priority === "high") {
      stats.highPriority++;
    } else if (lang.priority === "medium") {
      stats.mediumPriority++;
    } else if (lang.priority === "low") {
      stats.lowPriority++;
    } else {
      stats.noPriority++;
    }

    if (lang.work_status === "completed") {
      stats.completed++;
    }
    if (lang.work_status === "not_started") {
      stats.notStarted++;
    }
  });

  return stats;
}

export default async function Dashboard() {
  let languages: Language[] = [];
  let meetingsWithLanguage: Awaited<ReturnType<typeof getCachedRecentMeetings>> = [];
  let staleLanguages: Language[] = [];
  let urgentLanguages: Language[] = [];
  let projectStats: Awaited<ReturnType<typeof getCachedProjectStats>> = [];
  let upcomingMeetings: Awaited<ReturnType<typeof getCachedUpcomingMeetings>> = [];
  let todaysSchedule: TodaysScheduleItem[] = [];
  const todayName = weekdayName(new Date());
  let stats: Awaited<ReturnType<typeof getDashboardStats>> | null = null;
  let error: string | null = null;

  try {
    // Fetch all data in parallel using cached functions
    const [languagesData, recentMeetingsData, staleData, urgentData, projectStatsData, meetingsCount, upcomingData, scheduleData] = await Promise.all([
      getCachedLanguages(),
      getCachedRecentMeetings(5),
      getCachedStaleLanguages(14),
      getCachedUrgentLanguages(30),
      getCachedProjectStats(),
      getCachedMeetingsCountThisWeek(),
      getCachedUpcomingMeetings(8),
      getCachedScheduleData(),
    ]);

    languages = languagesData;
    meetingsWithLanguage = recentMeetingsData;
    staleLanguages = staleData;
    urgentLanguages = urgentData;
    projectStats = projectStatsData;
    upcomingMeetings = upcomingData;

    // Languages whose recurring weekly meeting falls on today's weekday.
    const now = new Date();
    todaysSchedule = scheduleData
      .filter((e) => e.assigned_day === todayName)
      .map((e) => ({ entry: e, status: computeScheduleStatus(e.assigned_day, e.lastMeeting, now) }));

    // Use the accurate count from dedicated query
    const meetingsThisWeek = meetingsCount;

    stats = await getDashboardStats(languages, meetingsThisWeek);
  } catch (err) {
    console.error("Failed to fetch dashboard data:", err);
    error = "Failed to load dashboard data";
  }

  // English Translation: surface items waiting for assignment (no date yet) so
  // nothing stalls between people. Isolated so an ET issue can't break the home page.
  let unassignedEt: UnassignedTask[] = [];
  let englishTotal = 0;
  try {
    const etRows = (await getCachedEtItemRows()).filter((r) => !r.stopped);
    englishTotal = etRows.length;
    unassignedEt = etRows
      .filter((r) => r.derivedStatus === "pending_assignment")
      .map((r) => ({
        id: r.id,
        title: r.title,
        category: CATEGORY_LABELS[itemCategory(r.type)],
      }));
  } catch (err) {
    console.error("Failed to fetch English module data:", err);
  }

  const displayStats = stats || {
    totalLanguages: 0,
    meetingsThisWeek: 0,
    noMeeting7Days: 0,
    highPriority: 0,
    mediumPriority: 0,
    lowPriority: 0,
    noPriority: 0,
    completed: 0,
    notStarted: 0,
  };

  return (
    <DashboardLayout>
      {/* Page Header - optimized for small laptops */}
      <div className="mb-4 sm:mb-6 lg:mb-8 overflow-visible">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 overflow-visible">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gradient truncate">Dashboard</h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 transition-colors duration-200">
              Translation Management System — Quranic & English workspaces
            </p>
          </div>
          <StaffOnly>
            <div className="flex w-full sm:w-auto items-center gap-2 flex-shrink-0">
              <Link
                href="/languages/new"
                className="btn-press flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-3 sm:px-4 lg:px-5 py-2.5 sm:py-2 text-sm font-medium text-white shadow-sm hover:from-blue-700 hover:to-indigo-700 whitespace-nowrap"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="sm:hidden lg:inline">Add Language</span>
                <span className="hidden sm:inline lg:hidden">Language</span>
              </Link>
              <Link
                href="/meetings/new"
                className="btn-press flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-3 sm:px-4 lg:px-5 py-2.5 sm:py-2 text-sm font-medium text-white shadow-sm hover:from-emerald-700 hover:to-teal-700 whitespace-nowrap"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="sm:hidden lg:inline">Quick Meeting</span>
                <span className="hidden sm:inline lg:hidden">Meeting</span>
              </Link>
            </div>
          </StaffOnly>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-6 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 p-4 transition-colors duration-200">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-red-700 dark:text-red-300 transition-colors duration-200">{error}</p>
          </div>
        </div>
      )}

      {/* Empty State (only when BOTH modules are empty) */}
      {displayStats.totalLanguages === 0 && englishTotal === 0 && !error ? (
        <div className="flex min-h-[400px] items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-12 text-center transition-colors duration-200">
          <div>
            <svg className="mx-auto h-16 w-16 text-gray-300 dark:text-gray-600 transition-colors duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
            </svg>
            <h3 className="mt-6 text-xl font-semibold text-gray-900 dark:text-white transition-colors duration-200">No languages yet</h3>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 transition-colors duration-200">
              Get started by adding your first language to track meetings.
            </p>
            <StaffOnly>
              <Link
                href="/languages/new"
                className="mt-6 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-3 text-sm font-medium text-white hover:bg-emerald-700 transition-colors duration-200"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add First Language
              </Link>
            </StaffOnly>
          </div>
        </div>
      ) : (
        <>
          {/* Hero banner */}
          <DashboardHero
            needsAttention={staleLanguages.length}
            upcoming={upcomingMeetings.length}
            meetingsThisWeek={displayStats.meetingsThisWeek}
          />

          {/* Unassigned English tasks — shown separately so nothing stalls */}
          <UnassignedEtTasks tasks={unassignedEt} />

          {/* Stats Grid */}
          <div className="mt-4 sm:mt-6 grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-6 xl:grid-cols-5">
            <SummaryCard
              title="Total Languages"
              index={1}
              className="lg:col-span-2 xl:col-span-1"
              value={displayStats.totalLanguages}
              color="emerald"
              icon={
                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                </svg>
              }
              trend={{ value: "languages tracked", label: "" }}
            />

            <SummaryCard
              title="In Progress"
              index={2}
              className="lg:col-span-2 xl:col-span-1"
              value={displayStats.totalLanguages - displayStats.completed - displayStats.notStarted}
              color="blue"
              icon={
                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              }
              trend={{ value: "active work", label: "" }}
            />

            <SummaryCard
              title="Completed"
              index={3}
              className="lg:col-span-2 xl:col-span-1"
              value={displayStats.completed}
              color="green"
              icon={
                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
              trend={{ value: "finished", label: "" }}
            />

            <SummaryCard
              title="Not Started"
              index={4}
              className="lg:col-span-3 xl:col-span-1"
              value={displayStats.notStarted}
              color="gray"
              icon={
                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
              trend={{ value: "pending", label: "" }}
            />

            <SummaryCard
              title="Meetings This Week"
              index={5}
              className="col-span-2 lg:col-span-3 xl:col-span-1"
              value={displayStats.meetingsThisWeek}
              color="blue"
              icon={
                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
              trend={{ value: "last 7 days", label: "" }}
            />
          </div>

          {/* Today's scheduled meetings (rolls over by weekday) */}
          <div className="mt-4 sm:mt-6">
            <TodaysSchedule items={todaysSchedule} todayName={todayName} />
          </div>

          {/* Main Dashboard Grid - stacks until xl so it isn't cramped on ~1024px laptops */}
          <div className="mt-4 sm:mt-6 grid gap-4 sm:gap-6 grid-cols-1 xl:grid-cols-3">
            {/* Recent Meetings - wider column on xl, full width below */}
            <div className="xl:col-span-2">
              <RecentMeetings meetings={meetingsWithLanguage} />
            </div>

            {/* Languages Needing Attention - Right side (1 column) */}
            <div>
              <LanguagesNeedingAttention languages={staleLanguages} />
            </div>
          </div>

          {/* Upcoming Meetings + Urgent Follow-ups */}
          <div id="upcoming" className="scroll-mt-20 mt-4 sm:mt-6 grid gap-4 sm:gap-6 grid-cols-1 xl:grid-cols-2">
            <UpcomingMeetings meetings={upcomingMeetings} />
            <UrgentFollowUps languages={urgentLanguages} />
          </div>

          {/* Analytics charts */}
          <AnalyticsCharts
            workStatus={{
              completed: displayStats.completed,
              inProgress: displayStats.totalLanguages - displayStats.completed - displayStats.notStarted,
              notStarted: displayStats.notStarted,
            }}
            priority={{
              high: displayStats.highPriority,
              medium: displayStats.mediumPriority,
              low: displayStats.lowPriority,
              none: displayStats.noPriority,
            }}
          />

          {/* Project-wise Statistics */}
          {projectStats.length > 0 && (
            <ProjectStatsCards stats={projectStats} />
          )}
        </>
      )}
    </DashboardLayout>
  );
}
