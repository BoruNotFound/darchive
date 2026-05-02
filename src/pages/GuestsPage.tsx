import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Avatar } from "@/components/Avatar";
import { AdminGate } from "@/components/AdminGate";
import { GuestForm } from "@/components/GuestForm";
import {
  createGuest,
  deleteGuest,
  listGuests,
  updateGuest,
} from "@/lib/db";
import type { Guest, GuestInput } from "@/types";

type EditorState =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "edit"; guest: Guest };

export function GuestsPage() {
  return (
    <>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">嘉宾管理</h1>
            <p className="text-sm text-slate-500">
              新增、编辑、删除嘉宾。视频编辑界面会从这里挑选嘉宾。
            </p>
          </div>
          <Link
            to="/admin"
            className="text-sm text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
          >
            ← 管理员首页
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        <AdminGate>
          <GuestsManager />
        </AdminGate>
      </main>
    </>
  );
}

function GuestsManager() {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState>({ mode: "closed" });
  // Stable id for new guests so the avatar upload path is consistent.
  const [pendingNewId] = useState(
    () => `new-${Math.random().toString(36).slice(2, 8)}`,
  );

  async function refresh() {
    try {
      const gs = await listGuests();
      setGuests(gs);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCreate(input: GuestInput) {
    await createGuest(input);
    setEditor({ mode: "closed" });
    await refresh();
  }

  async function handleEdit(input: GuestInput) {
    if (editor.mode !== "edit") return;
    await updateGuest(editor.guest.id, input);
    setEditor({ mode: "closed" });
    await refresh();
  }

  async function handleDelete(g: Guest) {
    const ok = window.confirm(
      `删除嘉宾「${g.name}」?该嘉宾在所有视频中的关联也会一并解除。此操作不可撤销。`,
    );
    if (!ok) return;
    try {
      await deleteGuest(g.id);
      await refresh();
    } catch (e) {
      alert(`删除失败:${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {loading ? "加载中…" : `共 ${guests.length} 位嘉宾`}
        </p>
        {editor.mode === "closed" && (
          <button
            type="button"
            onClick={() => setEditor({ mode: "create" })}
            className="rounded-lg bg-pink-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-pink-700"
          >
            + 新增嘉宾
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <strong className="font-semibold">出错了:</strong> {error}
        </div>
      )}

      {editor.mode === "create" && (
        <GuestForm
          pendingGuestId={pendingNewId}
          onSubmit={handleCreate}
          onCancel={() => setEditor({ mode: "closed" })}
        />
      )}

      {editor.mode === "edit" && (
        <GuestForm
          initial={editor.guest}
          onSubmit={handleEdit}
          onCancel={() => setEditor({ mode: "closed" })}
        />
      )}

      <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {guests.map((g) => (
          <li
            key={g.id}
            className="flex items-center gap-4 px-4 py-3"
          >
            <Avatar guest={g} size={40} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 font-medium text-slate-900">
                <span>{g.name}</span>
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                    g.castType === "regular_cast"
                      ? "bg-slate-100 text-slate-600"
                      : "bg-rose-100 text-rose-700"
                  }`}
                >
                  {g.castType === "regular_cast" ? "常驻" : "特邀"}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setEditor({ mode: "edit", guest: g })}
                className="rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
              >
                编辑
              </button>
              <button
                type="button"
                onClick={() => handleDelete(g)}
                className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
              >
                删除
              </button>
            </div>
          </li>
        ))}
        {!loading && guests.length === 0 && (
          <li className="px-4 py-8 text-center text-sm text-slate-500">
            还没有嘉宾。点击右上角「新增嘉宾」开始。
          </li>
        )}
      </ul>
    </div>
  );
}
