export default function Footer() {
  return (
    <footer className="mt-auto border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 transition-colors duration-200">
      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Top row: brand + managed by + copyright */}
        <div className="flex flex-col items-center gap-6 text-center md:flex-row md:items-start md:justify-between md:text-left">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <span className="relative flex h-10 w-10 flex-shrink-0 overflow-hidden rounded-full ring-1 ring-gray-200 dark:ring-gray-700">
              <img
                src="/MyLogoYellow.jpeg"
                alt="QTMS Logo"
                className="h-full w-full object-cover"
              />
            </span>
            <div>
              <p className="text-base font-bold text-gray-900 dark:text-white">
                QTMS
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Quranic Translation Management System
              </p>
            </div>
          </div>

          {/* Managed by */}
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500">
              Managed by
            </p>
            <p className="mt-0.5 text-base font-semibold text-gray-900 dark:text-white">
              Ahmed Raza
            </p>
            <p className="text-sm text-emerald-600 dark:text-emerald-400">
              Team Lead Translation
            </p>
          </div>

          {/* Copyright */}
          <div className="md:text-right">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              © 2026 Ahmed Raza
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              All Rights Reserved
            </p>
          </div>
        </div>

        {/* Divider */}
        <div className="my-6 h-px w-full bg-gradient-to-r from-transparent via-gray-200 to-transparent dark:via-gray-800" />

        {/* Bottom line */}
        <p className="text-center text-xs text-gray-400 dark:text-gray-500">
          Built with care for the service of the Quran — tracking translation
          progress across every language &amp; team.
        </p>
      </div>
    </footer>
  );
}
