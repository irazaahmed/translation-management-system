"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { usePermissions } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { setEtCloseoutAction } from "@/app/actions/etActions";

interface Props {
  itemId: string;
  link: string | null;
  remarks: string | null;
  /** Compact layout for list cards (Link / Remarks tab). */
  compact?: boolean;
}

/**
 * After the final email: record where the delivered work lives (online or
 * SharePoint link) and/or a remark. Either one completes the item.
 */
export default function EtCloseoutForm({ itemId, link, remarks, compact = false }: Props) {
  const { canWrite } = usePermissions();
  const toast = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [linkVal, setLinkVal] = useState(link ?? "");
  const [remarksVal, setRemarksVal] = useState(remarks ?? "");

  const dirty = linkVal.trim() !== (link ?? "") || remarksVal.trim() !== (remarks ?? "");
  const willComplete = !!(linkVal.trim() || remarksVal.trim());
  // Already closed out: saving only edits the link / remark.
  const wasDone = !!(link || remarks);

  if (!canWrite) {
    return (
      <div className="space-y-1 text-sm">
        <p className="text-gray-700 dark:text-gray-300">
          <span className="text-gray-400 dark:text-gray-500">Link: </span>
          {link ? (
            <a href={link} target="_blank" rel="noopener noreferrer" className="break-all text-emerald-600 dark:text-emerald-400 hover:underline">{link}</a>
          ) : "—"}
        </p>
        <p className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">
          <span className="text-gray-400 dark:text-gray-500">Remarks: </span>{remarks || "—"}
        </p>
      </div>
    );
  }

  const save = () => {
    startTransition(async () => {
      const res = await setEtCloseoutAction(itemId, linkVal, remarksVal);
      if (res.error) toast({ type: "error", message: res.error });
      else {
        toast({ type: "success", message: willComplete ? (wasDone ? "Link / remarks saved." : "Saved — item completed.") : "Cleared — item is back in Link / Remarks." });
        router.refresh();
      }
    });
  };

  const inputCls =
    "w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-sm text-gray-900 dark:text-white focus:border-emerald-500 focus:outline-none";

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Online / SharePoint link</label>
        <div className="flex items-center gap-2">
          <input
            type="url"
            value={linkVal}
            onChange={(e) => setLinkVal(e.target.value)}
            placeholder="https://…"
            aria-label="Online or SharePoint link"
            className={inputCls}
          />
          {link && (
            <a href={link} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline">
              Open ↗
            </a>
          )}
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Remarks</label>
        <textarea
          value={remarksVal}
          onChange={(e) => setRemarksVal(e.target.value)}
          rows={compact ? 2 : 3}
          placeholder="e.g. Sent by email only — no online link"
          aria-label="Remarks"
          className={inputCls}
        />
      </div>
      <div className="flex items-center justify-end gap-3">
        {!willComplete && dirty && (
          <span className="text-xs text-amber-600 dark:text-amber-400">Add a link or a remark to complete.</span>
        )}
        <button
          type="button"
          onClick={save}
          disabled={isPending || !dirty}
          className="btn-press inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {isPending ? "Saving…" : willComplete && !wasDone ? "Save & complete" : "Save"}
        </button>
      </div>
    </div>
  );
}
