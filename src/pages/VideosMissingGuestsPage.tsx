import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AdminGate } from "@/components/AdminGate";
import { GuestPicker } from "@/components/GuestPicker";
import {
  deleteVideo,
  listGuests,
  listVideosMissingGuests,
  setVideoCollab,
  setVideoGuests,
} from "@/lib/db";
import type { Guest, GuestId, Video } from "@/types";

type SortOrder = "desc" | "asc"; // by published_at

export function VideosMissingGuestsPage() {
  return (
    <>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">缺少嘉宾名单</h1>
            <p className="text-sm text-slate-500">
              下面是还没有标注嘉宾的视频。
              点开 bilibili 链接看一眼,然后回来添加嘉宾名单。
            </p>
          </div>
          <Link
            to="/admin"
            className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-pink-300 hover:text-pink-700"
          >
            ← 管理员首页
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        <AdminGate>
          <MissingGuestsList />
        </AdminGate>
      </main>
    </>
  );
}

function MissingGuestsList() {
  const [videos, setVideos] = useState<Video[] | null>(null);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<SortOrder>("desc");

  // Inline editor state — only one row open at a time.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftIds, setDraftIds] = useState<GuestId[]>([]);
  const [saving, setSaving] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);

  // The fetch already returns newest-first; reverse if the user picked oldest.
  const sortedVideos = useMemo(() => {
    if (!videos) return null;
    return order === "asc" ? [...videos].reverse() : videos;
  }, [videos, order]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listVideosMissingGuests(), listGuests()])
      .then(([vs, gs]) => {
        if (cancelled) return;
        setVideos(vs);
        setGuests(gs);
      })
      .catch((e) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function startEdit(videoId: string) {
    setEditingId(videoId);
    setDraftIds([]);
    setRowError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setDraftIds([]);
    setRowError(null);
  }

  async function handleSave() {
    if (!editingId) return;
    if (draftIds.length === 0) {
      // Nothing to save — just collapse the row.
      cancelEdit();
      return;
    }
    setSaving(true);
    setRowError(null);
    try {
      await setVideoGuests(editingId, draftIds);
      // Successfully saved → drop the video from the local list.
      setVideos((vs) => (vs ? vs.filter((v) => v.id !== editingId) : vs));
      cancelEdit();
    } catch (e) {
      setRowError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(v: Video) {
    const ok = window.confirm(`删除视频「${v.title}」?此操作不可撤销。`);
    if (!ok) return;
    try {
      await deleteVideo(v.id);
      setVideos((vs) => (vs ? vs.filter((x) => x.id !== v.id) : vs));
    } catch (e) {
      alert(`删除失败:${e instanceof Error ? e.message : String(e)}`);
    }
  }

  function handleGuestCreated(g: Guest) {
    setGuests((gs) => [...gs, g]);
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        <strong className="font-semibold">出错了:</strong> {error}
      </div>
    );
  }

  if (videos === null) {
    return (
      <div className="py-10 text-center text-sm text-slate-500">加载中…</div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-10 text-center text-sm text-emerald-800">
        🎉 所有视频都已标注嘉宾。
      </div>
    );
  }

  const list = sortedVideos ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600">
          共 <strong className="text-slate-900">{videos.length}</strong>{" "}
          个视频缺少嘉宾名单。
        </p>
        <button
          type="button"
          onClick={() => setOrder((o) => (o === "desc" ? "asc" : "desc"))}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:border-pink-300 hover:text-pink-700"
          aria-label="切换排序"
        >
          {order === "desc" ? "最新优先" : "最早优先"}
          <span aria-hidden>{order === "desc" ? "↓" : "↑"}</span>
        </button>
      </div>
      <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {list.map((v) => {
          const isEditing = editingId === v.id;
          return (
            <li key={v.id} className="px-4 py-4">
              <div className="flex items-start gap-4">
                {v.thumbnailUrl ? (
                  <img
                    src={v.thumbnailUrl}
                    alt=""
                    className="h-16 w-28 shrink-0 rounded-md object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-28 shrink-0 items-center justify-center rounded-md bg-slate-100 text-xs text-slate-400">
                    无封面
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-slate-900">{v.title}</div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    {v.publishedAt}
                    {v.durationSec
                      ? ` · ${Math.round(v.durationSec / 60)} 分钟`
                      : ""}
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-xs">
                    <a
                      href={v.bilibiliUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-pink-600 hover:text-pink-700 hover:underline"
                    >
                      在 bilibili 观看 →
                    </a>
                    {!isEditing && (
                      <>
                        <button
                          type="button"
                          onClick={() => startEdit(v.id)}
                          className="rounded-md bg-pink-600 px-2 py-1 font-medium text-white shadow-sm hover:bg-pink-700"
                        >
                          添加嘉宾
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await setVideoCollab(v.id, !v.isCollab);
                              setVideos((vs) =>
                                vs
                                  ? vs.map((x) =>
                                      x.id === v.id
                                        ? { ...x, isCollab: !x.isCollab }
                                        : x,
                                    )
                                  : vs,
                              );
                            } catch (e) {
                              alert(
                                `操作失败:${e instanceof Error ? e.message : String(e)}`,
                              );
                            }
                          }}
                          className={`rounded-md px-2 py-1 font-medium ${
                            v.isCollab
                              ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
                              : "text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          {v.isCollab ? "已标记合作" : "标记合作"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(v)}
                          className="rounded-md px-2 py-1 font-medium text-red-600 hover:bg-red-50"
                        >
                          删除
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {isEditing && (
                <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="mb-2 text-xs font-medium text-slate-700">
                    选择本视频中出现的嘉宾(支持多选,可现场新增)
                  </p>
                  <GuestPicker
                    guests={guests}
                    selectedGuestIds={draftIds}
                    onChange={setDraftIds}
                    onGuestCreated={handleGuestCreated}
                  />
                  {rowError && (
                    <p className="mt-2 text-xs text-red-600">{rowError}</p>
                  )}
                  <div className="mt-3 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={cancelEdit}
                      disabled={saving}
                      className="rounded-md px-3 py-1 text-xs text-slate-600 hover:bg-slate-100"
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={saving || draftIds.length === 0}
                      className="rounded-md bg-pink-600 px-3 py-1 text-xs font-medium text-white shadow-sm hover:bg-pink-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {saving ? "保存中…" : "保存"}
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
