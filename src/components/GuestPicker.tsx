import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Avatar } from "@/components/Avatar";
import { GuestForm } from "@/components/GuestForm";
import { createGuest } from "@/lib/db";
import type { Guest, GuestId, GuestInput } from "@/types";

interface GuestPickerProps {
  /** All known guests, used to populate the dropdown. */
  guests: Guest[];
  /** Currently selected guest ids. */
  selectedGuestIds: GuestId[];
  onChange: (ids: GuestId[]) => void;
  /** Called when a brand-new guest is created via inline-create, so the
   *  parent can refresh its guest list. */
  onGuestCreated?: (guest: Guest) => void;
}

/**
 * Multi-select for video → guests, with an inline "+ 新增嘉宾" item that opens
 * a small modal so the admin can create a missing guest without leaving the
 * video form. Mirrors the dashboard's MultiGuestFilter UX (chips inside the
 * input, type-to-search, keyboard navigation).
 */
export function GuestPicker({
  guests,
  selectedGuestIds,
  onChange,
  onGuestCreated,
}: GuestPickerProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [creating, setCreating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedSet = useMemo(
    () => new Set(selectedGuestIds),
    [selectedGuestIds],
  );

  const candidates = useMemo(
    () =>
      guests
        .filter((g) => !selectedSet.has(g.id))
        .filter(
          (g) =>
            !query || g.name.toLowerCase().includes(query.toLowerCase()),
        ),
    [guests, selectedSet, query],
  );

  // The "+ 新增嘉宾" pseudo-row sits at index === candidates.length.
  const totalRows = candidates.length + 1;

  useEffect(() => {
    setActiveIdx(0);
  }, [query, selectedGuestIds]);

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

  const selected = useMemo(
    () => guests.filter((g) => selectedSet.has(g.id)),
    [guests, selectedSet],
  );

  function add(id: GuestId) {
    onChange([...selectedGuestIds, id]);
    setQuery("");
    inputRef.current?.focus();
  }

  function remove(id: GuestId) {
    onChange(selectedGuestIds.filter((x) => x !== id));
  }

  function startCreate() {
    setOpen(false);
    setCreating(true);
  }

  async function handleCreate(input: GuestInput) {
    const created = await createGuest(input);
    onGuestCreated?.(created);
    onChange([...selectedGuestIds, created.id]);
    setCreating(false);
    setQuery("");
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActiveIdx((i) => Math.min(i + 1, totalRows - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIdx < candidates.length) {
        add(candidates[activeIdx].id);
      } else {
        startCreate();
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    } else if (
      e.key === "Backspace" &&
      query === "" &&
      selected.length > 0
    ) {
      remove(selected[selected.length - 1].id);
    }
  }

  return (
    <>
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
                  remove(g.id);
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
              selected.length === 0
                ? "选择视频中出现的嘉宾 …"
                : "继续添加 …"
            }
            className="min-w-[160px] flex-1 border-none bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
          />
        </div>

        {open && (
          <div className="absolute left-0 right-0 z-20 mt-2 max-h-72 overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg">
            <ul role="listbox" className="py-1">
              {candidates.map((g, i) => (
                <li
                  key={g.id}
                  role="option"
                  aria-selected={i === activeIdx}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => add(g.id)}
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
              <li
                role="option"
                aria-selected={activeIdx === candidates.length}
                onMouseDown={(e) => e.preventDefault()}
                onClick={startCreate}
                onMouseEnter={() => setActiveIdx(candidates.length)}
                className={`flex cursor-pointer items-center gap-3 border-t border-slate-100 px-4 py-2 text-sm font-medium ${
                  activeIdx === candidates.length
                    ? "bg-pink-50 text-pink-900"
                    : "text-pink-600"
                }`}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-pink-100 text-pink-700">
                  +
                </span>
                {query
                  ? `新增嘉宾「${query}」`
                  : "新增嘉宾"}
              </li>
            </ul>
          </div>
        )}
      </div>

      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md">
            <GuestForm
              initial={undefined}
              pendingGuestId={`new-${Math.random().toString(36).slice(2, 8)}`}
              onSubmit={async (input) => {
                // Pre-fill the typed query into the new guest's name if they
                // hadn't typed anything in the form yet (handled inside form).
                await handleCreate({
                  ...input,
                  name: input.name || query,
                });
              }}
              onCancel={() => setCreating(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}
