import { Language } from "@/lib/supabase";
import Link from "next/link";

interface HighPriorityLanguagesProps {
  languages: Language[];
}

function formatDate(dateString: string | null): string {
  if (!dateString) return "Never";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function HighPriorityLanguages({ languages }: HighPriorityLanguagesProps) {
  if (languages.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 sm:p-5 transition-colors duration-200">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white transition-colors duration-200">High Priority Languages</h3>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 transition-colors duration-200">
          No high priority languages at the moment.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 sm:p-5 transition-colors duration-200">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20 transition-colors duration-200 flex-shrink-0">
          <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-white transition-colors duration-200">High Priority Languages</h3>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 transition-colors duration-200">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800 transition-colors duration-200">
            <tr>
              <th scope="col" className="px-3 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider transition-colors duration-200 whitespace-nowrap">
                Language
              </th>
              <th scope="col" className="px-3 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider transition-colors duration-200 whitespace-nowrap">
                Country
              </th>
              <th scope="col" className="px-3 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider transition-colors duration-200 whitespace-nowrap">
                Responsible Person
              </th>
              <th scope="col" className="px-3 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider transition-colors duration-200 whitespace-nowrap">
                Last Meeting
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900 transition-colors duration-200">
            {languages.map((lang) => (
              <tr key={lang.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-200">
                <td className="px-3 py-3 whitespace-nowrap">
                  <Link href={`/languages/${lang.id}`}>
                    <span className="text-sm font-medium text-gray-900 dark:text-white hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors duration-200">
                      {lang.language}
                    </span>
                  </Link>
                </td>
                <td className="px-3 py-3 whitespace-nowrap">
                  <Link href={`/languages/${lang.id}`}>
                    <span className="text-sm text-gray-600 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors duration-200">
                      {lang.country}
                    </span>
                  </Link>
                </td>
                <td className="px-3 py-3 whitespace-nowrap">
                  <Link href={`/languages/${lang.id}`}>
                    <span className="text-sm text-gray-600 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors duration-200">
                      {lang.responsible_person || "—"}
                    </span>
                  </Link>
                </td>
                <td className="px-3 py-3 whitespace-nowrap">
                  <Link href={`/languages/${lang.id}`}>
                    <span className="text-sm text-gray-600 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors duration-200">
                      {formatDate(lang.last_meeting_at)}
                    </span>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
