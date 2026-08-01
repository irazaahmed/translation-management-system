"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Avatar from "@/components/Avatar";
import { usePermissions } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import {
  addQuranPersonAction,
  updateQuranPersonAction,
  deleteQuranPersonAction,
} from "@/app/actions/paraProgressActions";
import type { QuranPersonInput } from "@/lib/paraProgressMutations";
import type { QuranPerson } from "@/lib/paraProgressData";

const inputCls =
  "w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-sm text-gray-900 dark:text-white focus:border-emerald-500 focus:outline-none";

interface FormProps {
  initial?: QuranPerson;
  onCancel: () => void;
  onSaved: () => void;
}

function PersonForm({ initial, onCancel, onSaved }: FormProps) {
  const toast = useToast();
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState(initial?.name ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [active, setActive] = useState(initial?.active ?? true);

  const submit = () => {
    if (!name.trim()) {
      toast({ type: "error", message: "Name is required." });
      return;
    }
    const input: QuranPersonInput = { name: name.trim(), notes: notes.trim() || null, active };
    startTransition(async () => {
      const res = initial ? await updateQuranPersonAction(initial.id, input) : await addQuranPersonAction(input);
      if (res.error) toast({ type: "error", message: res.error });
      else {
        toast({ type: "success", message: initial ? "Saved." : "Person added." });
        onSaved();
      }
    });
  };

  return (
    <div className="rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/40 dark:bg-emerald-900/10 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Name *</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name…" className={`mt-1 ${inputCls}`} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Notes</label>
          <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" className={`mt-1 ${inputCls}`} />
        </div>
        <div className="flex items-end">
          <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500" />
            Active (available for new work)
          </label>
        </div>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="btn-press rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
          Cancel
        </button>
        <button type="button" onClick={submit} disabled={isPending} className="btn-press inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
          {isPending ? "Saving…" : initial ? "Save changes" : "Add person"}
        </button>
      </div>
    </div>
  );
}

interface Props {
  people: QuranPerson[];
  /** Active (in-progress, unfinished) para count keyed by person id. */
  workloads: Record<string, number>;
}

export default function QuranPeopleManager({ people, workloads }: Props) {
  const { canWrite } = usePermissions();
  const toast = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const refresh = () => {
    setAdding(false);
    setEditingId(null);
    router.refresh();
  };

  const remove = (p: QuranPerson) => {
    if (!confirm(`Remove ${p.name} from the workforce? Their past para history is kept.`)) return;
    startTransition(async () => {
      const res = await deleteQuranPersonAction(p.id);
      if (res.error) toast({ type: "error", message: res.error });
      else {
        toast({ type: "success", message: `${p.name} removed.` });
        router.refresh();
      }
    });
  };

  return (
    <div>
      {canWrite && (
        <div className="mb-4">
          {adding ? (
            <PersonForm onCancel={() => setAdding(false)} onSaved={refresh} />
          ) : (
            <button
              type="button"
              onClick={() => { setAdding(true); setEditingId(null); }}
              className="btn-press inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              <span className="text-lg leading-none">+</span> Add person
            </button>
          )}
        </div>
      )}

      {people.length === 0 && !adding && (
        <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 p-10 text-center text-sm text-gray-500 dark:text-gray-400">
          No workforce members yet. Add one to start assigning paras.
        </div>
      )}

      <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {people.map((p) => {
          if (editingId === p.id) {
            return <PersonForm key={p.id} initial={p} onCancel={() => setEditingId(null)} onSaved={refresh} />;
          }
          const count = workloads[p.id] ?? 0;
          return (
            <div
              key={p.id}
              className={`gloss card-hover rounded-xl border bg-white dark:bg-gray-900 p-4 shadow-sm ${
                p.active ? "border-gray-200 dark:border-gray-700" : "border-dashed border-gray-300 dark:border-gray-700 opacity-70"
              }`}
            >
              <div className="flex items-start gap-3">
                <Avatar name={p.name} />
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                    {p.name}
                    {!p.active && <span className="ml-2 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">inactive</span>}
                  </h3>
                  {p.notes && <p className="truncate text-xs text-gray-500 dark:text-gray-400">{p.notes}</p>}
                </div>
                <span className="flex-shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
                  {count} active
                </span>
              </div>

              {canWrite && (
                <div className="mt-3 flex items-center gap-2 border-t border-gray-100 dark:border-gray-800 pt-3">
                  <button
                    type="button"
                    onClick={() => { setEditingId(p.id); setAdding(false); }}
                    className="rounded-md border border-gray-300 dark:border-gray-600 px-2.5 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(p)}
                    disabled={isPending}
                    className="rounded-md px-2 py-1 text-xs font-medium text-gray-400 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
