import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AcknowledgementButton } from "@/components/AcknowledgementButton";
import { Avatar } from "@/components/Avatar";
import { listGuests, listVideosInRange } from "@/lib/db";
import type { Guest, Video } from "@/types";

// Low-saturation Morandi palette. Rotates per row.
const MORANDI = [
  "#B5C9C3", // sage
  "#C8B6A6", // warm beige
  "#D4B6B6", // dusty rose
  "#B6BFD4", // dusty blue
  "#C9C3B6", // soft sand
  "#BFB6C9", // muted lavender
];

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 8 }, (_, i) => CURRENT_YEAR - i);

interface GuestStat {
  guest: Guest;
  appearances: number;
  rate: number; // 0..1
}

/** Format a YYYY-MM-DD ISO date string as YYYY/MM/DD for display. */
function formatChineseDate(iso: string): string {
  return iso.replace(/-/g, "/");
}

export function AnalyticsPage() {
  const [mode, setMode] = useState<"year" | "custom">("year");
  const [year, setYear] = useState<number>(CURRENT_YEAR);
  const [startDate, setStartDate] = useState<string>(`${CURRENT_YEAR}-01-01`);
  const [endDate, setEndDate] = useState<string>(
    new Date().toISOString().split("T")[0],
  );

  const [guests, setGuests] = useState<Guest[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const range = useMemo(() => {
    if (mode === "year") {
      return {
        start: `${year}-01-01`,
        end: `${year}-12-31`,
      };
    }
    return { start: startDate, end: endDate };
  }, [mode, year, startDate, endDate]);

  // Guests load once. We want every guest's avatar/name available, since the
  // server returns video_guests(guest_id) — we need the lookup to render.
  useEffect(() => {
    let cancelled = false;
    listGuests()
      .then((gs) => {
        if (!cancelled) setGuests(gs);
      })
      .catch((e) => console.warn("[analytics] guests load failed:", e));
    return () => {
      cancelled = true;
    };
  }, []);

  // Refetch whenever the chosen range changes.
  useEffect(() => {
    if (!range.start || !range.end || range.start > range.end) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    listVideosInRange(range.start, range.end)
      .then((vs) => {
        if (!cancelled) setVideos(vs);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range.start, range.end]);

  // Aggregate: for each *resident* guest who appeared, count appearances + rate.
  // 特邀嘉宾 (non-residents) are excluded — they're guest stars, not part of
  // the regular cast attendance metric.
  const stats: GuestStat[] = useMemo(() => {
    const total = videos.length;
    if (total === 0) return [];
    const counts = new Map<string, number>();
    for (const v of videos) {
      for (const gid of v.guestIds) {
        counts.set(gid, (counts.get(gid) ?? 0) + 1);
      }
    }
    const guestById = new Map(guests.map((g) => [g.id, g]));
    return Array.from(counts.entries())
      .map(([gid, n]) => {
        const guest = guestById.get(gid);
        if (!guest) return null;
        if (guest.castType !== "regular_cast") return null;
        return { guest, appearances: n, rate: n / total };
      })
      .filter((s): s is GuestStat => s !== null)
      .sort((a, b) => b.rate - a.rate);
  }, [videos, guests]);

  return (
    <>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">数据分析</h1>
            <p className="text-sm text-slate-500">
              嘉宾出勤率 · 按时间段统计 · 仅常驻嘉宾
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-4">
            <AcknowledgementButton />
            <Link
              to="/"
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-pink-300 hover:text-pink-700"
            >
              ← 视频面板
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-6 py-8">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-1 rounded-lg bg-slate-100 p-1 text-sm font-medium">
            <button
              type="button"
              onClick={() => setMode("year")}
              className={`flex-1 rounded-md py-1.5 transition ${
                mode === "year"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              整年
            </button>
            <button
              type="button"
              onClick={() => setMode("custom")}
              className={`flex-1 rounded-md py-1.5 transition ${
                mode === "custom"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              自定义时段
            </button>
          </div>

          {mode === "year" ? (
            <div>
              <label
                htmlFor="year-select"
                className="block text-sm font-medium text-slate-700"
              >
                选择年份
              </label>
              <select
                id="year-select"
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value, 10))}
                className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-200"
              >
                {YEAR_OPTIONS.map((y) => (
                  <option key={y} value={y}>
                    {y} 年
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="start-date"
                  className="block text-sm font-medium text-slate-700"
                >
                  起始日期
                </label>
                <input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-200"
                />
              </div>
              <div>
                <label
                  htmlFor="end-date"
                  className="block text-sm font-medium text-slate-700"
                >
                  结束日期
                </label>
                <input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-200"
                />
              </div>
            </div>
          )}
        </div>

        {!loading && !error && (
          <div className="text-sm text-slate-600">
            <strong className="text-slate-900">
              {formatChineseDate(range.start)}
            </strong>{" "}
            至{" "}
            <strong className="text-slate-900">
              {formatChineseDate(range.end)}
            </strong>{" "}
            · 共{" "}
            <strong className="text-slate-900">{videos.length}</strong> 条视频 ·{" "}
            <strong className="text-slate-900">{stats.length}</strong> 位常驻嘉宾出现
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <strong className="font-semibold">出错了:</strong> {error}
          </div>
        )}

        {loading ? (
          <div className="py-10 text-center text-sm text-slate-500">
            加载中…
          </div>
        ) : stats.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-sm text-slate-500">
            该时间段内没有数据。
          </div>
        ) : (
          <div className="space-y-1 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            {stats.map((s, i) => (
              <GuestStatRow
                key={s.guest.id}
                stat={s}
                totalVideos={videos.length}
                color={MORANDI[i % MORANDI.length]}
              />
            ))}
          </div>
        )}
      </main>
    </>
  );
}

interface GuestStatRowProps {
  stat: GuestStat;
  totalVideos: number;
  color: string;
}

/**
 * Single row in the analytics list.
 *
 * The "grow from 0" animation works by:
 *   1. Initial render → width: 0%
 *   2. After first paint, requestAnimationFrame → setWidth(target)
 *   3. CSS transition handles the actual animation between the two values
 *
 * Re-mounting the component (e.g. when stats array shape changes) replays it.
 */
function GuestStatRow({ stat, totalVideos, color }: GuestStatRowProps) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const handle = requestAnimationFrame(() => {
      setWidth(stat.rate * 100);
    });
    return () => cancelAnimationFrame(handle);
  }, [stat.rate]);

  return (
    <div className="flex items-center gap-3 px-2 py-2 sm:gap-4">
      <Avatar guest={stat.guest} size={36} />
      <div className="w-20 shrink-0 sm:w-32">
        <div className="truncate font-medium text-slate-900">
          {stat.guest.name}
        </div>
      </div>
      <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div
          className="absolute left-0 top-0 h-full rounded-full transition-all duration-1000 ease-out"
          style={{ width: `${width}%`, backgroundColor: color }}
        />
      </div>
      <div className="shrink-0 text-right text-sm tabular-nums">
        <span className="font-medium text-slate-900">
          {(stat.rate * 100).toFixed(1)}%
        </span>
        <span className="ml-1 text-xs text-slate-500">
          {stat.appearances}/{totalVideos}
        </span>
      </div>
    </div>
  );
}
