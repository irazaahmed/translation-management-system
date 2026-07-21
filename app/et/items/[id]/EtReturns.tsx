"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { usePermissions } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { stagesForType, stageName, type EtReturn, type StageCode } from "@/lib/et";
import {
  addEtReturnAction,
  updateEtReturnAction,
  deleteEtReturnAction,
} from "@/app/actions/etActions";
import PersonSelect from "@/components/PersonSelect";

const TODAY = new Date().toISOString().slice(0, 10);

function fmt(d: string | null): string {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

interface Props {
  itemId: string;
  type: string | null;
  returns: EtReturn[];
  peopleNames: string[];
}

export default function EtReturns({ itemId, type, returns, peopleNames }: Props) {
  const { canWrite } = usePermissions();
  const toast = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const stages = stagesForType(type);

  const [stage, setStage] = useState<StageCode | "">("");
  const [note, setNote] = useState("");
  const [person, setPerson] = useState("");
  const [sentDate, setSentDate] = useState(TODAY);
  const [receivedDate, setReceivedDate] = useState("");
  // Per-return "came back on" date for the "mark received" action below —
  // defaults to today but can be changed to any date via the date picker.
  const [backDates, setBackDates] = useState<Record<string, string>>({});
  const backDateFor = (returnId: string) => backDates[returnId] ?? TODAY;

  const inputCls =
    "w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-sm text-gray-900 dark:text-white focus:border-emerald-500 focus:outline-none";

  const reset = () => {
    setStage("");
    setNote("");
    setPerson("");
    setSentDate(TODAY);
    setReceivedDate("");
  };

  const add = () => {
    startTransition(async () => {
      const res = await addEtReturnAction(itemId, {
        stage: stage || null,
        note: note.trim() || null,
        person: person.trim() || null,
        sent_date: sentDate || null,
        received_back_date: receivedDate || null,
      });
      if (res.error) toast({ type: "error", message: res.error });
      else {
        toast({ type: "success", message: "Return logged." });
        reset();
        setOpen(false);
        router.refresh();
      }
    });
  };

  const markBack = (returnId: string) => {
    const date = backDateFor(returnId);
    startTransition(async () => {
      const res = await updateEtReturnAction(itemId, returnId, date || TODAY);
      if (res.error) toast({ type: "error", message: res.error });
      else {
        toast({ type: "success", message: "Marked received back." });
        router.refresh();
      }
    });
  };

  const remove = (returnId: string) => {
    startTransition(async () => {
      const res = await deleteEtReturnAction(itemId, returnId);
      if (res.error) toast({ type: "error", message: res.error });
      else {
        toast({ type: "success", message: "Return removed." });
        router.refresh();
      }
    });
  };

  // Viewers with no returns: nothing to show.
  if (!canWrite && returns.length === 0) return null;

  return (
    <div className="mt-6">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Returns — complete a missing part</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Log when an item is handed back to fix a missed/incorrect part.
          </p>
        </div>
        {canWrite && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="btn-press flex-shrink-0 rounded-lg border border-amber-300 dark:border-amber-700 px-3 py-1.5 text-sm font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20"
          >
            {open ? "Cancel" : "+ Return to fix"}
          </button>
        )}
      </div>

      {canWrite && open && (
        <div className="mb-3 rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/40 dark:bg-amber-900/10 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">What&apos;s missing / to complete</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="e.g. footnotes on page 3 were left out…"
                className={`mt-1 ${inputCls}`}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Returned to (person)</label>
              <PersonSelect value={person} onChange={setPerson} people={peopleNames} className={`mt-1 ${inputCls}`} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Stage (optional)</label>
              <select value={stage} onChange={(e) => setStage(e.target.value as StageCode | "")} className={`mt-1 ${inputCls}`}>
                <option value="">— none —</option>
                {stages.map((s) => (
                  <option key={s.code} value={s.code}>{s.code} · {s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Given on</label>
              <input type="date" value={sentDate} onChange={(e) => setSentDate(e.target.value)} className={`mt-1 ${inputCls}`} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Came back on (optional)</label>
              <input type="date" value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} className={`mt-1 ${inputCls}`} />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={add}
              disabled={isPending}
              className="btn-press inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {isPending ? "Saving…" : "Log return"}
            </button>
          </div>
        </div>
      )}

      {returns.length === 0 ? (
        <p className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 text-sm text-gray-500 dark:text-gray-400">
          No returns logged. Use “Return to fix” if something was missed and sent back.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {returns.map((r) => {
              const pending = !r.received_back_date;
              return (
                <li key={r.id} className="flex flex-wrap items-start gap-x-3 gap-y-2 px-4 py-3">
                  <span className={`mt-0.5 flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${pending ? "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400" : "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400"}`}>
                    {pending ? "Out" : "Done"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-900 dark:text-white">
                      {r.stage && <span className="font-semibold">{r.stage} · {stageName(r.stage)} — </span>}
                      {r.note || <span className="text-gray-400">No note</span>}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {r.person || "—"} · Given {fmt(r.sent_date)} → Back {fmt(r.received_back_date)}
                    </p>
                  </div>
                  {canWrite && (
                    <div className="flex flex-shrink-0 items-center gap-2">
                      {pending && (
                        <>
                          <input
                            type="date"
                            value={backDateFor(r.id)}
                            onChange={(e) =>
                              setBackDates((d) => ({ ...d, [r.id]: e.target.value }))
                            }
                            className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-1.5 py-1 text-[11px] text-gray-900 dark:text-white focus:border-emerald-500 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => markBack(r.id)}
                            disabled={isPending}
                            className="rounded-md bg-emerald-100 dark:bg-emerald-900/30 px-2 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 disabled:opacity-50"
                          >
                            ✓ Back
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => remove(r.id)}
                        disabled={isPending}
                        className="rounded-md px-1.5 py-1 text-[11px] font-medium text-gray-400 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-50"
                        title="Delete"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
