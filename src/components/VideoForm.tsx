import { useEffect, useState, type FormEvent } from "react";
import { AuditEntry } from "@/components/AuditEntry";
import { GuestPicker } from "@/components/GuestPicker";
import { fetchBilibiliMetadata } from "@/lib/bilibili";
import { listAuditEntriesForVideo } from "@/lib/db";
import type { AuditLogEntry, Guest, Video, VideoInput } from "@/types";

interface VideoFormProps {
  /** Pass an existing video to enter edit mode; omit for create. */
  initial?: Video;
  /** Available guests to pick from. */
  guests: Guest[];
  onGuestCreated?: (g: Guest) => void;
  onSubmit: (input: VideoInput) => Promise<void>;
  onCancel: () => void;
}

function secsToMinutes(s: number | undefined | null): string {
  if (s == null) return "";
  return String(Math.round(s / 60));
}

function minutesToSecs(m: string): number | null {
  const n = parseFloat(m);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 60);
}

export function VideoForm({
  initial,
  guests,
  onGuestCreated,
  onSubmit,
  onCancel,
}: VideoFormProps) {
  const isEdit = Boolean(initial);

  const [bilibiliUrl, setBilibiliUrl] = useState(initial?.bilibiliUrl ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [publishedAt, setPublishedAt] = useState(initial?.publishedAt ?? "");
  const [durationMin, setDurationMin] = useState(
    secsToMinutes(initial?.durationSec),
  );
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null | undefined>(
    initial?.thumbnailUrl,
  );
  const [guestIds, setGuestIds] = useState<string[]>(initial?.guestIds ?? []);

  const [fetching, setFetching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchInfo, setFetchInfo] = useState<string | null>(null);

  // Per-video audit history. Only loaded in edit mode.
  const [history, setHistory] = useState<AuditLogEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (!initial) return;
    let cancelled = false;
    setHistoryLoading(true);
    listAuditEntriesForVideo(initial.id)
      .then((entries) => {
        if (!cancelled) setHistory(entries);
      })
      .catch((e) => console.warn("[history] fetch failed:", e))
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [initial]);

  // Auto-fire metadata fetch when a fresh URL is pasted in create mode.
  useEffect(() => {
    if (isEdit) return;
    const trimmed = bilibiliUrl.trim();
    if (!trimmed.match(/BV[a-zA-Z0-9]+/)) return;
    if (title || publishedAt || thumbnailUrl) return; // already filled
    let cancelled = false;
    (async () => {
      setFetching(true);
      setError(null);
      try {
        const meta = await fetchBilibiliMetadata(trimmed);
        if (cancelled) return;
        setTitle(meta.title);
        setPublishedAt(meta.publishedAt);
        setDurationMin(secsToMinutes(meta.durationSec));
        setThumbnailUrl(meta.thumbnailUrl);
        setFetchInfo("已自动填充标题、时长、日期与封面。");
      } catch (e) {
        if (cancelled) return;
        setError(
          `自动获取失败:${e instanceof Error ? e.message : String(e)}`,
        );
      } finally {
        if (!cancelled) setFetching(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bilibiliUrl]);

  async function handleRefetch() {
    if (!bilibiliUrl.match(/BV[a-zA-Z0-9]+/)) {
      setError("请输入包含 BV 号的有效 bilibili 链接。");
      return;
    }
    setFetching(true);
    setError(null);
    setFetchInfo(null);
    try {
      const meta = await fetchBilibiliMetadata(bilibiliUrl);
      setTitle(meta.title);
      setPublishedAt(meta.publishedAt);
      setDurationMin(secsToMinutes(meta.durationSec));
      setThumbnailUrl(meta.thumbnailUrl);
      setFetchInfo("已重新获取元数据。");
    } catch (e) {
      setError(
        `获取失败:${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setFetching(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!bilibiliUrl.trim() || !title.trim() || !publishedAt) {
      setError("链接、标题、日期为必填项。");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        id: initial?.id,
        bilibiliUrl: bilibiliUrl.trim(),
        title: title.trim(),
        publishedAt,
        durationSec: minutesToSecs(durationMin),
        thumbnailUrl,
        guestIds,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <h3 className="text-base font-semibold text-slate-900">
        {isEdit ? "编辑视频" : "新增视频"}
      </h3>

      <div>
        <label
          htmlFor="bilibili-url"
          className="block text-sm font-medium text-slate-700"
        >
          bilibili 链接
        </label>
        <div className="mt-1 flex gap-2">
          <input
            id="bilibili-url"
            type="url"
            required
            value={bilibiliUrl}
            onChange={(e) => setBilibiliUrl(e.target.value)}
            placeholder="https://www.bilibili.com/video/BV…"
            className="block flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-200"
          />
          <button
            type="button"
            onClick={handleRefetch}
            disabled={fetching || !bilibiliUrl}
            className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {fetching ? "获取中…" : "重新获取"}
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-400">
          粘贴 bilibili 视频链接,标题、日期、时长、封面会自动填充。
        </p>
        {fetchInfo && !error && (
          <p className="mt-1 text-xs text-emerald-600">{fetchInfo}</p>
        )}
      </div>

      {thumbnailUrl && (
        <div>
          <p className="mb-1 text-xs font-medium text-slate-500">封面</p>
          <img
            src={thumbnailUrl}
            alt="封面"
            className="aspect-video w-full max-w-sm rounded-lg border border-slate-200 object-cover"
          />
        </div>
      )}

      <div>
        <label
          htmlFor="video-title"
          className="block text-sm font-medium text-slate-700"
        >
          标题
        </label>
        <input
          id="video-title"
          type="text"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-200"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="video-date"
            className="block text-sm font-medium text-slate-700"
          >
            发布日期
          </label>
          <input
            id="video-date"
            type="date"
            required
            value={publishedAt}
            onChange={(e) => setPublishedAt(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-200"
          />
        </div>

        <div>
          <label
            htmlFor="video-duration"
            className="block text-sm font-medium text-slate-700"
          >
            时长(分钟)
          </label>
          <input
            id="video-duration"
            type="number"
            min="0"
            step="1"
            value={durationMin}
            onChange={(e) => setDurationMin(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-200"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          嘉宾
        </label>
        <GuestPicker
          guests={guests}
          selectedGuestIds={guestIds}
          onChange={setGuestIds}
          onGuestCreated={onGuestCreated}
        />
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}

      <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
        >
          取消
        </button>
        <button
          type="submit"
          disabled={submitting || fetching}
          className="rounded-lg bg-pink-600 px-4 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-pink-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "保存中…" : isEdit ? "保存修改" : "添加视频"}
        </button>
      </div>

      {isEdit && (
        <section className="border-t border-slate-100 pt-5">
          <h4 className="text-sm font-semibold text-slate-900">修改历史</h4>
          {historyLoading ? (
            <p className="mt-2 text-xs text-slate-500">加载中…</p>
          ) : history.length === 0 ? (
            <p className="mt-2 text-xs text-slate-400">暂无记录。</p>
          ) : (
            <div className="mt-3 space-y-3">
              {history.map((e) => (
                <AuditEntry key={e.id} entry={e} hideVideoLine />
              ))}
            </div>
          )}
        </section>
      )}
    </form>
  );
}
