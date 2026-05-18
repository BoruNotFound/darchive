import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AcknowledgementButton, CreditsButton, GuideButton } from "@/components/AcknowledgementButton";
import { MultiGuestFilter } from "@/components/MultiGuestFilter";
import { VideoList } from "@/components/VideoList";
import { listGuests, searchVideos } from "@/lib/db";
import type { Guest, GuestId, Video } from "@/types";

const PAGE_SIZE = 40;

export function Dashboard() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [selectedGuestIds, setSelectedGuestIds] = useState<Set<GuestId>>(
    () => new Set(),
  );
  const [searchQuery, setSearchQuery] = useState("");

  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Discard responses from in-flight requests when filters changed mid-flight.
  const requestVersion = useRef(0);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const guestsById = useMemo(
    () => new Map(guests.map((g) => [g.id, g])),
    [guests],
  );

  // Stable string of selected guest IDs for effect deps (Set comparison
  // by reference would re-fire even on identical contents).
  const guestIdsKey = useMemo(
    () => Array.from(selectedGuestIds).sort().join(","),
    [selectedGuestIds],
  );

  // Guests load once, independent of the videos-paging cycle.
  useEffect(() => {
    let cancelled = false;
    listGuests()
      .then((gs) => {
        if (!cancelled) setGuests(gs);
      })
      .catch((e) => console.warn("[guests] load failed:", e));
    return () => {
      cancelled = true;
    };
  }, []);

  // Whenever the filters change, reset to page 0 and refetch.
  useEffect(() => {
    let cancelled = false;
    const version = ++requestVersion.current;
    setLoading(true);
    setError(null);
    setPage(0);

    const guestIdsArr = guestIdsKey ? guestIdsKey.split(",") : [];

    searchVideos({
      searchQuery,
      guestIds: guestIdsArr,
      pageSize: PAGE_SIZE,
      page: 0,
    })
      .then((result) => {
        if (cancelled || version !== requestVersion.current) return;
        setVideos(result.videos);
        setTotal(result.total);
      })
      .catch((e) => {
        if (cancelled) return;
        console.error("[dashboard] search failed:", e);
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled && version === requestVersion.current) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [searchQuery, guestIdsKey]);

  const hasMore = !loading && videos.length < total;

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const version = requestVersion.current;
    const nextPage = page + 1;
    try {
      const guestIdsArr = guestIdsKey ? guestIdsKey.split(",") : [];
      const result = await searchVideos({
        searchQuery,
        guestIds: guestIdsArr,
        pageSize: PAGE_SIZE,
        page: nextPage,
      });
      if (version !== requestVersion.current) return; // filters changed mid-flight
      setVideos((prev) => [...prev, ...result.videos]);
      setTotal(result.total);
      setPage(nextPage);
    } catch (e) {
      console.error("[dashboard] loadMore failed:", e);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, page, searchQuery, guestIdsKey]);

  // IntersectionObserver: trigger loadMore when the sentinel scrolls into view.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: "200px" }, // start fetching slightly before the user reaches the bottom
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore, hasMore]);

  const isFiltering = selectedGuestIds.size > 0 || searchQuery.trim() !== "";

  return (
    <>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-start justify-between gap-4 px-6 py-6">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold tracking-tight">
              <span style={{ color: "#F16A46" }}>大物是也</span> · 视频收录
            </h1>
            <p className="text-[24px] font-bold tracking-tight">
              <span style={{ color: "#F16A46" }}>D</span>Archive
            </p>
            <p className="text-sm text-slate-500">
              本网站仅收录大物是也频道自2021.12.09之后的视频，请支持原up - <a href="https://space.bilibili.com/208130286" target="_blank" rel="noopener noreferrer" className="text-pink-600 underline-offset-2 hover:underline">大物是也</a>。
              <br />
              浏览所有视频,按标题与嘉宾筛选(嘉宾可多选)。
            </p>
          </div>
          <div className="flex w-full shrink-0 items-center gap-3 sm:w-auto">
            <GuideButton />
            <span className="text-slate-300">|</span>
            <AcknowledgementButton />
            <span className="text-slate-300">|</span>
            <CreditsButton />
          </div>
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
            ) : (
              <>
                {isFiltering ? "匹配 " : "共 "}
                <strong className="text-slate-900">{total}</strong> 条
                {videos.length < total && (
                  <span className="ml-1 text-slate-400">
                    · 已加载 {videos.length}
                  </span>
                )}
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
          <>
            <VideoList videos={videos} guestsById={guestsById} />
            {hasMore && (
              <div
                ref={sentinelRef}
                className="py-10 text-center text-sm text-slate-400"
              >
                {loadingMore ? "加载更多…" : "继续滚动加载"}
              </div>
            )}
            {!hasMore && total > 0 && videos.length === total && (
              <div className="py-10 text-center text-xs text-slate-400">
                已加载全部
              </div>
            )}
          </>
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
