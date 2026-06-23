"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { usePermissions } from "@/components/AuthProvider";
import { logoutAction } from "@/app/actions/authActions";
import LiveClock from "@/components/LiveClock";

export default function Header() {
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { profile, isLoggedIn, role, isAdmin } = usePermissions();

  const userInitial = (profile?.full_name || profile?.email || "?")
    .charAt(0)
    .toUpperCase();

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme);
    setIsOpen(false);
  };

  const toggleSidebar = () => {
    window.dispatchEvent(new CustomEvent('sidebar-toggle-request'));
  };

  // Get the icon based on resolved theme (actual applied theme)
  const getThemeIcon = () => {
    if (theme === "system") {
      // Show sun for light system, moon for dark system
      return resolvedTheme === "dark" ? (
        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      ) : (
        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      );
    }
    return theme === "dark" ? (
      <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
      </svg>
    ) : (
      <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    );
  };

  return (
    <header className="sticky top-0 z-20 h-16 border-b border-gray-200/70 dark:border-gray-700/70 bg-white/70 dark:bg-gray-900/60 backdrop-blur-xl px-3 sm:px-4 lg:px-6 transition-colors duration-200">
      <div className="flex h-full items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3 lg:gap-4">
          {/* Mobile menu button - visible only on mobile */}
          <button
            onClick={toggleSidebar}
            className="lg:hidden flex-shrink-0 rounded-lg p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200"
            aria-label="Toggle menu"
          >
            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <span className="relative flex h-8 w-8 flex-shrink-0 items-center justify-center">
              <span className="absolute inset-0 rounded-full bg-emerald-400/40 animate-ping" />
              <span className="relative flex h-8 w-8 overflow-hidden rounded-full ring-2 ring-emerald-400/60">
                <img
                  src="/MyLogoYellow.jpeg"
                  alt="Logo"
                  className="h-full w-full object-cover"
                />
              </span>
            </span>
            <h1 className="hidden sm:block text-sm sm:text-base lg:text-lg font-semibold text-gray-900 dark:text-white truncate min-w-0 transition-colors duration-200">
              <span className="hidden sm:inline">Translation </span>Management System
            </h1>
          </div>
        </div>
        {/* Global search */}
        <form action="/search" method="GET" className="hidden md:flex flex-1 max-w-xs lg:max-w-sm mx-3">
          <div className="relative w-full">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="search"
              name="q"
              placeholder="Search…"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 pl-9 pr-3 py-1.5 text-sm text-gray-900 dark:text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </form>

        <div className="flex flex-shrink-0 items-center gap-1 sm:gap-2 lg:gap-4">
          {/* Date & time — stacked (date over time) on mobile, full inline on desktop */}
          <LiveClock
            showSeconds={false}
            stacked
            className="md:hidden text-[10px] text-gray-500 dark:text-gray-400 transition-colors duration-200"
          />
          <LiveClock
            showIcon
            className="hidden md:inline-flex text-xs sm:text-sm text-gray-500 dark:text-gray-400 transition-colors duration-200"
          />

          {/* Theme Selector Dropdown */}
          {mounted && (
            <div className="relative">
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="rounded-lg p-1.5 sm:p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200"
                aria-label="Select theme"
                aria-expanded={isOpen}
              >
                {getThemeIcon()}
              </button>

              {/* Dropdown Menu */}
              {isOpen && (
                <>
                  {/* Backdrop for mobile */}
                  <div
                    className="fixed inset-0 z-10 lg:hidden"
                    onClick={() => setIsOpen(false)}
                  />
                  {/* Dropdown */}
                  <div className="absolute right-0 mt-2 w-40 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg z-20 overflow-hidden">
                    <button
                      onClick={() => handleThemeChange("light")}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors duration-200 ${
                        theme === "light"
                          ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400"
                          : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                      }`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                      Light
                    </button>
                    <button
                      onClick={() => handleThemeChange("dark")}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors duration-200 ${
                        theme === "dark"
                          ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400"
                          : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                      }`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                      </svg>
                      Dark
                    </button>
                    <button
                      onClick={() => handleThemeChange("system")}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors duration-200 ${
                        theme === "system"
                          ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400"
                          : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                      }`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      System
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* User menu / Login */}
          {mounted && (
            isLoggedIn ? (
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="gloss btn-press h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md ring-1 ring-white/40 transition-all duration-200 hover:ring-2 hover:ring-emerald-400"
                  aria-label="User menu"
                  aria-expanded={userMenuOpen}
                >
                  <span className="text-xs sm:text-sm font-bold text-white">
                    {userInitial}
                  </span>
                </button>

                {userMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setUserMenuOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-56 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg z-20 overflow-hidden">
                      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {profile?.full_name || profile?.email}
                        </p>
                        <span className="mt-1 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400">
                          {role}
                        </span>
                      </div>
                      {isAdmin && (
                        <Link
                          href="/admin/users"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-200"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                          </svg>
                          Manage Users
                        </Link>
                      )}
                      <form action={logoutAction}>
                        <button
                          type="submit"
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors duration-200"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                          </svg>
                          Sign out
                        </button>
                      </form>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <Link
                href="/login"
                className="gloss animate-gradient btn-press group inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-600 via-teal-500 to-blue-600 px-3 py-1.5 text-xs sm:text-sm font-medium text-white shadow-md shadow-emerald-500/25 transition-colors duration-200"
              >
                <svg className="icon-3d w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Login
              </Link>
            )
          )}
        </div>
      </div>
    </header>
  );
}
