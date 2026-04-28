import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Avatar } from "@/components/Avatar";
import { AdminGate } from "@/components/AdminGate";
import { VideoForm } from "@/components/VideoForm";
import {
  createVideo,
  deleteVideo,
  listGuests,
  listVideos,
  updateVideo,
} from "@/lib/db";
import type { Guest, Video, VideoInput } from "@/types";

type EditorState =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "edit"; video: Video };

export function VideosPage() {
  return (
    <>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">视频管理</h1>
            <p className="text-sm text-slate-500">
              新增、编辑、删除视频。粘贴 bilibili 链接即可自动获取标题、日期、时长与封面。
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
          <VideosManager />
        </AdminGate>
      </main>
    </>
  );
}

function VideosManager() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState>({ mode: "closed" });
  const [searchParams, setSearchParams] = useSearchParams();
  const editIdFromUrl = searchParams.get("edit");

  async function refresh() {
    try {
      const [vs, gs] = await Promise.all([listVideos(), listGuests()]);
      setVideos(vs);
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

  // Auto-open the editor for the video named in `?edit=<bvid>`. Lets links
  // from /admin/videos-missing-guests jump straight into the form. We clear
  // the param after opening so a refresh doesn't keep re-triggering.
  useEffect(() => {
    if (!editIdFromUrl) return;
    if (videos.length === 0) return;
    const video = videos.find((v) => v.id === editIdFromUrl);
    if (video) setEditor({ mode: "edit", video });
    const next = new URLSearchParams(searchParams);
    next.delete("edit");
    setSearchParams(next, { replace: true });
  }, [editIdFromUrl, videos, searchParams, setSearchParams]);

  async function handleCreate(input: VideoInput) {
    await createVideo(input);
    setEditor({ mode: "closed" });
    await refresh();
  }

  async function handleEdit(input: VideoInput) {
    if (editor.mode !== "edit") return;
    await updateVideo(editor.video.id, input);
    setEditor({ mode: "closed" });
    await refresh();
  }

  async function handleDelete(v: Video) {
    const ok = window.confirm(`删除视频「${v.title}」?此操作不可撤销。`);
    if (!ok) return;
    try {
      await deleteVideo(v.id);
      await refresh();
    } catch (e) {
      alert(`删除失败:${e instanceof Error ? e.message : String(e)}`);
    }
  }

  function handleGuestCreated(g: Guest) {
    setGuests((gs) => [...gs, g]);
  }

  const guestsById = new Map(guests.map((g) => [g.id, g]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {loading ? "加载中…" : `共 ${videos.length} 条视频`}
        </p>
        {editor.mode === "closed" && (
          <button
            type="button"
            onClick={() => setEditor({ mode: "create" })}
            className="rounded-lg bg-pink-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-pink-700"
          >
            + 新增视频
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <strong className="font-semibold">出错了:</strong> {error}
        </div>
      )}

      {editor.mode === "create" && (
        <VideoForm
          guests={guests}
          onGuestCreated={handleGuestCreated}
          onSubmit={handleCreate}
          onCancel={() => setEditor({ mode: "closed" })}
        />
      )}

      {editor.mode === "edit" && (
        <VideoForm
          initial={editor.video}
          guests={guests}
          onGuestCreated={handleGuestCreated}
          onSubmit={handleEdit}
          onCancel={() => setEditor({ mode: "closed" })}
        />
      )}

      <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {videos.map((v) => (
          <li key={v.id} className="flex items-start gap-4 px-4 py-4">
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
                {v.durationSec ? ` · ${Math.round(v.durationSec / 60)} 分钟` : ""}
              </div>
              {v.guestIds.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {v.guestIds.map((id) => {
                    const g = guestsById.get(id);
                    if (!g) return null;
                    return (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 py-0.5 pl-0.5 pr-2 text-xs text-slate-700"
                      >
                        <Avatar guest={g} size={16} />
                        {g.name}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => setEditor({ mode: "edit", video: v })}
                className="rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
              >
                编辑
              </button>
              <button
                type="button"
                onClick={() => handleDelete(v)}
                className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
              >
                删除
              </button>
            </div>
          </li>
        ))}
        {!loading && videos.length === 0 && (
          <li className="px-4 py-8 text-center text-sm text-slate-500">
            还没有视频。点击右上角「新增视频」开始。
          </li>
        )}
      </ul>
    </div>
  );
}
