"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import {
  TYPE_LABELS,
  WSB_PRETRANSLATED_TOTAL,
  effectiveWordCount,
  isWsbType,
  parseTitleDate,
  type EtItem,
} from "@/lib/et";
import {
  createEtItemAction,
  updateEtItemAction,
  type EtFormState,
} from "@/app/actions/etActions";

const initialState: EtFormState = {};

const inputCls =
  "mt-1 block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2.5 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20";
const labelCls = "block text-sm font-medium text-gray-700 dark:text-gray-300";

interface Props {
  item?: EtItem; // present => edit mode
}

export default function EtItemForm({ item }: Props) {
  const isEdit = !!item;
  const [state, formAction, isPending] = useActionState(
    isEdit ? updateEtItemAction : createEtItemAction,
    initialState
  );

  const cancelHref = isEdit ? `/et/items/${item!.id}` : "/et/items";

  // Auto-fetch the delivery date from a title ending in e.g. "(20-07-26)".
  // Keeps following the title until the user manually edits the date field.
  const [title, setTitle] = useState(item?.title ?? "");
  const [delivery, setDelivery] = useState(item?.delivery_date ?? "");
  const [deliveryTouched, setDeliveryTouched] = useState(!!item?.delivery_date);
  const detected = parseTitleDate(title);

  // Track type + word count so we can preview the wsb net word count live: wsb
  // documents reuse a fixed block of already-translated words (deducted), so the
  // entered total counts as "total − pre-translated" everywhere.
  const [type, setType] = useState(item?.type ?? "");
  const [wordCount, setWordCount] = useState(
    item?.word_count != null ? String(item.word_count) : ""
  );
  const rawWords = parseInt(wordCount, 10);
  const showWsbNet = isWsbType(type) && Number.isFinite(rawWords) && rawWords > 0;

  useEffect(() => {
    if (!deliveryTouched) setDelivery(detected ?? "");
  }, [detected, deliveryTouched]);

  return (
    <>
      {state.error && (
        <div className="mb-6 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-red-700 dark:text-red-300">{state.error}</p>
          </div>
        </div>
      )}

      <form action={formAction} className="space-y-6">
        {isEdit && <input type="hidden" name="item_id" value={item!.id} />}

        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6">
          <div className="grid gap-6 sm:grid-cols-2">
            {/* Title */}
            <div className="sm:col-span-2">
              <label htmlFor="title" className={labelCls}>
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="title"
                name="title"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={inputCls}
                placeholder="e.g., 260720 Fri bayan - Khof-e-Khuda Key Faidy (20-07-26)"
              />
              {detected && !deliveryTouched && (
                <p className="mt-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                  ✓ Delivery date auto-detected from title: {new Date(detected).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                </p>
              )}
            </div>

            {/* Sender name/email — optional, kept for tracing where work came from */}
            <div>
              <label htmlFor="sender_name" className={labelCls}>
                Sender name <span className="font-normal text-gray-400 dark:text-gray-500">(optional)</span>
              </label>
              <input
                type="text"
                id="sender_name"
                name="sender_name"
                defaultValue={item?.sender_name ?? ""}
                className={inputCls}
                placeholder="Who sent this in?"
              />
            </div>
            <div>
              <label htmlFor="sender_email" className={labelCls}>
                Sender email <span className="font-normal text-gray-400 dark:text-gray-500">(optional)</span>
              </label>
              <input
                type="email"
                id="sender_email"
                name="sender_email"
                defaultValue={item?.sender_email ?? ""}
                className={inputCls}
                placeholder="sender@example.com"
              />
            </div>

            {/* Type */}
            <div>
              <label htmlFor="type" className={labelCls}>Type</label>
              <select id="type" name="type" value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>
                <option value="">— Select type —</option>
                {Object.entries(TYPE_LABELS).map(([code, label]) => (
                  <option key={code} value={code}>{label} ({code})</option>
                ))}
              </select>
            </div>

            {/* Received date */}
            <div>
              <label htmlFor="received_date" className={labelCls}>Received date</label>
              <input type="date" id="received_date" name="received_date" defaultValue={item?.received_date ?? ""} className={inputCls} />
            </div>

            {/* Word count */}
            <div>
              <label htmlFor="word_count" className={labelCls}>Word count</label>
              <input type="number" min="0" id="word_count" name="word_count" value={wordCount} onChange={(e) => setWordCount(e.target.value)} className={inputCls} placeholder="e.g., 5367" />
              {showWsbNet && (
                <p className="mt-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                  Counts as <span className="font-semibold">{effectiveWordCount(type, rawWords)!.toLocaleString()}</span> words
                  {" "}(total {rawWords.toLocaleString()} − {WSB_PRETRANSLATED_TOTAL.toLocaleString()} already-translated). The full total is still saved.
                </p>
              )}
            </div>

            {/* Delivery date (auto-filled from title; editable) */}
            <div>
              <label htmlFor="delivery_date" className={labelCls}>
                Delivery date <span className="font-normal text-gray-400 dark:text-gray-500">(for reminders)</span>
              </label>
              <input
                type="date"
                id="delivery_date"
                name="delivery_date"
                value={delivery}
                onChange={(e) => {
                  setDelivery(e.target.value);
                  setDeliveryTouched(true);
                }}
                className={inputCls}
              />
              {deliveryTouched && detected && delivery !== detected && (
                <button type="button" onClick={() => { setDelivery(detected); setDeliveryTouched(false); }} className="mt-1 text-xs text-emerald-600 dark:text-emerald-400 hover:underline">
                  Use date from title ({detected})
                </button>
              )}
            </div>

            {/* Final email date — when set, the item is complete */}
            <div>
              <label htmlFor="final_email_date" className={labelCls}>
                Final email date <span className="font-normal text-emerald-600 dark:text-emerald-400">(sets item complete)</span>
              </label>
              <input type="date" id="final_email_date" name="final_email_date" defaultValue={item?.final_email_date ?? ""} className={inputCls} />
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">If the final email was sent, the item counts as completed even if a stage was skipped.</p>
            </div>

            {/* Priority */}
            <div>
              <label htmlFor="priority" className={labelCls}>Priority</label>
              <select id="priority" name="priority" defaultValue={item?.priority ?? ""} className={inputCls}>
                <option value="">— None —</option>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            {/* Further process / notes */}
            <div className="sm:col-span-2">
              <label htmlFor="further_process" className={labelCls}>Notes / Further process</label>
              <textarea id="further_process" name="further_process" rows={3} defaultValue={item?.further_process ?? ""} className={inputCls} placeholder="Any special instructions or history…" />
            </div>
          </div>

          {!isEdit && (
            <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
              The 8 pipeline stages (TR → FPR) are created empty. You can assign people and dates on the item page right after creating it.
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-4">
          <Link href={cancelHref} className="rounded-lg border border-gray-300 dark:border-gray-600 px-6 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-50"
          >
            {isPending && (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {isPending ? "Saving…" : isEdit ? "Save Changes" : "Create Item"}
          </button>
        </div>
      </form>
    </>
  );
}
