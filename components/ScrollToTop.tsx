"use client";

import { useEffect, useState } from "react";

/** Bottom-left "scroll to top" button that fades in after the user scrolls down.
 *  Detects scrolling on the window AND on any nested scroll container. */
export default function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handler = (e?: Event) => {
      let y = window.scrollY || document.documentElement.scrollTop || 0;
      const target = e?.target;
      if (target instanceof HTMLElement && typeof target.scrollTop === "number") {
        y = Math.max(y, target.scrollTop);
      }
      setVisible(y > 250);
    };

    handler();
    window.addEventListener("scroll", handler, { passive: true });
    // Capture phase also catches scroll from nested scroll containers.
    document.addEventListener("scroll", handler, { passive: true, capture: true });
    return () => {
      window.removeEventListener("scroll", handler);
      document.removeEventListener("scroll", handler, { capture: true } as EventListenerOptions);
    };
  }, []);

  function toTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
    document.documentElement.scrollTo?.({ top: 0, behavior: "smooth" });
  }

  if (!visible) return null;

  return (
    <button
      onClick={toTop}
      aria-label="Scroll to top"
      className="btn-press animate-fade-in no-print fixed bottom-5 left-4 lg:left-[17rem] z-50 flex h-12 w-12 items-center justify-center rounded-full border border-gray-200 dark:border-gray-700 bg-white/90 dark:bg-gray-800/90 text-gray-700 dark:text-gray-200 shadow-lg backdrop-blur-sm hover:text-emerald-600 dark:hover:text-emerald-400"
    >
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    </button>
  );
}
