import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MultiGuestFilter } from "@/components/MultiGuestFilter";
import { VideoList } from "@/components/VideoList";
import { listGuests, listVideos } from "@/lib/db";
import type { Guest, GuestId, Video } from "@/types";

export function Dashboard() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [selectedGuestIds, setSelectedGuestIds] = useState<Set<GuestId>>(
    () => new Set(),
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [vs, gs] = await Promise.all([listVideos(), listGuests()]);
        if (cancelled) return;
        setVideos(vs);
        setGuests(gs);
      } catch (err) {
        console.error("[dashboard] data fetch failed:", err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const guestsById = useMemo(
    () => new Map(guests.map((g) => [g.id, g])),
    [guests],
  );

  // AND across both filters: a video must contain every selected guest AND
  // its title must contain the search query (substring, case-insensitive).
  const filteredVideos = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const selectedArr = Array.from(selectedGuestIds);
    return videos.filter((v) => {
      if (
        selectedArr.length > 0 &&
        !selectedArr.every((id) => v.guestIds.includes(id))
      ) {
        return false;
      }
      if (q && !v.title.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [videos, selectedGuestIds, searchQuery]);

  const isFiltering = selectedGuestIds.size > 0 || searchQuery.trim() !== "";

  const sortedVideos = useMemo(
    () =>
      [...filteredVideos].sort((a, b) =>
        b.publishedAt.localeCompare(a.publishedAt),
      ),
    [filteredVideos],
  );

  return (
    <>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-6 py-6">
          <h1 className="text-2xl font-bold tracking-tight">
            大物是也 · 视频面板
          </h1>
          <p className="text-sm text-slate-500">
            浏览所有视频,按嘉宾筛选(可多选,显示同时出现的视频)。
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-3 space-y-3">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索视频标题 …"
            className="block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-200"
          />
          <MultiGuestFilter
            guests={guests}
            selectedGuestIds={selectedGuestIds}
            onChange={setSelectedGuestIds}
          />
        </div>

        <div className="mb-6 flex items-center justify-between text-sm text-slate-500">
          <span>
            {loading ? (
              "加载中…"
            ) : !isFiltering ? (
              <>
                共{" "}
                <strong className="text-slate-900">{sortedVideos.length}</strong>{" "}
                条
              </>
            ) : (
              <>
                匹配{" "}
                <strong className="text-slate-900">{sortedVideos.length}</strong>{" "}
                条 / 共 {videos.length} 条
              </>
            )}
          </span>
          {selectedGuestIds.size >= 2 && (
            <span className="text-xs text-slate-400">
              显示同时包含全部所选嘉宾的视频
            </span>
          )}
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <strong className="font-semibold">数据加载失败:</strong> {error}
          </div>
        )}

        {!loading && !error && (
          <VideoList videos={sortedVideos} guestsById={guestsById} />
        )}
      </main>

      <footer className="mx-auto flex max-w-6xl items-center justify-between px-6 py-10 text-xs text-slate-400">
        <span>数据来自 Supabase · 公开只读</span>
        <Link
          to="/admin"
          className="text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
        >
          管理员入口 →
        </Link>
      </footer>
    </>
  );
}
