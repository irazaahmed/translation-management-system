"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { usePermissions } from "@/components/AuthProvider";
import { useAssistantChat } from "@/components/useAssistantChat";

/**
 * Floating AI chatbot available on every page (bottom-right). Uses the same
 * /api/assistant backend as the full /assistant page. Hidden on the dedicated
 * assistant page (redundant there) and on the login page.
 */
export default function ChatWidget() {
  const pathname = usePathname();
  const { isLoggedIn } = usePermissions();
  const { messages, input, setInput, loading, error, send } = useAssistantChat();
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  // Visible viewport (shrinks when the mobile keyboard opens).
  const [vv, setVv] = useState<{ height: number; offsetTop: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages, loading, open, vv]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Track the visual viewport so the panel sits above the keyboard on mobile.
  useEffect(() => {
    const visualViewport = window.visualViewport;
    if (!open || !visualViewport) {
      setVv(null);
      return;
    }
    const update = () =>
      setVv({ height: visualViewport.height, offsetTop: visualViewport.offsetTop });
    update();
    visualViewport.addEventListener("resize", update);
    visualViewport.addEventListener("scroll", update);
    return () => {
      visualViewport.removeEventListener("resize", update);
      visualViewport.removeEventListener("scroll", update);
    };
  }, [open]);

  // Don't show on the full assistant page or the login screen.
  if (pathname?.startsWith("/assistant") || pathname?.startsWith("/login")) return null;

  const panelClassName = isMobile
    ? "animate-scale-in fixed z-50 flex flex-col overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-2xl"
    : "animate-scale-in fixed bottom-24 right-4 sm:right-6 z-50 flex h-[70vh] max-h-[32rem] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-2xl";
  const panelStyle: React.CSSProperties | undefined = isMobile
    ? {
        left: 8,
        right: 8,
        top: (vv?.offsetTop ?? 0) + 8,
        height: (vv?.height ?? (typeof window !== "undefined" ? window.innerHeight : 600)) - 16,
      }
    : undefined;

  return (
    <div className="no-print">
      {/* Panel */}
      {open && (
        <div className={panelClassName} style={panelStyle}>
          {/* Header */}
          <div className="animate-gradient flex items-center justify-between bg-gradient-to-r from-emerald-600 via-teal-600 to-blue-600 px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-4 4v-4z" />
                </svg>
              </span>
              <div className="leading-tight">
                <p className="text-sm font-bold">QTMS Assistant</p>
                <p className="text-[10px] text-white/80">Progress · meetings · updates</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded-lg p-1.5 hover:bg-white/20 transition-colors"
              aria-label="Close"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center text-center px-2">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Assalam o Alaikum 👋</p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Progress poochhein, meeting ka summary lein, ya data update karwayein.
                </p>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-gradient-to-br from-emerald-600 to-teal-600 text-white rounded-br-md"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100 rounded-bl-md"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md bg-gray-100 dark:bg-gray-800 px-3 py-2.5">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.3s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.15s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" />
                </div>
              </div>
            )}
            {error && (
              <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-2.5 text-xs text-red-700 dark:text-red-400">
                {error}
              </div>
            )}
          </div>

          {/* Composer */}
          <div className="border-t border-gray-200 dark:border-gray-700 p-2.5">
            {!isLoggedIn && (
              <p className="mb-1.5 text-center text-[10px] text-gray-400 dark:text-gray-500">
                Sawal bina login. Update/meeting record karne ke liye login zaroori.
              </p>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="flex items-end gap-2"
            >
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                rows={1}
                placeholder="Yahan likhein…"
                className="max-h-24 flex-1 resize-none rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="btn-press inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-teal-600 text-white shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Send"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19V5m0 0l-7 7m7-7l7 7" />
                </svg>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Launcher button — hidden when the full-screen mobile panel is open. */}
      {!(open && isMobile) && (
      <button
        onClick={() => setOpen((o) => !o)}
        className="btn-press fixed bottom-5 right-4 sm:right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 via-teal-600 to-blue-600 text-white shadow-lg"
        aria-label={open ? "Close assistant" : "Open assistant"}
      >
        {!open && (
          <span className="absolute inset-0 rounded-full bg-emerald-400/40 animate-ping" />
        )}
        <span className="relative">
          {open ? (
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-4 4v-4z" />
            </svg>
          )}
        </span>
      </button>
      )}
    </div>
  );
}
