import { Avatar } from "@/components/Avatar";
import type { Guest, Video } from "@/types";

interface VideoCardProps {
  video: Video;
  guestsById: Map<string, Guest>;
}

function formatDate(iso: string): string {
  // Locale-aware but stable for our purposes — YYYY-MM-DD ordering.
  return new Date(iso).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDuration(sec: number | undefined): string | null {
  if (!sec) return null;
  const m = Math.floor(sec / 60);
  return `${m} 分钟`;
}

export function VideoCard({ video, guestsById }: VideoCardProps) {
  const duration = formatDuration(video.durationSec);

  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
      {video.thumbnailUrl && (
        <a
          href={video.bilibiliUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block"
        >
          <img
            src={video.thumbnailUrl}
            alt=""
            loading="lazy"
            className="aspect-video w-full object-cover"
          />
        </a>
      )}
      <div className="flex flex-1 flex-col p-3">
      <header className="mb-2 flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold leading-snug text-slate-900">
          {video.title}
        </h3>
      </header>

      <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500">
        <span>{formatDate(video.publishedAt)}</span>
        {duration && (
          <>
            <span aria-hidden>·</span>
            <span>{duration}</span>
          </>
        )}
      </div>

      <div className="mb-3 flex flex-wrap gap-1">
        {video.guestIds.map((id) => {
          const g = guestsById.get(id);
          if (!g) {
            return (
              <span
                key={id}
                className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700"
              >
                {id}
              </span>
            );
          }
          return (
            <span
              key={id}
              className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 py-0.5 pl-0.5 pr-2 text-xs font-medium text-slate-700"
            >
              <Avatar guest={g} size={18} />
              {g.name}
            </span>
          );
        })}
      </div>

      <a
        href={video.bilibiliUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-auto inline-flex w-fit items-center gap-1 text-xs font-medium text-pink-600 hover:text-pink-700"
      >
        在 bilibili 观看
        <span aria-hidden>→</span>
      </a>
      </div>
    </article>
  );
}
