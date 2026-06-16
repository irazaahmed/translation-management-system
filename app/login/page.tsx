import Link from "next/link";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect } = await searchParams;

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gray-50 dark:bg-gray-900 px-4 transition-colors duration-200">
      {/* Decorative gradient blobs */}
      <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-emerald-300/30 dark:bg-emerald-700/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-blue-300/30 dark:bg-blue-700/20 blur-3xl" />

      <div className="relative w-full max-w-sm animate-scale-in">
        <div className="flex flex-col items-center mb-8">
          <img
            src="/MyLogoYellow.jpeg"
            alt="Logo"
            className="h-14 w-14 object-cover rounded-full mb-4 shadow-lg ring-2 ring-white/50 dark:ring-gray-700"
          />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white text-center">
            Quranic Translation
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Management System
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
            Sign in
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Enter your credentials to manage data.
          </p>
          <LoginForm redirectTo={redirect ?? "/"} />

          {/* Divider */}
          <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
            <span className="text-xs text-gray-400 dark:text-gray-500">or</span>
            <span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
          </div>

          {/* Continue without login (view-only) */}
          <Link
            href="/"
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-200"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Continue without login
          </Link>
        </div>

        <p className="mt-6 text-center text-xs text-gray-400 dark:text-gray-500">
          Viewing is open to everyone. Login is only needed to add or edit data.
        </p>
      </div>
    </div>
  );
}
