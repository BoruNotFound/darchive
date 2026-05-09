import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Avatar } from "@/components/Avatar";
import type { Guest, GuestId } from "@/types";

interface MultiGuestFilterProps {
  guests: Guest[];
  selectedGuestIds: Set<GuestId>;
  onChange: (ids: Set<GuestId>) => void;
}

function matchesQuery(guest: Guest, q: string): boolean {
  if (!q) return true;
  return guest.name.toLowerCase().includes(q.toLowerCase());
}

/**
 * Combobox-style multi-select for guests.
 *
 * Built from scratch (no headless-ui / downshift / etc.) because the surface
 * is small enough that a dependency wouldn't pay for itself. Keeping it local
 * also means we can tweak behavior freely as features grow.
 */
export function MultiGuestFilter({
  guests,
  selectedGuestIds,
  onChange,
}: MultiGuestFilterProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Close the dropdown when the user clicks anywhere outside the component.
  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  // Candidates = guests not yet selected, matching the typed query.
  // When the user hasn't typed anything yet, hide 特邀嘉宾 to keep the
  // default dropdown short — they appear only when explicitly searched for.
  const candidates = useMemo(() => {
    const q = query.trim();
    return guests
      .filter((g) => !selectedGuestIds.has(g.id))
      .filter((g) => {
        if (!q) return g.castType === "regular_cast";
        return matchesQuery(g, q);
      });
  }, [guests, selectedGuestIds, query]);

  // Reset highlight when the candidate list changes shape.
  useEffect(() => {
    setActiveIdx(0);
  }, [query, selectedGuestIds]);

  // Keep the highlighted option in view when navigating by keyboard.
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.children[activeIdx] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIdx, open]);

  const selected = useMemo(
    () => guests.filter((g) => selectedGuestIds.has(g.id)),
    [guests, selectedGuestIds],
  );

  function addGuest(id: GuestId) {
    const next = new Set(selectedGuestIds);
    next.add(id);
    onChange(next);
    setQuery("");
    // After selection, "stop here". Close the dropdown and drop focus —
    // if the user wants another guest, they re-click the bar.
    setOpen(false);
    inputRef.current?.blur();
  }

  function removeGuest(id: GuestId) {
    const next = new Set(selectedGuestIds);
    next.delete(id);
    onChange(next);
  }

  function clearAll() {
    onChange(new Set());
    setQuery("");
    inputRef.current?.focus();
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActiveIdx((i) => Math.min(i + 1, Math.max(candidates.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const c = candidates[activeIdx];
      if (c) addGuest(c.id);
    } else if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "Backspace" && query === "" && selected.length > 0) {
      // Convenience: empty-input backspace removes the last chip.
      removeGuest(selected[selected.length - 1].id);
    }
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <div
        className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 shadow-sm transition focus-within:border-pink-500 focus-within:ring-2 focus-within:ring-pink-200"
        onClick={() => {
          setOpen(true);
          inputRef.current?.focus();
        }}
      >
        {selected.map((g) => (
          <span
            key={g.id}
            className="inline-flex items-center gap-1.5 rounded-full bg-pink-100 py-0.5 pl-0.5 pr-2 text-sm font-medium text-pink-800"
          >
            <Avatar guest={g} size={20} />
            {g.name}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeGuest(g.id);
              }}
              className="-mr-0.5 flex h-4 w-4 items-center justify-center rounded-full text-pink-600 transition hover:bg-pink-200 hover:text-pink-900"
              aria-label={`移除 ${g.name}`}
            >
              ×
            </button>
          </span>
        ))}

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={
            selected.length === 0 ? "搜索嘉宾,可选择多个 …" : "继续添加嘉宾 …"
          }
          className="min-w-[160px] flex-1 border-none bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
        />

        {selected.length > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              clearAll();
            }}
            className="ml-auto whitespace-nowrap text-xs font-medium text-slate-500 transition hover:text-slate-800"
          >
            清除全部
          </button>
        )}
      </div>

      {open && (
        <div className="absolute left-0 right-0 z-20 mt-2 max-h-72 overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg">
          {candidates.length === 0 ? (
            <div className="px-4 py-3 text-sm text-slate-500">
              {selected.length === guests.length
                ? "已选择全部嘉宾"
                : "没有匹配的嘉宾"}
            </div>
          ) : (
            <ul ref={listRef} role="listbox" className="py-1">
              {candidates.map((g, i) => (
                <li
                  key={g.id}
                  role="option"
                  aria-selected={i === activeIdx}
                  // mousedown fires before input blur — preventing default
                  // keeps the input focused so the dropdown stays open
                  // for rapid multi-selection.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => addGuest(g.id)}
                  onMouseEnter={() => setActiveIdx(i)}
                  className={`flex cursor-pointer items-center gap-3 px-4 py-2 text-sm ${
                    i === activeIdx
                      ? "bg-pink-50 text-pink-900"
                      : "text-slate-700"
                  }`}
                >
                  <Avatar guest={g} size={28} />
                  <span className="font-medium">{g.name}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
