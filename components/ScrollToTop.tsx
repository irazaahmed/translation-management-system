"use client";

import { useEffect, useState } from "react";

/** Bottom-left "scroll to top" button that fades in after the user scrolls down. */
export default function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Scroll to top"
      className="btn-press animate-fade-in no-print fixed bottom-5 left-4 sm:left-6 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-gray-200 dark:border-gray-700 bg-white/90 dark:bg-gray-800/90 text-gray-700 dark:text-gray-200 shadow-lg backdrop-blur-sm hover:text-emerald-600 dark:hover:text-emerald-400"
    >
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    </button>
  );
}
