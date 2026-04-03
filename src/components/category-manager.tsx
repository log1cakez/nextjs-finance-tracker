"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  createCategory,
  deleteCategory,
  searchSuggestedCategoryNames,
  type CategoryActionState,
} from "@/app/actions/categories";
import type { categories } from "@/db/schema";
import {
  useCenterToast,
  useToastOnActionError,
} from "@/components/center-toast";
import { formatTypedLabel } from "@/lib/typed-label-format";

type Category = typeof categories.$inferSelect;

const initial: CategoryActionState = {};

export function CategoryManager({ items }: { items: Category[] }) {
  const [state, formAction, pending] = useActionState(createCategory, initial);
  const { showToast } = useCenterToast();
  const formRef = useRef<HTMLFormElement>(null);
  useToastOnActionError(state.error, pending, "Could not add category");
  const [kind, setKind] = useState<"income" | "expense">("expense");
  const [nameInput, setNameInput] = useState("");
  const [suggestions, setSuggestions] = useState<{ name: string }[]>([]);
  const [highlight, setHighlight] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      setNameInput("");
      setSuggestions([]);
      setHighlight(-1);
      showToast({ kind: "success", title: "Category added", timeoutMs: 2000 });
    }
  }, [state.success, showToast]);

  useEffect(() => {
    const q = nameInput.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    const t = setTimeout(() => {
      void searchSuggestedCategoryNames(q, kind).then(setSuggestions);
    }, 220);
    return () => clearTimeout(t);
  }, [nameInput, kind]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setSuggestions([]);
        setHighlight(-1);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const income = items.filter((c) => c.kind === "income");
  const expense = items.filter((c) => c.kind === "expense");

  return (
    <div className="space-y-8">
      <form
        ref={formRef}
        action={formAction}
        className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/50"
      >
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
          New category
        </h2>
        <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
          Type at least two characters to see names others already use. Pick one
          to adopt the shared label (one definition per name and kind), or type a
          new name to create it.
        </p>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div ref={wrapRef} className="relative flex-1">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Name
              <input
                name="name"
                required
                autoComplete="off"
                value={nameInput}
                onChange={(e) => {
                  setNameInput(e.target.value);
                  setHighlight(-1);
                }}
                onBlur={() => setNameInput((v) => formatTypedLabel(v))}
                onKeyDown={(e) => {
                  if (suggestions.length === 0) return;
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setHighlight((h) =>
                      h < suggestions.length - 1 ? h + 1 : 0,
                    );
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setHighlight((h) =>
                      h <= 0 ? suggestions.length - 1 : h - 1,
                    );
                  } else if (e.key === "Enter" && highlight >= 0) {
                    e.preventDefault();
                    setNameInput(suggestions[highlight]!.name);
                    setSuggestions([]);
                    setHighlight(-1);
                  } else if (e.key === "Escape") {
                    setSuggestions([]);
                    setHighlight(-1);
                  }
                }}
                className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-zinc-900 shadow-sm outline-none focus:border-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                placeholder="Rent, Salary…"
              />
            </label>
            {suggestions.length > 0 ? (
              <ul
                className="absolute left-0 right-0 top-full z-20 mt-1 max-h-52 overflow-y-auto rounded-xl border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
                role="listbox"
              >
                {suggestions.map((s, i) => (
                  <li key={`${s.name}-${i}`} role="option" aria-selected={i === highlight}>
                    <button
                      type="button"
                      className={`w-full px-3 py-2 text-left text-sm ${
                        i === highlight
                          ? "bg-amber-500/15 text-zinc-900 dark:bg-amber-500/20 dark:text-zinc-50"
                          : "text-zinc-800 dark:text-zinc-200"
                      }`}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setNameInput(s.name);
                        setSuggestions([]);
                        setHighlight(-1);
                      }}
                    >
                      {s.name}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 sm:w-40">
            Kind
            <select
              name="kind"
              value={kind}
              onChange={(e) =>
                setKind(e.target.value as "income" | "expense")
              }
              className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-zinc-900 shadow-sm outline-none focus:border-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            >
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
          </label>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white shadow-sm hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            {pending ? "Adding…" : "Add"}
          </button>
        </div>
      </form>

      <div className="grid gap-8 sm:grid-cols-2">
        <CategoryColumn title="Expense" items={expense} />
        <CategoryColumn title="Income" items={income} />
      </div>
    </div>
  );
}

function CategoryColumn({ title, items }: { title: string; items: Category[] }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950/50">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">None yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between gap-2 rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-900/50"
            >
              <span className="truncate text-sm text-zinc-800 dark:text-zinc-200">
                {c.name}
              </span>
              <form action={deleteCategory}>
                <input type="hidden" name="id" value={c.id} />
                <button
                  type="submit"
                  className="text-xs font-medium text-zinc-500 hover:text-rose-600 dark:text-zinc-400 dark:hover:text-rose-400"
                >
                  Remove
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
