import Link from "next/link";
import type { MeetingWithLanguage } from "@/lib/supabase";

function daysUntil(dateStr: string): { label: string; tone: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  const diff = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diff === 0) return { label: "Today", tone: "bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400" };
  if (diff === 1) return { label: "Tomorrow", tone: "bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400" };
  if (diff <= 3) return { label: `In ${diff} days`, tone: "bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400" };
  return { label: `In ${diff} days`, tone: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400" };
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default function UpcomingMeetings({ meetings }: { meetings: MeetingWithLanguage[] }) {
  return (
    <div className="animate-fade-in-up rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 transition-colors duration-200">
      <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-700 px-5 py-4">
        <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">Upcoming Meetings</h3>
      </div>

      {meetings.length === 0 ? (
        <div className="p-6 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No scheduled follow-ups. Set a &quot;next meeting date&quot; when recording a meeting.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
          {meetings.map(({ meeting, language }) => {
            if (!meeting.next_meeting_date) return null;
            const due = daysUntil(meeting.next_meeting_date);
            return (
              <li key={meeting.id}>
                <Link
                  href={language ? `/languages/${language.id}` : "#"}
                  className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-200"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {language ? `${language.language} (${language.country})` : "Meeting"}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {formatDate(meeting.next_meeting_date)}
                      {language?.responsible_person ? ` · ${language.responsible_person}` : ""}
                    </p>
                  </div>
                  <span className={`flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${due.tone}`}>
                    {due.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
